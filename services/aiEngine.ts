
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

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

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
    chatHistory: ChatMessage[],
    apiKey?: string
): Promise<string> => {
    try {
        // --- Intent-Aware Guidance Rules ---
        let specificGuidance = "";
        switch (intent) {
            case 'Property Inquiry':
                specificGuidance = "GOAL: Clarify requirements (budget, location, timeline). Narrow options. Offer a viewing proactively.";
                break;
            case 'Price/Availability':
                specificGuidance = "GOAL: Be transparent. If exact data is missing, give a reasonable range based on market knowledge. PUSH toward a booking or agent call.";
                break;
            case 'Booking/Viewing':
                specificGuidance = "GOAL: HIGH PRIORITY. Secure the appointment immediately. Offer specific time options if possible. Do not delay.";
                break;
            case 'Location/Amenities':
                specificGuidance = "GOAL: Answer briefly, then link the benefit to lifestyle or investment value. Transition immediately to a viewing offer.";
                break;
            case 'Complaint':
                specificGuidance = "GOAL: Acknowledge emotionally. Apologize professionally. State clearly that a human agent will follow up. Do not argue.";
                break;
            case 'General Chat':
                specificGuidance = "GOAL: Redirect the conversation gently toward property intent, qualification, or seeing a unit.";
                break;
            default:
                specificGuidance = "GOAL: Qualify the lead and advance them to the next step.";
        }

        // --- Engineered System Prompt ---
        const systemPrompt = `
            ${systemInstruction}

            ────────────────────────────
            CORE IDENTITY & OBJECTIVE
            ────────────────────────────
            You are NOT a generic chatbot. You are a Senior Real Estate Sales Agent.
            Your primary objective is to QUALIFY leads, ADVANCE them to the next step, and SECURE VIEWINGS.
            
            ────────────────────────────
            CORE BEHAVIOR RULES
            ────────────────────────────
            1. PROGRESSION FIRST: Every response must aim to move the user closer to a booking, contact exchange, or sale.
            2. GUIDE THE CHAT: Do not wait passively for information. If data is missing, propose the next best action.
            3. PROFESSIONAL TONE: Be confident, helpful, and conversion-oriented. Never say "I am an AI".
            4. KNOWLEDGE HANDLING: If the specific answer is not in the knowledge base, provide a reasonable market assumption or range, then immediately propose a next step (e.g., "I can check the exact figure, but shall we book a viewing to see the unit first?"). Do NOT hallucinate specific property specs.

            ────────────────────────────
            CURRENT INTENT: ${intent}
            SPECIFIC GUIDANCE: ${specificGuidance}
            ────────────────────────────

            ────────────────────────────
            RETRIEVED KNOWLEDGE BASE
            ────────────────────────────
            ${context || "No specific property documents found. Rely on general real estate best practices."}

            ────────────────────────────
            FINAL OUTPUT RULES
            ────────────────────────────
            - Keep it conversational and natural (WhatsApp style).
            - Short paragraphs.
            - ALWAYS include a clear Call-to-Action (question, booking offer, or next step).
            - If you fail to move the lead forward, you have failed your objective.
        `;

        // Compose messages with history
        const messagesPayload: any[] = [
            { role: "system", content: systemPrompt },
            ...chatHistory, // Previous conversation context
            { role: "user", content: userMessage } // Current message
        ];

        const response = await invokeAI('chat', {
            model: "gpt-4o-mini",
            messages: messagesPayload,
            temperature: 0.6, // Slightly lower temperature for more focused sales behavior
        }, apiKey);

        return response.choices[0]?.message?.content || "I am having trouble processing that request. Let me connect you to a human agent.";

    } catch (error: any) {
        console.error("Response generation failed:", error);
        return `System Error: ${error.message}`;
    }
};

// --- 4. MAIN PIPELINE ---
export const processIncomingMessage = async (
    userMessage: string,
    userId: string,
    systemInstruction: string,
    chatHistory: ChatMessage[] = [],
    apiKey?: string
) => {
    console.log("[AI Engine] Starting processing pipeline...");
    
    // Step 1: Run Classification and Context Retrieval in PARALLEL to save time
    const [intent, context] = await Promise.all([
        classifyIntent(userMessage, apiKey),
        retrieveContext(userId, userMessage, apiKey)
    ]);

    // Step 2: Generate Response using results from Step 1 AND chat history
    const reply = await generateRealEstateResponse(userMessage, intent, context, systemInstruction, chatHistory, apiKey);

    return {
        intent,
        reply,
        contextUsed: !!context
    };
};
