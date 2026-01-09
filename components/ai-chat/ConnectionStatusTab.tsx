
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

// --- DOCUMENT GENERATOR EDGE FUNCTION ---
const DOC_GEN_CODE = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

    // Simulation of Doc Generation
    console.log("Generating document for:", data.buyer?.name)
    
    // Mock Public URL
    const publicUrl = \`https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?id=\${record_id}\`

    // Update Database Record
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
/* CONFIG */
/* ───────────────────────────── */
const RESPONSE_FORMAT_JSON = {
  intent: "string",
  reply: "string",
  action: {
    type: "SCHEDULE_VIEWING | PROPERTY_INQUIRY | NONE",
    reason: "string | null",
    parameters: {
      appointmentDate: "ISO8601 string (e.g. 2024-01-01T10:00:00Z) | null",
      propertyInterest: "string | null"
    }
  }
}

/* ───────────────────────────── */
/* UTILITIES */
/* ───────────────────────────── */
function safeParseAIJson(raw: string) {
  const cleaned = raw.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    try {
      const start = cleaned.indexOf("{")
      const end = cleaned.lastIndexOf("}")
      if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1))
    } catch {}
    return {
      intent: "General Chat",
      reply: cleaned,
      action: { type: "NONE" }
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms = 15_000): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ])
}

/* ───────────────────────────── */
/* SERVER */
/* ───────────────────────────── */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }
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

    /* 1. GET MERCHANT PROFILE */
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("twilio_phone_number", merchantPhone)
      .single()

    if (!profile) return new Response("Profile not found", { status: 404 })

    /* 2. GET SETTINGS & SCHEDULE */
    const { data: settings } = await supabase
      .from("user_settings")
      .select("system_instruction, model")
      .eq("user_id", profile.id)
      .single()

    // Fetch busy slots (Future appointments)
    const now = new Date()
    const { data: busySlots } = await supabase
      .from("leads")
      .select("next_appointment")
      .eq("user_id", profile.id)
      .gt("next_appointment", now.toISOString())
      .order("next_appointment", { ascending: true })
      .limit(10)

    const scheduleContext = busySlots?.map((s: any) => 
      "- " + new Date(s.next_appointment).toLocaleString("en-US", { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + " (Busy)"
    ).join("\\n") || "No upcoming appointments."

    /* 3. RAG RETRIEVAL */
    let knowledgeContext = ""
    try {
      const embeddingResp = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: incomingMsg
      })
      const { data: chunks } = await supabase.rpc("match_knowledge", {
        query_embedding: embeddingResp.data[0].embedding,
        match_threshold: 0.5,
        match_count: 3
      })
      if (chunks?.length) knowledgeContext = chunks.map((c: any) => c.content).join("\\n\\n")
    } catch (e) { console.error("RAG Error", e) }

    /* 4. BUILD PROMPT */
    const systemPrompt = \`
\${settings?.system_instruction || "You are a helpful real estate assistant."}

CONTEXT:
Today is \${now.toLocaleString()}.
\${knowledgeContext ? "Use this knowledge: " + knowledgeContext : ""}

AVAILABILITY (You MUST check this):
\${scheduleContext}

INSTRUCTIONS:
1. If the user asks for property recommendations, provide them based on knowledge.
2. If the user wants to book a viewing, CHECK the Availability above.
   - If slot is busy, decline politely.
   - If slot is free, confirm the booking in your reply.
3. Respond in VALID JSON format.

JSON STRUCTURE:
\${JSON.stringify(RESPONSE_FORMAT_JSON)}
\`

    /* 5. FETCH HISTORY */
    const { data: history } = await supabase
      .from("messages")
      .select("text, sender")
      .eq("user_id", profile.id)
      .eq("phone", senderPhone)
      .order("created_at", { ascending: false })
      .limit(8)

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).reverse().map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      })),
      { role: "user", content: incomingMsg }
    ]

    /* 6. CALL AI */
    const completion = await withTimeout(openai.chat.completions.create({
      model: settings?.model || "gpt-4o-mini",
      messages: messages as any,
      temperature: 0.3,
      response_format: { type: "json_object" }
    }))

    const rawContent = completion.choices[0].message.content || ""
    const aiResponse = safeParseAIJson(rawContent)
    let finalReply = aiResponse.reply

    /* 7. HANDLE ACTIONS (DB UPDATES) */
    const action = aiResponse.action
    
    // CRM: Create Lead if not exists
    let { data: lead } = await supabase.from('leads').select('id, tags').eq('user_id', profile.id).eq('phone', senderPhone).maybeSingle()
    if (!lead) {
       const { data: newLead } = await supabase.from('leads').insert({
           user_id: profile.id, phone: senderPhone, name: "Lead " + senderPhone, status: 'New'
       }).select().single()
       lead = newLead
    }

    // CRM: Booking Logic
    if (action?.type === 'SCHEDULE_VIEWING' && action.parameters?.appointmentDate) {
        const apptDate = new Date(action.parameters.appointmentDate)
        
        // Final Double Check (Concurrency)
        const { data: conflict } = await supabase.from('leads')
            .select('id')
            .eq('user_id', profile.id)
            .neq('id', lead.id) // ignore self
            .gte('next_appointment', apptDate.toISOString())
            .lt('next_appointment', new Date(apptDate.getTime() + 60*60*1000).toISOString()) // 1hr slot
            .maybeSingle()

        if (conflict) {
            finalReply = "I apologize, but that slot was just taken. Could we try another time?"
        } else {
            await supabase.from('leads').update({
                next_appointment: apptDate.toISOString(),
                status: 'Proposal',
                ai_analysis: 'Booking Confirmed via WhatsApp'
            }).eq('id', lead.id)
        }
    }

    // CRM: Interest Tagging
    if (action?.parameters?.propertyInterest && lead) {
        const currentTags = lead.tags || []
        if (!currentTags.includes(action.parameters.propertyInterest)) {
            await supabase.from('leads').update({
                tags: [...currentTags, action.parameters.propertyInterest]
            }).eq('id', lead.id)
        }
    }

    /* 8. SAVE LOGS */
    await supabase.from("messages").insert([
      { user_id: profile.id, phone: senderPhone, sender: "user", direction: "inbound", text: incomingMsg, intent_tag: aiResponse.intent },
      { user_id: profile.id, phone: senderPhone, sender: "bot", direction: "outbound", text: finalReply }
    ])

    /* 9. RETURN TWIML */
    return new Response(
      \`<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>\${finalReply}</Body></Message></Response>\`,
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
