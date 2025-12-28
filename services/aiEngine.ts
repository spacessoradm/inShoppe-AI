
import { supabase } from './supabase';
import { buildRealEstateSystemPrompt } from './aiPrompts';

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

// --- Action Types ---
export type ActionType = 'NONE' | 'QUALIFY_LEAD' | 'REQUEST_VIEWING' | 'SCHEDULE_VIEWING' | 'HANDOVER_TO_AGENT';

export interface ActionDecision {
    type: ActionType;
    confidence: number;
    reason: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// --- Helper: Call AI Proxy ---
const invokeAI = async (action: 'chat' | 'embedding', payload: any, apiKey?: string) => {
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

        if (searchResults && searchResults.length > 0) {
            return searchResults.map((r: any) => r.content).join("\n\n---\n\n");
        }

        return "";
    } catch (error) {
        console.error("Context retrieval failed:", error);
        return "";
    }
};

// --- 2. SINGLE-PASS GENERATION (Classify + Reply + Action) ---
export const generateStrategicResponse = async (
    userMessage: string, 
    context: string,
    systemInstruction: string,
    chatHistory: ChatMessage[],
    apiKey?: string
): Promise<{ intent: RealEstateIntent, reply: string, action: ActionDecision }> => {
    try {
        // Build the strict prompt using the helper
        const systemPrompt = buildRealEstateSystemPrompt(systemInstruction, context);

        const messagesPayload: any[] = [
            { role: "system", content: systemPrompt },
            ...chatHistory,
            { role: "user", content: userMessage }
        ];

        const response = await invokeAI('chat', {
            model: "gpt-4o-mini",
            messages: messagesPayload,
            temperature: 0.4, // Lower temperature for stricter adherence to boundary rules
            response_format: { type: "json_object" }
        }, apiKey);

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from AI");

        const parsed = JSON.parse(content);
        
        return {
            intent: parsed.intent || 'General Chat',
            reply: parsed.reply || "I'm sorry, can you repeat that?",
            action: parsed.action || { type: 'NONE', confidence: 0, reason: 'Fallback default' }
        };

    } catch (error: any) {
        console.error("Strategic generation failed:", error);
        return {
            intent: 'Unknown',
            reply: "I apologize, I'm having trouble processing that right now. A human agent will be with you shortly.",
            action: { type: 'HANDOVER_TO_AGENT', confidence: 1, reason: 'System error' }
        };
    }
};

// --- 3. LEAD SCORING ---
export const analyzeLeadPotential = async (
    chatHistory: { role: string, content: string }[],
    apiKey?: string
): Promise<{ score: number, analysis: string }> => {
    try {
        const systemPrompt = `
            You are a Sales Manager AI.
            Your job is to analyze a conversation transcript and Score the Lead based on "Purchase Intent".
            
            SCORING CRITERIA (0-100):
            - 90-100: Ready to buy/book immediately. Explicitly asking for payment link or appointment.
            - 70-89: High interest. Asking specific questions about price, location, specs. Engaged.
            - 40-69: Moderate. Just browsing, asking general questions.
            - 0-39: Low. Unresponsive, complaining, or wrong number.

            INPUT:
            Conversation History.

            OUTPUT JSON:
            {
                "score": number, // 0 to 100
                "analysis": "Short 1-sentence reason"
            }
        `;

        // If no history, default score
        if (!chatHistory || chatHistory.length === 0) {
            return { score: 0, analysis: "No conversation history found." };
        }

        const recentHistory = chatHistory.slice(-15);

        const response = await invokeAI('chat', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: JSON.stringify(recentHistory) }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        }, apiKey);

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty analysis from AI");

        const parsed = JSON.parse(content);
        return {
            score: parsed.score || 0,
            analysis: parsed.analysis || "Analysis failed."
        };

    } catch (error) {
        console.error("Lead scoring failed:", error);
        return { score: 0, analysis: "AI Analysis currently unavailable." };
    }
};

// --- 4. MAIN PIPELINE (OPTIMIZED) ---
export const processIncomingMessage = async (
    userMessage: string,
    userId: string,
    organizationId: string,
    systemInstruction: string,
    chatHistory: ChatMessage[] = [],
    apiKey?: string
) => {
    console.log("[AI Engine] ⚡ Starting optimized pipeline...");
    
    // OPTIMIZATION 1: Fast Path for Greetings
    const lowerMsg = userMessage.trim().toLowerCase();
    const cleanMsg = lowerMsg.replace(/[^a-z ]/g, '');
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'yo', 'hola'];
    const isGreeting = greetings.includes(cleanMsg) || (cleanMsg.length < 10 && greetings.some(g => cleanMsg.includes(g)));
    
    let context = "";
    
    if (!isGreeting) {
        // OPTIMIZATION 2: RAG with Timeout
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

    // Step 2: Single-Pass Classification & Generation using Strict Real Estate Logic
    const { intent, reply, action } = await generateStrategicResponse(
        userMessage, 
        context, 
        systemInstruction, 
        chatHistory, 
        apiKey
    );

    return {
        intent,
        reply,
        action,
        contextUsed: !!context
    };
};
