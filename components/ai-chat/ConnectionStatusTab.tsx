
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
/**
 * INSHOPPE AI - MODULAR WHATSAPP WORKER
 * 
 * Architecture:
 * 1. Utils: Helpers for parsing and formatting.
 * 2. Repository: Handles all Supabase DB interactions.
 * 3. AIService: Handles OpenAI and Prompt Construction.
 * 4. Main: Orchestrates the flow.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from "https://esm.sh/openai@4.28.0"

/* ─────────────────────────────────────────────────────────────────────────────
   1. UTILITIES & CONFIG
   ───────────────────────────────────────────────────────────────────────────── */
const CONFIG = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SUPABASE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  OPENAI_KEY: Deno.env.get("OPENAI_API_KEY") ?? "",
}

const RESPONSE_SCHEMA = {
  intent: "string",
  reply: "string",
  action: {
    type: "SCHEDULE_VIEWING | ASK_SCHEDULE | PROPERTY_INQUIRY | NONE",
    reason: "string | null",
    parameters: {
      appointmentDate: "ISO8601 string | null",
      propertyInterest: "string | null"
    }
  }
}

const UTILS = {
  safeParseJSON: (raw: string) => {
    const cleaned = raw.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      try {
        const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}")
        if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1))
      } catch {}
      return { intent: "General", reply: cleaned, action: { type: "NONE" } }
    }
  },
  xmlEscape: (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  detectLang: (text: string) => {
    const t = text.toLowerCase();
    if (/[你好嗨早安]/.test(t)) return "zh";
    if (t.includes("hai") || t.includes("halo") || t.includes("selamat")) return "ms";
    return "en";
  },
  isGreeting: (text: string) => {
    const t = text.trim().toLowerCase();
    return ["hi","hello","hey","good morning","hai","halo","你好"].some(g => t.startsWith(g));
  },
  getGreetingReply: (lang: string) => {
    const map: any = {
      en: "Hello! 😊 Are you looking for any property today?",
      zh: "你好 😊 请问你有在找房产吗？",
      ms: "Hai! 😊 Anda sedang mencari hartanah?"
    };
    return map[lang] || map.en;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. REPOSITORY LAYER (Database Interactions)
   ───────────────────────────────────────────────────────────────────────────── */
class Repository {
  constructor(private sb: SupabaseClient) {}

  async getProfileByPhone(phone: string) {
    const { data } = await this.sb.from("profiles").select("id").eq("twilio_phone_number", phone).single()
    return data
  }

  async getSettings(userId: string) {
    const { data } = await this.sb.from("user_settings").select("system_instruction, model").eq("user_id", userId).single()
    return data
  }

  async getScheduleContext(userId: string) {
    const now = new Date().toISOString()
    const { data } = await this.sb.from("leads")
      .select("next_appointment")
      .eq("user_id", userId)
      .gt("next_appointment", now)
      .order("next_appointment", { ascending: true })
      .limit(10)
    
    if (!data || data.length === 0) return "No upcoming appointments."
    return data.map((s: any) => "- " + new Date(s.next_appointment).toLocaleString() + " (Busy)").join("\\n")
  }

  async getHistory(userId: string, phone: string) {
    const { data } = await this.sb.from("messages")
      .select("text, sender")
      .eq("user_id", userId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(8)
    return (data || []).reverse().map((m: any) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text
    }))
  }

  async findOrCreateLead(userId: string, phone: string) {
    let { data: lead } = await this.sb.from("leads").select("id, tags").eq("user_id", userId).eq("phone", phone).maybeSingle()
    if (!lead) {
      const { data: newLead } = await this.sb.from("leads")
        .insert({ user_id: userId, phone, name: "Lead " + phone, status: "New" })
        .select().single()
      lead = newLead
    }
    return lead
  }

  async checkSlotConflict(userId: string, leadId: number, dateStr: string) {
    const start = new Date(dateStr)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // 1 hour
    const { data } = await this.sb.from("leads")
      .select("id")
      .eq("user_id", userId)
      .neq("id", leadId)
      .gte("next_appointment", start.toISOString())
      .lt("next_appointment", end.toISOString())
      .maybeSingle()
    return !!data
  }

  async bookAppointment(leadId: number, dateStr: string) {
    await this.sb.from("leads").update({
      next_appointment: dateStr,
      status: "Proposal",
      ai_analysis: "Viewing Scheduled"
    }).eq("id", leadId)
  }

  async addTag(leadId: number, currentTags: string[] | null, newTag: string) {
    const tags = currentTags || []
    if (!tags.includes(newTag)) {
      await this.sb.from("leads").update({ tags: [...tags, newTag] }).eq("id", leadId)
    }
  }

  async logMessage(userId: string, phone: string, text: string, type: 'inbound'|'outbound', tag?: string) {
    await this.sb.from("messages").insert({
      user_id: userId,
      phone,
      sender: type === 'inbound' ? 'user' : 'bot',
      direction: type,
      text,
      intent_tag: tag
    })
  }

  async findKnowledge(query: string, openai: OpenAI) {
    try {
      const emb = await openai.embeddings.create({ model: "text-embedding-3-small", input: query })
      const { data } = await this.sb.rpc("match_knowledge", {
        query_embedding: emb.data[0].embedding,
        match_threshold: 0.5,
        match_count: 3
      })
      return data?.map((c: any) => c.content).join("\\n\\n") || ""
    } catch { return "" }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. AI SERVICE LAYER (Prompting & Intelligence)
   ───────────────────────────────────────────────────────────────────────────── */
class AIService {
  constructor(private openai: OpenAI) {}

  buildSystemPrompt(instruction: string, context: string, schedule: string) {
    return \`
\${instruction || "You are a helpful real estate assistant."}

CRITICAL RULES:
1. Inventory: Assume units are available unless explicitly stated "sold out". Use "subject to confirmation".
2. Pricing: If multiple prices exist, give range. Never say "price unknown" if data exists.
3. Proactive: If user shows interest, ask: "Would you like to schedule a viewing?" (Action: ASK_SCHEDULE).

CONTEXT:
Today: \${new Date().toLocaleString()}
\${context ? "KNOWLEDGE BASE:\\n" + context : ""}

AVAILABILITY:
\${schedule}

OUTPUT JSON ONLY:
\${JSON.stringify(RESPONSE_SCHEMA)}
\`
  }

  async think(model: string, messages: any[]) {
    const completion = await this.openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: messages,
      temperature: 0.3,
      response_format: { type: "json_object" }
    })
    return UTILS.safeParseJSON(completion.choices[0].message.content || "{}")
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. MAIN CONTROLLER
   ───────────────────────────────────────────────────────────────────────────── */
serve(async (req) => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*" }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // 1. Parse Request
    let body = "", sender = "", recipient = ""
    const contentType = req.headers.get("content-type") || ""
    
    if (contentType.includes("form-urlencoded")) {
      const text = await req.text(); const p = new URLSearchParams(text)
      body = p.get("Body") || ""; sender = p.get("From") || ""; recipient = p.get("To") || ""
    } else {
      const fd = await req.formData();
      body = fd.get("Body")?.toString() || ""; sender = fd.get("From")?.toString() || ""; recipient = fd.get("To")?.toString() || ""
    }
    
    sender = sender.replace("whatsapp:", ""); recipient = recipient.replace("whatsapp:", "")
    if (!body) return new Response("OK")

    // 2. Init Services
    const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)
    const openai = new OpenAI({ apiKey: CONFIG.OPENAI_KEY })
    const repo = new Repository(sb)
    const ai = new AIService(openai)

    // 3. Identify Merchant
    const profile = await repo.getProfileByPhone(recipient)
    if (!profile) return new Response("Profile Not Found", { status: 404 })

    // 4. Fast Path: Greeting (No AI Cost)
    if (UTILS.isGreeting(body)) {
      const reply = UTILS.getGreetingReply(UTILS.detectLang(body))
      await repo.logMessage(profile.id, sender, body, 'inbound', 'Greeting')
      await repo.logMessage(profile.id, sender, reply, 'outbound', 'GreetingReply')
      return new Response(\`<?xml version="1.0"?><Response><Message><Body>\${UTILS.xmlEscape(reply)}</Body></Message></Response>\`, { headers: { "Content-Type": "text/xml" } })
    }

    // 5. Gather Context
    const settings = await repo.getSettings(profile.id)
    const schedule = await repo.getScheduleContext(profile.id)
    const knowledge = await repo.findKnowledge(body, openai)
    const history = await repo.getHistory(profile.id, sender)

    // 6. AI Thinking
    const systemPrompt = ai.buildSystemPrompt(settings?.system_instruction, knowledge, schedule)
    const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: body }]
    
    const aiResponse = await ai.think(settings?.model, messages)
    let finalReply = aiResponse.reply
    const action = aiResponse.action

    // 7. Action Execution
    const lead = await repo.findOrCreateLead(profile.id, sender)

    // Action: Schedule Viewing
    if (action?.type === "SCHEDULE_VIEWING" && action.parameters?.appointmentDate) {
      const isConflict = await repo.checkSlotConflict(profile.id, lead.id, action.parameters.appointmentDate)
      if (isConflict) {
        finalReply = "I apologize, but that time slot is taken. Can we try another time?"
      } else {
        await repo.bookAppointment(lead.id, action.parameters.appointmentDate)
      }
    }

    // Action: Tag Interest
    if (action?.parameters?.propertyInterest) {
      await repo.addTag(lead.id, lead.tags, action.parameters.propertyInterest)
    }

    // 8. Save & Reply
    await repo.logMessage(profile.id, sender, body, 'inbound', aiResponse.intent)
    await repo.logMessage(profile.id, sender, finalReply, 'outbound')

    return new Response(\`<?xml version="1.0"?><Response><Message><Body>\${UTILS.xmlEscape(finalReply)}</Body></Message></Response>\`, { headers: { "Content-Type": "text/xml" } })

  } catch (err: any) {
    console.error("Worker Error:", err)
    return new Response("Error", { status: 500 })
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
