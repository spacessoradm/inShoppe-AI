
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

// --- 3. LEAD SCORING SYSTEM ---

/**
 * Calculates score decay based on inactivity time.
 * deterministic, no AI calls.
 */
export const applyDeterministicDecay = (currentScore: number, lastContactedAt: string): number => {
    const now = new Date();
    const last = new Date(lastContactedAt);
    const diffTime = Math.abs(now.getTime() - last.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    let decay = 0;

    // Rule: ≥ 30 days inactive → mark as Cold (score ≤ 20)
    if (diffDays >= 30) {
        return Math.min(currentScore, 20);
    }
    // Rule: ≥ 14 days inactive → −20
    else if (diffDays >= 14) {
        decay = 20;
    }
    // Rule: ≥ 7 days inactive → −10
    else if (diffDays >= 7) {
        decay = 10;
    }
    // Rule: ≥ 3 days inactive → −5
    else if (diffDays >= 3) {
        decay = 5;
    }

    return Math.max(0, currentScore - decay);
};

/**
 * Core AI Analysis Function.
 * Calculates Purchase Intent based on conversation history.
 */
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

/**
 * Orchestrator for Real-Time Score Updates.
 * Decides IF scoring should run, checks throttling, and updates DB.
 */
const updateLeadScore = async (
    userId: string,
    phone: string,
    intent: RealEstateIntent,
    chatHistory: ChatMessage[],
    apiKey?: string
) => {
    // 1. Filter: Do NOT update score for low-signal messages
    const meaningfulIntents: RealEstateIntent[] = [
        'Price/Availability', 
        'Booking/Viewing', 
        'Property Inquiry',
        'Handover/Keys' // Often implies post-sales but high engagement
    ];

    if (!meaningfulIntents.includes(intent)) {
        // Just update timestamp for activity tracking
        if (supabase) {
            await supabase.from('leads')
                .update({ last_contacted_at: new Date().toISOString() })
                .match({ user_id: userId, phone: phone });
        }
        return;
    }

    // 2. Fetch current lead state
    if (!supabase) return;
    const { data: lead } = await supabase.from('leads')
        .select('ai_score, last_contacted_at')
        .match({ user_id: userId, phone: phone })
        .maybeSingle();

    if (!lead) return; // Lead doesn't exist yet (handled by DB triggers usually)

    // 3. Run AI Analysis
    const { score: newScore, analysis } = await analyzeLeadPotential(chatHistory, apiKey);

    // 4. Throttling: Only update if difference >= 5
    const currentScore = lead.ai_score || 0;
    if (Math.abs(newScore - currentScore) < 5) {
        // Update timestamp only
        await supabase.from('leads')
            .update({ last_contacted_at: new Date().toISOString() })
            .match({ user_id: userId, phone: phone });
        return;
    }

    // 5. Update DB
    await supabase.from('leads')
        .update({
            ai_score: newScore,
            ai_analysis: analysis,
            last_contacted_at: new Date().toISOString()
        })
        .match({ user_id: userId, phone: phone });
    
    console.log(`[Lead Score] Updated ${phone}: ${currentScore} -> ${newScore} (${analysis})`);
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
    
    // Extract phone from history or context if available (needed for scoring)
    // Note: In a real system, phone is passed explicitly. 
    // Here we assume the caller context or we might need to change signature in future.
    // For now, we rely on the DB triggers to handle lead creation, 
    // but scoring requires knowing WHICH lead. 
    // We'll extract phone from the 'user' object if accessible, but processIncomingMessage signature 
    // doesn't have phone. We will assume the caller handles the phone mapping or we skip scoring 
    // if phone isn't available in this scope. 
    // *Amendment*: The messages table has phone. The 'chatHistory' doesn't usually carry metadata.
    // We will proceed with generation, and assume the UI/Caller triggers scoring via side-effect 
    // OR we infer phone if possible. 
    
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

    // --- SCORE UPDATE TRIGGER ---
    // We need the phone number to update the specific lead.
    // Since 'processIncomingMessage' signature is fixed by previous constraints,
    // we look at the latest message in chatHistory or rely on the caller.
    // However, to satisfy the requirement "Real-Time Score Update", we attempt to find the phone.
    // The previous AIChatPage.tsx implementation calls this function.
    // We will attempt to run the scoring asynchronously if we can resolve the phone from context/DB later,
    // BUT since we can't change the signature, we expose the scoring logic for the caller to use,
    // OR we perform a best-effort lookup if userId is provided.
    
    // In this specific architecture, the Chat Page calls this. 
    // The Chat Page has the phone. Ideally, the Chat Page calls updateLeadScore.
    // However, to make this "Engine" robust, we return the intent so the UI can decide.
    // We ALSO perform a "Fire and Forget" update if we can identify the lead.
    // Since we don't have 'phone' argument, we skip the DB update *inside* this function 
    // to strictly adhere to "No Refactor of unrelated code" which might break the signature.
    // *Instead*, we rely on the `intent` return value which the caller (AIChatPage) 
    // can use to trigger `updateLeadScore` if it imports it.
    // To enable this, we export `updateLeadScore`.

    return {
        intent,
        reply,
        action,
        contextUsed: !!context
    };
};

export { updateLeadScore };
