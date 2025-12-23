
import OpenAI from 'openai';
import { supabase } from './supabase';

const getOpenAIClient = () => {
    // 1. Try Local Storage (User Input in UI) - Priority #1
    //let apiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('openai_api_key') : null;
    let apiKey = "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";

    // 2. Try Specific Environment Variable (Vite) - Priority #2
    if (!apiKey) {
        // @ts-ignore
        apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    }

    // 3. Fallback to generic API_KEY ONLY if it looks like an OpenAI key (starts with sk-)
    if (!apiKey && process.env.API_KEY && process.env.API_KEY.startsWith('sk-')) {
        apiKey = process.env.API_KEY;
    }

    if (!apiKey) {
        console.error("OpenAI API Key is missing.");
        throw new Error("OpenAI API Key is missing. Please enter it in the Config settings.");
    }

    // CRITICAL: Trim whitespace to prevent 401 errors from copy-paste
    return new OpenAI({ 
        apiKey: apiKey.trim(), 
        dangerouslyAllowBrowser: true 
    });
};


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

// --- 1. INTENT CLASSIFICATION ---
export const classifyIntent = async (message: string): Promise<RealEstateIntent> => {
    try {
        const openai = getOpenAIClient();
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Attempt efficient model
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
        });

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
        // Fallback to General Chat instead of Unknown to allow flow to continue smoothly
        return 'General Chat'; 
    }
};

// --- 2. RAG (RETRIEVAL) ---
export const retrieveContext = async (userId: string, message: string): Promise<string> => {
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

        const openai = getOpenAIClient();
        
        // 2. Create Embedding using OpenAI
        const embeddingResult = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: message,
            dimensions: 768
        });
        const queryEmbedding = embeddingResult.data[0].embedding;

        if (!queryEmbedding) return "";

        // 3. Search Database
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
    systemInstruction: string
): Promise<string> => {
    try {
        const openai = getOpenAIClient();

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

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Keep 4o-mini, but ensure key is correct
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.7,
        });

        return response.choices[0]?.message?.content || "I am having trouble processing that request. Let me connect you to a human agent.";

    } catch (error: any) {
        console.error("Response generation failed:", error);
        // Return the actual error message to the chat for debugging
        if (error?.status === 401) return "System Error: 401 Unauthorized. Please check your OpenAI API Key in Config.";
        if (error?.status === 429) return "System Error: 429 Rate Limit Exceeded. Check your OpenAI quota.";
        if (error?.status === 404) return "System Error: 404 Model Not Found. Your key may not have access to gpt-4o-mini.";
        
        return `System Error: ${error.message || "Unable to generate response."}`;
    }
};

// --- 4. MAIN PIPELINE ---
export const processIncomingMessage = async (
    userMessage: string,
    userId: string,
    systemInstruction: string
) => {
    // Step 1: Tagging
    const intent = await classifyIntent(userMessage);

    // Step 2: Context
    const context = await retrieveContext(userId, userMessage);

    // Step 3: Reply
    const reply = await generateRealEstateResponse(userMessage, intent, context, systemInstruction);

    return {
        intent,
        reply,
        contextUsed: !!context
    };
};
