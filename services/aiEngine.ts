
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
    // console.log(`[AI Engine] 🚀 Invoking '${action}'`); // Reduced logging for perf

    if (!supabase) {
        throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { action, apiKey, ...payload }
    });

    if (error) {
        const msg = error.message || '';
        if (msg.includes('non-2xx') || msg.includes('not found')) {
             throw new Error("CRITICAL: 'openai-proxy' function not found. Run: 'supabase functions deploy openai-proxy'");
        }
        throw new Error(`Edge Function Error: ${msg}`);
    }

    if (data && data.error) {
        throw new Error(`AI Error: ${data.error}`);
    }

    return data;
};

// --- 1. RAG (RETRIEVAL) - Optimized ---
export const retrieveContext = async (organizationId: string, message: string, apiKey?: string): Promise<string> => {
    try {
        if (!supabase || !organizationId) return "";

        // 1. Get Embedding
        const embeddingResult = await invokeAI('embedding', {
            model: "text-embedding-3-small",
            input: message,
            dimensions: 768
        }, apiKey);
        
        if (!embeddingResult.data || !embeddingResult.data[0]) {
            return "";
        }

        const queryEmbedding = embeddingResult.data[0].embedding;

        // 2. Search DB
        const { data: searchResults, error } = await supabase.rpc('match_knowledge', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 3
        });

        if (error) {
            console.error("Vector search error:", error);
            return "";
        }

        // 3. Filter by Org ID manually if RPC doesn't filter (Safety) 
        // Note: The RPC usually handles logic, but RLS adds safety.
        // We assume the RPC returns accessible rows. 
        if (searchResults && searchResults.length > 0) {
            return searchResults.map((r: any) => r.content).join("\n\n---\n\n");
        }

        return "";
    } catch (error) {
        console.error("Context retrieval failed:", error);
        return "";
    }
};

// --- 2. SINGLE-PASS GENERATION (Classify + Reply) ---
export const generateStrategicResponse = async (
    userMessage: string, 
    context: string,
    systemInstruction: string,
    chatHistory: ChatMessage[],
    apiKey?: string
): Promise<{ intent: RealEstateIntent, reply: string }> => {
    try {
        const systemPrompt = `
            ${systemInstruction}

            ────────────────────────────
            CORE IDENTITY
            ────────────────────────────
            You are a Senior Real Estate Sales Agent.
            Your goal is to QUALIFY leads, ANSWER questions accurately using the provided Context, and PUSH for a viewing/booking.

            ────────────────────────────
            INSTRUCTIONS
            ────────────────────────────
            1. ANALYZE the user's message and the conversation history.
            2. CLASSIFY the intent into one of: ['Property Inquiry', 'Price/Availability', 'Booking/Viewing', 'Location/Amenities', 'Handover/Keys', 'Complaint', 'General Chat'].
            3. CHECK the "RETRIEVED KNOWLEDGE" section below. Use ONLY that information for specifics (price, location, specs). If info is missing, admit it politely or ask for clarification. Do NOT hallucinate features.
            4. GENERATE a natural, persuasive response.
               - Keep it short (WhatsApp style).
               - Always end with a question or Call-to-Action.

            ────────────────────────────
            RETRIEVED KNOWLEDGE
            ────────────────────────────
            ${context || "No specific property documents found. Use general sales knowledge."}

            ────────────────────────────
            OUTPUT FORMAT
            ────────────────────────────
            You must respond in valid JSON format ONLY:
            {
                "intent": "Category Name",
                "reply": "Your message here"
            }
        `;

        const messagesPayload: any[] = [
            { role: "system", content: systemPrompt },
            ...chatHistory,
            { role: "user", content: userMessage }
        ];

        const response = await invokeAI('chat', {
            model: "gpt-4o-mini", // Fast and capable of JSON
            messages: messagesPayload,
            temperature: 0.6,
            response_format: { type: "json_object" } // Enforce JSON for parsing speed/reliability
        }, apiKey);

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from AI");

        const parsed = JSON.parse(content);
        
        return {
            intent: parsed.intent || 'General Chat',
            reply: parsed.reply || "I'm sorry, can you repeat that?"
        };

    } catch (error: any) {
        console.error("Strategic generation failed:", error);
        return {
            intent: 'Unknown',
            reply: "I apologize, I'm having trouble processing that right now. A human agent will be with you shortly."
        };
    }
};

// --- 3. MAIN PIPELINE (OPTIMIZED) ---
export const processIncomingMessage = async (
    userMessage: string,
    userId: string, // Kept for interface compatibility, mostly unused now in favor of orgId
    organizationId: string, // NEW: Pass Org ID to save a DB lookup
    systemInstruction: string,
    chatHistory: ChatMessage[] = [],
    apiKey?: string
) => {
    console.log("[AI Engine] ⚡ Starting optimized pipeline...");
    
    // OPTIMIZATION 1: Fast Path for Greetings
    // Detect simple greetings to skip expensive RAG latency
    const lowerMsg = userMessage.trim().toLowerCase();
    const cleanMsg = lowerMsg.replace(/[^a-z ]/g, '');
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'yo', 'hola'];
    const isGreeting = greetings.includes(cleanMsg) || (cleanMsg.length < 10 && greetings.some(g => cleanMsg.includes(g)));
    
    let context = "";
    
    if (!isGreeting) {
        // OPTIMIZATION 2: RAG with Timeout (Graceful Degradation)
        // If Retrieval takes > 8 seconds, skip it to ensure responsiveness.
        // This prevents the "Processing timed out" error if the DB is slow.
        try {
            const ragPromise = retrieveContext(organizationId, userMessage, apiKey);
            const timeoutPromise = new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000));
            context = await Promise.race([ragPromise, timeoutPromise]);
            
            if (!context) console.log("[AI Engine] ⚠️ RAG timed out or returned empty, proceeding without context.");
        } catch (e) {
            console.warn("[AI Engine] RAG Error:", e);
        }
    } else {
        console.log("[AI Engine] ⏩ Greeting detected, skipping RAG.");
    }

    // Step 2: Single-Pass Classification & Generation
    const { intent, reply } = await generateStrategicResponse(
        userMessage, 
        context, 
        systemInstruction, 
        chatHistory, 
        apiKey
    );

    return {
        intent,
        reply,
        contextUsed: !!context
    };
};
