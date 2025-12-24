
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
const invokeAI = async (action: 'chat' | 'embedding', payload: any, apiKey?: string) => {
    console.log(`[AI Engine] 🚀 Invoking Edge Function 'openai-proxy' for action: '${action}'`);

    if (!supabase) {
        console.error("[AI Engine] ❌ Supabase client is not initialized.");
        throw new Error("Supabase client not initialized");
    }

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { action, apiKey, ...payload }
    });

    // 1. Handle Transport/Network Errors (e.g. 404 Not Found, 500 Server Error)
    if (error) {
        console.error(`[AI Engine] ❌ Edge Function Transport Error:`, error);
        
        // Check for specific "Function not found" (404) which appears as non-2xx
        const msg = error.message || '';
        if (msg.includes('non-2xx') || msg.includes('not found')) {
             throw new Error("CRITICAL: 'openai-proxy' function not found. Did you deploy it? Run: 'supabase functions deploy openai-proxy'");
        }
        
        throw new Error(`Edge Function Error: ${msg}`);
    }

    // 2. Handle Logic Errors returned by the function (e.g. Missing API Key)
    // We updated the proxy to return { error: "message" } with 200 OK to allow reading the message.
    if (data && data.error) {
        console.error(`[AI Engine] ⚠️ Function Logic Error:`, data.error);
        throw new Error(`AI Error: ${data.error}`);
    }

    console.log(`[AI Engine] ✅ Success`, data);
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

        // Safety check for response structure
        if (!response.choices || !response.choices[0]) {
             throw new Error("Invalid response format from AI");
        }

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

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', userId)
            .single();

        if (!profile?.organization_id) {
            return "";
        }

        const embeddingResult = await invokeAI('embedding', {
            model: "text-embedding-3-small",
            input: message,
            dimensions: 768
        }, apiKey);
        
        if (!embeddingResult.data || !embeddingResult.data[0]) {
            return "";
        }

        const queryEmbedding = embeddingResult.data[0].embedding;

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

// --- 3. RESPONSE GENERATION ---
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

        return response.choices[0]?.message?.content || "I am having trouble processing that request.";

    } catch (error: any) {
        console.error("Response generation failed:", error);
        // Return the actual error message so the user sees it in the chat bubble
        return `System Error: ${error.message}`;
    }
};

// --- 4. MAIN PIPELINE ---
export const processIncomingMessage = async (
    userMessage: string,
    userId: string,
    systemInstruction: string,
    apiKey?: string
) => {
    console.log("[AI Engine] Starting processing pipeline...");
    
    const intent = await classifyIntent(userMessage, apiKey);
    const context = await retrieveContext(userId, userMessage, apiKey);
    const reply = await generateRealEstateResponse(userMessage, intent, context, systemInstruction, apiKey);

    return {
        intent,
        reply,
        contextUsed: !!context
    };
};
