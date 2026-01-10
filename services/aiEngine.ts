
import { supabase } from './supabase';

// --- Action Types ---
export type ActionType = 'NONE' | 'QUALIFY_LEAD' | 'REQUEST_VIEWING' | 'SCHEDULE_VIEWING' | 'RESCHEDULE_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'HANDOVER_TO_AGENT';

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

// --- LEAD SCORING SYSTEM ---

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
 * Used by CRM Page.
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
