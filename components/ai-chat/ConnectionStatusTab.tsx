
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

// --- DOCUMENT GENERATOR EDGE FUNCTION ---
const DOC_GEN_CODE = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// Note: In a real Deno environment, we would import a docx library compatible with Deno/Web Standards.
// For this example, we'll simulate the logic or use a text-replacement approach if libraries are heavy.
// A common approach is using 'docxtemplater' via a CDN that supports Deno, or a simple unzip/xml-replace/zip approach.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record_id, template_id, data } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch Template (In a real app, download from Storage)
    // const { data: templateData } = await supabaseClient.storage.from('documents').download('templates/SPA_Template.docx')
    
    // 2. Process Document (Simulated here for brevity)
    console.log("Generating document for:", data.buyer?.name)
    
    // 3. Upload Result (Simulated)
    // const { data: uploadData } = await supabaseClient.storage.from('documents').upload(\`generated/\${record_id}.docx\`, generatedBuffer)
    
    // 4. Get Public URL
    const publicUrl = \`https://placeholder-url.com/docs/\${record_id}.docx\` // Replace with actual storage.getPublicUrl

    // 5. Update Database Record
    await supabaseClient
      .from('generated_documents')
      .update({ 
        status: 'generated',
        file_url: publicUrl 
      })
      .eq('id', record_id)

    return new Response(
      JSON.stringify({ success: true, url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
`;

// --- EDGE FUNCTION CODE SNIPPET (SERVER-SIDE AI WORKER) ---
const EDGE_FUNCTION_CODE = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from "https://esm.sh/openai@4.28.0"

/* ───────────────────────────── */
/* ENV */
/* ───────────────────────────── */
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? ""

/* ───────────────────────────── */
/* RESPONSE FORMAT */
/* ───────────────────────────── */
const RESPONSE_FORMAT_JSON = {
  intent: "string",
  reply: "string",
  action: {
    type: "string | null",
    reason: "string | null",
    parameters: "object | null"
  }
}

/* ───────────────────────────── */
/* UTILITIES */
/* ───────────────────────────── */

// Hard JSON enforcement + auto repair
function safeParseAIJson(raw: string) {
  const cleaned = raw
    .replace(/\`\`\`json/g, "")
    .replace(/\`\`\`/g, "")
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    try {
      const start = cleaned.indexOf("{")
      const end = cleaned.lastIndexOf("}")
      if (start !== -1 && end !== -1) {
        return JSON.parse(cleaned.slice(start, end + 1))
      }
    } catch {}

    return {
      intent: "GENERAL_INQUIRY",
      reply: cleaned,
      action: null
    }
  }
}

// Timeout protection
async function withTimeout<T>(promise: Promise<T>, ms = 12_000): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    )
  ])
}

// Retry once only
async function openaiWithRetry(fn: () => Promise<any>) {
  try {
    return await withTimeout(fn())
  } catch {
    console.warn("Retrying OpenAI once...")
    return await withTimeout(fn(), 10_000)
  }
}

// Language detection (CN / MS / EN only)
function detectLanguage(text: string): "zh" | "ms" | "en" {
  if (/[\\u4e00-\\u9fff]/.test(text)) return "zh"
  if (/\\b(apa|boleh|tolong|nak|berapa|harga|saya|kami|rumah|condo)\\b/i.test(text))
    return "ms"
  return "en"
}

/* ───────────────────────────── */
/* SYSTEM PROMPT */
/* ───────────────────────────── */
function buildSystemPrompt(
  baseInstruction: string,
  context: string,
  now: string
) {
  return [
    baseInstruction,
    "",
    "IMPORTANT:",
    "You MUST respond in VALID JSON only.",
    "If JSON is invalid, your response will be rejected.",
    "",
    "Current time:",
    now,
    "",
    "You are a professional Senior Real Estate Consultant.",
    "Tone: warm, confident, human.",
    "Never say you are an AI.",
    "",
    "Use retrieved inventory below if available.",
    "",
    "RETRIEVED INVENTORY:",
    context || "No inventory found.",
    "",
    "JSON FORMAT:",
    JSON.stringify(RESPONSE_FORMAT_JSON)
  ].join("\\n")
}

/* ───────────────────────────── */
/* SERVER */
/* ───────────────────────────── */
serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    })
  }

  try {
    const formData = await req.formData()
    const incomingMsg = formData.get("Body")?.toString() || ""
    let senderPhone = formData.get("From")?.toString() || ""
    let merchantPhone = formData.get("To")?.toString() || ""

    senderPhone = senderPhone.replace(/^whatsapp:/, "")
    merchantPhone = merchantPhone.replace(/^whatsapp:/, "")

    if (!incomingMsg) return new Response("OK")

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openAiKey })

    /* ───────────────────────────── */
    /* MERCHANT PROFILE */
/* ───────────────────────────── */
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("twilio_phone_number", merchantPhone)
      .single()

    if (!profile) return new Response("Profile not found", { status: 404 })

    const { data: settings } = await supabase
      .from("user_settings")
      .select("system_instruction, model")
      .eq("user_id", profile.id)
      .single()

    const ALLOWED_MODELS = new Set(["gpt-4o-mini", "gpt-4o"])
    const modelToUse = ALLOWED_MODELS.has(settings?.model)
      ? settings.model
      : "gpt-4o-mini"

    /* ───────────────────────────── */
    /* LANGUAGE */
/* ───────────────────────────── */
    const detectedLang = detectLanguage(incomingMsg)
    const languageInstruction = {
      en: "Reply in English.",
      ms: "Balas dalam Bahasa Malaysia.",
      zh: "请用中文回复。"
    }[detectedLang]

    /* ───────────────────────────── */
    /* RAG */
/* ───────────────────────────── */
    let context = ""
    try {
      const embeddingResp = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: incomingMsg,
        dimensions: 768
      })

      const { data: chunks } = await supabase.rpc("match_knowledge", {
        query_embedding: embeddingResp.data[0].embedding,
        match_threshold: 0.5,
        match_count: 3
      })

      if (chunks?.length) {
        context = chunks.map((c: any) => c.content).join("\\n\\n")
      }
    } catch (e) {
      console.error("RAG error", e)
    }

    /* ───────────────────────────── */
    /* CHAT HISTORY */
/* ───────────────────────────── */
    const { data: history } = await supabase
      .from("messages")
      .select("text, sender")
      .eq("user_id", profile.id)
      .eq("phone", senderPhone)
      .order("created_at", { ascending: false })
      .limit(10)

    const messages = [
      {
        role: "system",
        content: buildSystemPrompt(
          \`\${settings?.system_instruction || ""}\\n\${languageInstruction}\`,
          context,
          new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        )
      },
      ...(history || []).reverse().map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      })),
      { role: "user", content: incomingMsg }
    ]

    /* ───────────────────────────── */
    /* OPENAI */
/* ───────────────────────────── */
    const completion = await openaiWithRetry(() =>
      openai.chat.completions.create({
        model: modelToUse,
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    )

    const rawContent =
      completion.choices?.[0]?.message?.content || ""

    const aiContent = safeParseAIJson(rawContent)

    /* ───────────────────────────── */
    /* CRM UPDATES (LEADS) */
    /* ───────────────────────────── */
    try {
        const action = aiContent.action;
        if (action && action.type !== 'NONE') {
            // Find existing lead
            const { data: lead } = await supabase
                .from('leads')
                .select('id, tags, status')
                .eq('user_id', profile.id)
                .eq('phone', senderPhone)
                .maybeSingle();

            if (lead) {
                const updates: any = {};
                
                // 1. Handle Booking / Schedule / Request
                if (['SCHEDULE_VIEWING', 'REQUEST_VIEWING', 'RESCHEDULE_APPOINTMENT'].includes(action.type)) {
                    updates.status = 'Proposal';
                    updates.ai_analysis = \`Booking Action: \${action.reason}\`;
                    if (action.parameters?.appointmentDate) {
                        updates.next_appointment = action.parameters.appointmentDate;
                    }
                }

                // 2. Handle Cancellation
                if (action.type === 'CANCEL_APPOINTMENT') {
                    updates.status = 'Qualified';
                    updates.next_appointment = null;
                    updates.ai_analysis = \`Cancelled: \${action.reason}\`;
                }

                // 3. Handle Property Interest (Tags)
                if (action.parameters?.propertyInterest) {
                    const newTag = action.parameters.propertyInterest;
                    const currentTags = lead.tags || [];
                    // Simple check to avoid duplicates
                    if (!currentTags.some((t: string) => t.toLowerCase() === newTag.toLowerCase())) {
                        updates.tags = [...currentTags, newTag];
                        updates.ai_analysis = (updates.ai_analysis || '') + \` | Interested in: \${newTag}\`;
                    }
                }

                // 4. Update Lead if needed
                if (Object.keys(updates).length > 0) {
                    await supabase
                        .from('leads')
                        .update(updates)
                        .eq('id', lead.id);
                }
            } else {
               // Optional: If lead doesn't exist yet (handled by trigger usually), 
               // we could create it here, but trigger is safer.
            }
        }
    } catch (crmErr) {
        console.error("CRM Update Error:", crmErr);
    }

    /* ───────────────────────────── */
    /* LOG MESSAGES */
/* ───────────────────────────── */
    await supabase.from("messages").insert([
      {
        user_id: profile.id,
        phone: senderPhone,
        sender: "user",
        direction: "inbound",
        text: incomingMsg,
        intent_tag: aiContent.intent
      },
      {
        user_id: profile.id,
        phone: senderPhone,
        sender: "bot",
        direction: "outbound",
        text: aiContent.reply
      }
    ])

    /* ───────────────────────────── */
    /* TWILIO RESPONSE */
/* ───────────────────────────── */
    return new Response(
      \`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
    <Body>\${aiContent.reply}</Body>
  </Message>
</Response>\`,
      { headers: { "Content-Type": "text/xml; charset=utf-8" } }
    )

  } catch (err: any) {
    console.error("Edge Function Error:", err)
    return new Response("Error", { status: 400 })
  }
})
`;

// --- OPENAI PROXY CODE SNIPPET (ROBUST VERSION) ---
const OPENAI_PROXY_CODE = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from 'https://esm.sh/openai@4.28.0'
import { load } from 'https://esm.sh/cheerio@1.0.0-rc.12'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text();
    if (!bodyText) throw new Error("Empty request body");
    
    const { action, apiKey, ...payload } = JSON.parse(bodyText);
    
    // 1. Resolve API Key (Only needed for AI actions)
    const finalApiKey = apiKey || Deno.env.get('OPENAI_API_KEY')
    
    if (!finalApiKey && (action === 'chat' || action === 'embedding')) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY. Set it in Supabase Secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      })
    }

    // 2. Route Action
    
    // --- SCRAPE ACTION ---
    if (action === 'scrape') {
      const { url } = payload;
      if (!url) throw new Error('URL is required');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); 

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return new Response(JSON.stringify({ text: "Error: Failed to fetch URL." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        
        const html = await response.text();
        const doc = load(html);
        
        doc('script, style, noscript, iframe, svg').remove();
        let text = doc('body').text();
        text = text.replace(new RegExp('[\\\\s\\\\n\\\\r]+', 'g'), ' ').trim();
        
        if (text.length > 25000) text = text.substring(0, 25000) + '...';
          
        return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      } catch (fetchErr) {
        return new Response(JSON.stringify({ text: "Error: " + fetchErr.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // --- AI ACTIONS ---
    const openai = new OpenAI({ apiKey: finalApiKey })

    if (action === 'chat') {
      const completion = await openai.chat.completions.create(payload)
      return new Response(JSON.stringify(completion), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'embedding') {
      const embedding = await openai.embeddings.create(payload)
      return new Response(JSON.stringify(embedding), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('Invalid action: ' + action)

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
`;

interface ConnectionStatusTabProps {
    webhookUrl: string;
    checkWebhookReachability: () => void;
    webhookStatus: 'idle' | 'checking' | 'success' | 'error';
}

export const ConnectionStatusTab: React.FC<ConnectionStatusTabProps> = ({
    webhookUrl,
    checkWebhookReachability,
    webhookStatus
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-6 m-0 h-full scrollbar-thin scrollbar-thumb-slate-200">
            <div className="max-w-3xl mx-auto space-y-6">
                <Card className="border border-slate-200 bg-white text-slate-900 shadow-sm">
                    <CardHeader><CardTitle>Webhook Connection</CardTitle><CardDescription>Test connectivity to your Supabase Edge Function.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input readOnly value={webhookUrl || "No URL Configured"} className="bg-slate-50 font-mono text-blue-600 border-slate-300" />
                            <Button onClick={checkWebhookReachability} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Test Ping</Button>
                        </div>
                        <div className="text-sm text-slate-500">
                            <p>Status: <span className={cn("font-bold", webhookStatus === 'success' ? "text-green-600" : webhookStatus === 'error' ? "text-red-600" : "text-slate-500")}>{webhookStatus}</span></p>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border border-blue-200 bg-blue-50 text-slate-900 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-blue-700">Required: OpenAI Proxy Function</CardTitle>
                        <CardDescription className="text-blue-600/70">
                            To fix CORS errors, you MUST deploy this function to Supabase as <code>openai-proxy</code>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-xs text-green-400 font-mono border border-slate-800 max-h-[300px] shadow-inner"><pre>{OPENAI_PROXY_CODE}</pre></div>
                        <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-500 text-white" onClick={() => navigator.clipboard.writeText(OPENAI_PROXY_CODE)}>Copy Function Code</Button>
                        <div className="mt-2 text-xs text-slate-500">
                            Deploy command: <code className="bg-slate-100 px-1 rounded border border-slate-200">supabase functions deploy openai-proxy --no-verify-jwt</code>
                        </div>
                        <div className="mt-4 text-xs text-slate-500 border-t border-blue-200 pt-2">
                            <strong>Setup API Key:</strong>
                            <br/>
                            Go to Supabase Dashboard &gt; Settings &gt; Edge Functions &gt; Add Secret.
                            <br/>
                            Name: <code>OPENAI_API_KEY</code>
                            <br/>
                            Value: <code>sk-...</code> (Your OpenAI Key)
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-purple-200 bg-purple-50 text-slate-900 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-purple-700">Optional: Document Generator</CardTitle>
                        <CardDescription className="text-purple-600/70">
                            Deploy this to enable auto-generation of SPAs and Invoices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-xs text-purple-300 font-mono border border-slate-800 max-h-[300px] shadow-inner"><pre>{DOC_GEN_CODE}</pre></div>
                        <Button size="sm" className="mt-2 bg-purple-600 hover:bg-purple-500 text-white" onClick={() => navigator.clipboard.writeText(DOC_GEN_CODE)}>Copy Generator Code</Button>
                        <div className="mt-2 text-xs text-slate-500">
                            Deploy command: <code className="bg-slate-100 px-1 rounded border border-slate-200">supabase functions deploy generate-document --no-verify-jwt</code>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-amber-200 bg-amber-50 text-slate-900 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-amber-700">Recommended: Server-Side AI Worker</CardTitle>
                        <CardDescription className="text-amber-600/70">
                            Deploy this code to handle Twilio webhooks directly. This ensures AI replies even if you close the dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-xs text-yellow-300 font-mono border border-slate-800 max-h-[300px] shadow-inner"><pre>{EDGE_FUNCTION_CODE}</pre></div>
                        <Button size="sm" className="mt-2 bg-amber-600 hover:bg-amber-500 text-white" onClick={() => navigator.clipboard.writeText(EDGE_FUNCTION_CODE)}>Copy Worker Code</Button>
                        <div className="mt-2 text-xs text-slate-500">
                            1. Deploy as <code>dynamic-endpoint</code> or <code>whatsapp-webhook</code>.<br/>
                            2. Set <code>OPENAI_API_KEY</code>, <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code> in Secrets.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
