
import { supabase } from './supabase';

// --- Real Estate Specific Intents ---
export type RealEstateIntent = 
    | 'Property Inquiry' 
    | 'Price/Availability' 
    | 'Booking/Viewing' 
    | 'Location/Amenities' 
    | 'Handover/Keys' 
    | 'Complaint' 
    | 'General Chat'
    | 'Unknown';

// --- Helper: Call AI Proxy ---
// This prevents CORS errors by routing requests through Supabase Edge Functions
const invokeAI = async (action: 'chat' | 'embedding', payload: any, apiKey?: string) => {
    if (!supabase) throw new Error("Supabase client not initialized");

    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { action, apiKey, ...payload }
    });

    if (error) {
        console.error(`AI Proxy Error (${action}):`, error);
        if (error.message?.includes('FunctionsFetchError') || error.message?.includes('Failed to fetch')) {
             throw new Error("Connection failed. Please deploy the 'openai-proxy' Edge Function.");
        }
        throw new Error(error.message || "AI Request Failed");
    }
    return data;
};

// --- 1. INTENT CLASSIFICATION ---
export const classifyIntent = async (message: string, apiKey?: string): Promise<RealEstateIntent> => {
    try {
        const response = await invokeAI('chat', {
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a classification engine. Analyze the following message from a Real Estate client.
                    Classify it into exactly ONE of these categories:
                    - Property Inquiry
                    - Price/Availability
                    - Booking/Viewing
                    - Location/Amenities
                    - Handover/Keys
                    - Complaint
                    - General Chat

                    Rules:
                    1. Return ONLY the category name.
                    2. Do not add punctuation, quotes, or explanations.
                    3. If unsure, return 'General Chat'.`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.0,
        }, apiKey);

        let tag = response.choices[0]?.message?.content?.replace(/['"]/g, '').replace('Category:', '').trim();
        
        const validTags = [
            'Property Inquiry', 'Price/Availability', 'Booking/Viewing', 
            'Location/Amenities', 'Handover/Keys', 'Complaint', 'General Chat'
        ];
        
        if (!tag || !validTags.includes(tag)) {
            tag = 'General Chat';
        }

        return tag as RealEstateIntent;
    } catch (error) {
        console.error("Intent classification failed:", error);
        return 'General Chat'; 
    }
};

// --- 2. RAG (RETRIEVAL) ---
export const retrieveContext = async (userId: string, message: string, apiKey?: string): Promise<string> => {
    try {
        if (!supabase) return "";

        // 1. Resolve Organization ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', userId)
            .single();

        if (!profile?.organization_id) {
            console.warn("RAG: No organization found for user", userId);
            return "";
        }

        // 2. Create Embedding via Proxy
        const embeddingResult = await invokeAI('embedding', {
            model: "text-embedding-3-small",
            input: message,
            dimensions: 768
        }, apiKey);

        const queryEmbedding = embeddingResult.data[0].embedding;

        if (!queryEmbedding) return "";

        // 3. Search Database (RPC)
        const { data: searchResults, error } = await supabase.rpc('match_knowledge', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 3
        });

        if (error) {
            console.error("Vector search error:", error);
            return "";
        }

        if (searchResults && searchResults.length > 0) {
            return searchResults.map((r: any) => r.content).join("\n\n---\n\n");
        }

        return "";
    } catch (error) {
        console.error("Context retrieval failed:", error);
        return "";
    }
};

// --- 3. RESPONSE GENERATION (REAL ESTATE PERSONA) ---
export const generateRealEstateResponse = async (
    userMessage: string, 
    intent: RealEstateIntent, 
    context: string,
    systemInstruction: string,
    apiKey?: string
): Promise<string> => {
    try {
        let specificGuidance = "";
        switch (intent) {
            case 'Price/Availability':
                specificGuidance = "Be transparent but persuasive. If exact price isn't in context, give a range and ask to schedule a call.";
                break;
            case 'Booking/Viewing':
                specificGuidance = "Prioritize securing the appointment. Offer specific slots if data available, or ask for their availability immediately.";
                break;
            case 'Complaint':
                specificGuidance = "Be empathetic, apologize professionally, and assure them a human agent will take over.";
                break;
            default:
                specificGuidance = "Keep it professional, helpful, and concise.";
        }

        const systemPrompt = `
            ${systemInstruction}

            CONTEXT & RULES:
            You are an expert Real Estate Agent AI.
            User Intent: ${intent}
            Specific Guidance: ${specificGuidance}
            
            Use the following retrieved knowledge to answer the user's question accurately.
            If the answer is NOT in the knowledge base, politely admit it and ask to connect them to a human agent.
            DO NOT invent facts about the property.
            
            KNOWLEDGE BASE:
            ${context || "No specific documents found."}
        `;

        const response = await invokeAI('chat', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.7,
        }, apiKey);

        return response.choices[0]?.message?.content || "I am having trouble processing that request. Let me connect you to a human agent.";

    } catch (error: any) {
        console.error("Response generation failed:", error);
        return `System Error: ${error.message || "Unable to generate response."}`;
    }
};

// --- 4. MAIN PIPELINE ---
export const processIncomingMessage = async (
    userMessage: string,
    userId: string,
    systemInstruction: string,
    apiKey?: string
) => {
    // Step 1: Tagging
    const intent = await classifyIntent(userMessage, apiKey);

    // Step 2: Context
    const context = await retrieveContext(userId, userMessage, apiKey);

    // Step 3: Reply
    const reply = await generateRealEstateResponse(userMessage, intent, context, systemInstruction, apiKey);

    return {
        intent,
        reply,
        contextUsed: !!context
    };
};
