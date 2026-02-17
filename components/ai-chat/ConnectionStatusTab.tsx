
import React, { useState } from 'react';
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

// --- MODULAR WORKER FILES ---
const WORKER_FILES = {
  'index.ts': `
// index.ts - The Sales Engine Orchestrator
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from "https://esm.sh/openai@4.28.0"

import { CONFIG, UTILS } from './utils.ts'
import { Repository } from './repository.ts'
import { AIService } from './ai.ts'

serve(async (req) => {
  // 1. Handle CORS (for testing from dashboard)
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })

  try {
    // 2. Parse Incoming Webhook (Twilio Format)
    let body = "", sender = "", recipient = ""
    const contentType = req.headers.get("content-type") || ""
    
    if (contentType.includes("form-urlencoded")) {
      const text = await req.text(); const p = new URLSearchParams(text)
      body = p.get("Body") || ""; sender = p.get("From") || ""; recipient = p.get("To") || ""
    } else {
      const fd = await req.formData();
      body = fd.get("Body")?.toString() || ""; sender = fd.get("From")?.toString() || ""; recipient = fd.get("To")?.toString() || ""
    }
    
    // Clean phone numbers (remove whatsapp: prefix)
    sender = sender.replace("whatsapp:", ""); recipient = recipient.replace("whatsapp:", "")
    
    if (!body) return new Response("OK - No Body")

    // 3. Init Services
    const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)
    const openai = new OpenAI({ apiKey: CONFIG.OPENAI_KEY })
    const repo = new Repository(sb)
    const ai = new AIService(openai)

    // 4. SECURITY & CONTEXT: Identify Organization
    // We look up the Profile associated with the receiving Twilio Number
    const profile = await repo.getProfileByPhone(recipient)
    if (!profile) {
      console.error(\`Profile not found for recipient: \${recipient}\`)
      return new Response("Profile Not Found", { status: 404 })
    }
    const orgId = profile.organization_id

    // 5. MEMORY: Identify Lead
    const lead = await repo.findOrCreateLead(profile.id, sender)

    // 6. FAST PATH: Greeting Check (Latency Optimization)
    if (UTILS.isGreeting(body)) {
      const lang = UTILS.detectLang(body)
      const reply = UTILS.getGreetingReply(lang)
      // Async logging to not block reply
      repo.logMessage(profile.id, sender, body, 'inbound', 'Greeting')
      repo.logMessage(profile.id, sender, reply, 'outbound', 'GreetingReply')
      return new Response(UTILS.createTwiml(reply), { headers: { "Content-Type": "text/xml" } })
    }

    // 7. GATHER CONTEXT (RAG + Schedule + History)
    const settings = await repo.getSettings(profile.id)
    const schedule = await repo.getScheduleContext(orgId) // Scoped to Org
    const knowledge = await repo.findKnowledge(body, openai, orgId) // Scoped to Org (Security Critical)
    const history = await repo.getHistory(profile.id, sender)

    // 8. AI REASONING (Sales Engine)
    const systemPrompt = ai.buildSystemPrompt(settings?.system_instruction, knowledge, schedule, lead)
    const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: body }]
    
    // "Thinking" Step
    const aiResponse = await ai.think(settings?.model, messages)
    let finalReply = aiResponse.reply || "I'm checking on that for you."
    const action = aiResponse.action

    // 9. EXECUTE: Memory Update (Persona Extraction)
    if (aiResponse.lead_update) {
        // AI found new details (Budget, Preferences, etc). Save to DB (metadata JSONB).
        await repo.updateLead(lead.id, aiResponse.lead_update, aiResponse.thought_process)
    }

    // 10. EXECUTE: Business Actions
    if (action?.type === "SCHEDULE_VIEWING" && action.parameters?.appointmentDate) {
      // Double check availability logic
      const isConflict = await repo.checkSlotConflict(orgId, action.parameters.appointmentDate)
      
      if (isConflict) {
        finalReply = "I just double-checked the system and that slot was just taken. Based on the schedule, would you prefer a different time?" 
        // Note: The AI Prompt should have already suggested alts, but this is a fail-safe.
      } else {
        await repo.bookAppointment(orgId, lead.id, action.parameters.appointmentDate, profile.id)
        // finalReply remains as AI generated (usually "Booked for...")
      }
    } else if (action?.type === "HANDOVER") {
        await repo.addTag(lead.id, lead.tags, "Agent Alert")
        // Logic to notify human agent could go here
    }

    if (action?.parameters?.propertyInterest) {
      await repo.addTag(lead.id, lead.tags, action.parameters.propertyInterest)
    }

    // 11. LOGGING & RESPONSE
    await repo.logMessage(profile.id, sender, body, 'inbound', aiResponse.intent)
    await repo.logMessage(profile.id, sender, finalReply, 'outbound', action?.type)

    return new Response(UTILS.createTwiml(finalReply), { headers: { "Content-Type": "text/xml" } })

  } catch (err: any) {
    console.error("Worker Critical Error:", err)
    // Fail Gracefully to user
    const errorReply = "I'm having a bit of trouble connecting to the schedule right now. Please try again in a moment."
    return new Response(UTILS.createTwiml(errorReply), { headers: { "Content-Type": "text/xml" } })
  }
})`,
  'utils.ts': `
// utils.ts - Configuration and Robust Helpers

export const CONFIG = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SUPABASE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  OPENAI_KEY: Deno.env.get("OPENAI_API_KEY") ?? "",
  TIMEZONE: "Asia/Kuala_Lumpur"
}

export const RESPONSE_SCHEMA = {
  intent: "string",
  thought_process: "string", 
  reply: "string",
  action: {
    type: "SCHEDULE_VIEWING | ASK_SCHEDULE | QUALIFY_LEAD | HANDOVER | NONE",
    reason: "string | null",
    parameters: {
      appointmentDate: "ISO8601 string | null",
      propertyInterest: "string | null"
    }
  },
  lead_update: {
    name: "string | null",
    budget: "string | null",
    location_preference: "string | null",
    urgency: "string | null"
  }
}

export const UTILS = {
  // Robust JSON parser that handles code blocks and partial strings
  safeParseJSON: (raw: string) => {
    if (!raw) return { reply: "...", action: { type: "NONE" } };
    const cleaned = raw.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      try {
        // Try to find the first '{' and last '}'
        const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}")
        if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1))
      } catch {}
      // Fallback object to prevent crash
      return { 
        intent: "Error", 
        thought_process: "JSON Parse Failed",
        reply: cleaned, // Use the raw text if it looks like a reply
        action: { type: "NONE" } 
      }
    }
  },
  
  createTwiml: (message: string) => {
    const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return \`<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>\${escaped}</Body></Message></Response>\`;
  },

  detectLang: (text: string) => {
    const t = text.toLowerCase();
    if (/[你好嗨早安]/.test(t)) return "zh";
    if (t.includes("hai") || t.includes("halo") || t.includes("selamat") || t.includes("nak tanya") || t.includes("pm")) return "ms";
    return "en";
  },

  isGreeting: (text: string) => {
    const t = text.trim().toLowerCase();
    const greetings = ["hi","hello","hey","good morning","hai","halo","你好","pm"];
    return greetings.some(g => t === g) || (greetings.some(g => t.startsWith(g + " ")) && t.length < 15);
  },

  getGreetingReply: (lang: string) => {
    const map: any = {
      en: "Hello! 👋 Welcome to InShoppe Realty. Are you looking to buy, rent, or sell a property today?",
      zh: "你好! 👋 欢迎来到 InShoppe Realty。请问您今天有兴趣买房，租房，还是出售房产？",
      ms: "Hai! 👋 Selamat datang ke InShoppe Realty. Anda berminat untuk beli, sewa, atau jual hartanah hari ini?"
    };
    return map[lang] || map.en;
  },

  getCurrentTime: () => new Date().toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE, hour12: true })
}`,
  'repository.ts': `
// repository.ts - Database Interactions & Security
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from "https://esm.sh/openai@4.28.0"

export class Repository {
  constructor(private sb: SupabaseClient) {}

  async getProfileByPhone(phone: string) {
    const { data } = await this.sb.from("profiles").select("id, organization_id").eq("twilio_phone_number", phone).single()
    return data
  }

  async getSettings(userId: string) {
    const { data } = await this.sb.from("user_settings").select("system_instruction, model").eq("user_id", userId).single()
    return data
  }

  // Fetch only upcoming bookings for the specific Organization
  async getScheduleContext(orgId: string) {
    const now = new Date().toISOString()
    const { data } = await this.sb.from("bookings")
      .select("start_time, end_time")
      .eq("organization_id", orgId)
      .eq("status", "scheduled")
      .gt("start_time", now)
      .order("start_time", { ascending: true })
      .limit(15)
    
    if (!data || data.length === 0) return "Schedule is completely open for the next 7 days."
    return data.map((s: any) => "- BUSY: " + new Date(s.start_time).toLocaleString() + " to " + new Date(s.end_time).toLocaleTimeString()).join("\\n")
  }

  async getHistory(userId: string, phone: string) {
    const { data } = await this.sb.from("messages")
      .select("text, sender")
      .eq("user_id", userId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(10) // Context window
    return (data || []).reverse().map((m: any) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text
    }))
  }

  async findOrCreateLead(userId: string, phone: string) {
    let { data: lead } = await this.sb.from("leads").select("*").eq("user_id", userId).eq("phone", phone).maybeSingle()
    if (!lead) {
      const { data: newLead } = await this.sb.from("leads")
        .insert({ user_id: userId, phone, name: "Lead " + phone, status: "New" })
        .select().single()
      lead = newLead
    }
    return lead
  }

  // Store extracted persona into JSONB metadata
  async updateLead(id: number, updates: any, thought?: string) {
      const cleanUpdates: any = {}
      if (updates.name) cleanUpdates.name = updates.name
      
      const newMetadata = {
          budget: updates.budget,
          preference: updates.location_preference,
          urgency: updates.urgency,
          last_thought: thought,
          updated_at: new Date().toISOString()
      }
      
      // Update both metadata (JSONB) and ai_analysis (Text summary) for compatibility
      cleanUpdates.metadata = newMetadata
      cleanUpdates.ai_analysis = \`Budget: \${updates.budget || '?'}, Pref: \${updates.location_preference || '?'}, Urgency: \${updates.urgency || '?'}\`
      
      // Use SQL merge for JSONB if possible, or just overwrite in this simple implementation
      await this.sb.from("leads").update(cleanUpdates).eq("id", id)
  }

  async checkSlotConflict(orgId: string, dateStr: string) {
    const requestedStart = new Date(dateStr)
    const requestedEnd = new Date(requestedStart.getTime() + 60 * 60 * 1000) // 1 Hour slots
    const { data } = await this.sb.from("bookings")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "scheduled")
      .lt("start_time", requestedEnd.toISOString())
      .gt("end_time", requestedStart.toISOString())
      .maybeSingle()
    return !!data
  }

  async bookAppointment(orgId: string, leadId: number, dateStr: string, createdBy: string) {
    const startTime = new Date(dateStr)
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

    await this.sb.from("bookings").insert({
      organization_id: orgId,
      lead_id: leadId,
      created_by: createdBy,
      title: "Viewing Appointment",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "scheduled"
    })
    
    await this.sb.from("leads").update({
      status: "Proposal",
      next_appointment: startTime.toISOString()
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

  // SECURITY: Filter knowledge to orgId only
  async findKnowledge(query: string, openai: OpenAI, orgId: string) {
    try {
      const emb = await openai.embeddings.create({ model: "text-embedding-3-small", input: query })
      
      // RPC returns potential matches based on vector similarity
      const { data: matches } = await this.sb.rpc("match_knowledge", {
        query_embedding: emb.data[0].embedding,
        match_threshold: 0.5,
        match_count: 5 
      })
      
      if (!matches || matches.length === 0) return ""

      // CRITICAL: Filter these matches against the organization_id to prevent data leaks.
      // Even if RLS is off for service role, we must manually enforce tenancy here.
      const matchIds = matches.map((m: any) => m.id)
      const { data: validDocs } = await this.sb.from("knowledge")
        .select("id, content")
        .eq("organization_id", orgId) // <-- Security Filter
        .in("id", matchIds)
      
      return validDocs?.map((c: any) => c.content).join("\\n\\n") || ""
    } catch (e) { 
        console.error("RAG Error", e)
        return "" 
    }
  }
}`,
  'ai.ts': `
// ai.ts - AI Brain & Prompt Engineering
import OpenAI from "https://esm.sh/openai@4.28.0"
import { RESPONSE_SCHEMA, UTILS } from './utils.ts'

export class AIService {
  constructor(private openai: OpenAI) {}

  buildSystemPrompt(instruction: string, context: string, schedule: string, lead: any) {
    // 1. Memory Injection (Safe Parsing)
    let leadMeta: any = {};
    
    // Attempt to use metadata (preferred) or ai_analysis (legacy/text)
    // NOTE: 'lead.metadata' usually comes as a JSON object from Supabase if defined as jsonb.
    // If it was somehow stored as string or we are falling back to ai_analysis (text), we must check.
    const rawData = lead.metadata || lead.ai_analysis;

    if (rawData && typeof rawData === 'object') {
        leadMeta = rawData;
    } else if (typeof rawData === 'string') {
        try {
            if (rawData.trim().startsWith('{')) {
                leadMeta = JSON.parse(rawData);
            } else {
                // Legacy text data (e.g., "Viewing Scheduled")
                leadMeta = { note: rawData };
            }
        } catch {
            leadMeta = { note: rawData };
        }
    }

    const leadContext = \`
KNOWN CUSTOMER MEMORY:
- Name: \${lead.name || "Unknown"}
- Budget: \${leadMeta.budget || "Unknown"}
- Preferences: \${leadMeta.preference || leadMeta.location_preference || "Unknown"}
- Urgency: \${leadMeta.urgency || "Unknown"}
- Notes: \${leadMeta.note || leadMeta.last_thought || ""}
\`;

    // 2. The Core Prompt
    return \`
ROLE:
\${instruction || "You are a top-tier Real Estate Sales Agent for InShoppe AI."}

OBJECTIVE:
Your goal is to **CLOSE THE DEAL** (Booking a viewing or getting a deposit).
Adopt a "Consultative Sales" approach. Be professional, warm, and use localized English (Malaysia/Singapore style).

CRITICAL RULES:
1. **Fact-Check**: Use the KNOWLEDGE BASE. If info is missing, say "I'll check with my team".
2. **Sales Logic**:
   - If user says "Too expensive", search KNOWLEDGE BASE for cheaper units.
   - If user wants to book, propose a time.
   - **Conflict Handling**: Look at [AVAILABILITY]. If the user asks for a slot listed as BUSY, say "That time is taken, but how about [Suggest 2 Alternatives]?"
3. **Extraction**: Always try to extract Lead details (Name, Budget) into the JSON output.

CONTEXT:
Current Time (KL): \${UTILS.getCurrentTime()}
\${leadContext}

KNOWLEDGE BASE (Organization Specific):
\${context || "No specific documents found."}

AVAILABILITY (Busy Slots):
\${schedule}

OUTPUT FORMAT:
Return strictly JSON matching this schema:
\${JSON.stringify(RESPONSE_SCHEMA)}
\`
  }

  async think(model: string, messages: any[]) {
    const completion = await this.openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: messages,
      temperature: 0.3, // Lower temp for factual adherence
      response_format: { type: "json_object" }
    })
    return UTILS.safeParseJSON(completion.choices[0].message.content || "{}")
  }
}`
};

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
    const [selectedFile, setSelectedFile] = useState<keyof typeof WORKER_FILES>('index.ts');

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
                        {/* File Selector Tabs */}
                        <div className="flex gap-2 mb-3 overflow-x-auto">
                            {Object.keys(WORKER_FILES).map((fileName) => (
                                <button
                                    key={fileName}
                                    onClick={() => setSelectedFile(fileName as keyof typeof WORKER_FILES)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-mono rounded-full border transition-colors",
                                        selectedFile === fileName 
                                            ? "bg-amber-600 text-white border-amber-600" 
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-amber-50"
                                    )}
                                >
                                    {fileName}
                                </button>
                            ))}
                        </div>

                        <div className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-xs text-yellow-300 font-mono border border-slate-800 max-h-[300px] shadow-inner">
                            <pre>{WORKER_FILES[selectedFile]}</pre>
                        </div>
                        
                        <Button 
                            size="sm" 
                            className="mt-2 bg-amber-600 hover:bg-amber-500 text-white" 
                            onClick={() => navigator.clipboard.writeText(WORKER_FILES[selectedFile])}
                        >
                            Copy {selectedFile}
                        </Button>
                        
                        <div className="mt-2 text-xs text-slate-500">
                            <strong>Instructions:</strong>
                            <br/>
                            1. Create a folder (e.g., <code>supabase/functions/whatsapp-webhook/</code>).
                            <br/>
                            2. Create these 4 files inside that folder and paste the code respectively.
                            <br/>
                            3. Deploy: <code>supabase functions deploy whatsapp-webhook --no-verify-jwt</code>.
                            <br/>
                            4. Set secrets: <code>OPENAI_API_KEY</code>, <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
