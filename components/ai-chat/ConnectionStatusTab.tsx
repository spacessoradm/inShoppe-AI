
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

// --- HELPER: JSON STRUCTURE FOR PROMPT ---
// We define this outside the string to ensure valid escaping when injected.
const RESPONSE_FORMAT_JSON = JSON.stringify({
    intent: "Property Inquiry | Price/Availability | Booking/Viewing | Location/Amenities | Handover/Keys | Complaint | Cancellation | General Chat",
    reply: "Your human-like message.",
    action: {
        type: "NONE | QUALIFY_LEAD | REQUEST_VIEWING | SCHEDULE_VIEWING | RESCHEDULE_APPOINTMENT | CANCEL_APPOINTMENT | HANDOVER_TO_AGENT",
        reason: "Why you chose this action",
        parameters: {
            appointmentDate: "ISO 8601 Date String (e.g. 2023-12-25T15:00:00.000Z) or null.",
            propertyInterest: "Extracted Project/Property Name or null"
        }
    }
}, null, 2);

// --- EDGE FUNCTION CODE SNIPPET (SERVER-SIDE AI WORKER) ---
const EDGE_FUNCTION_CODE = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from 'https://esm.sh/openai@4.28.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const openAiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

// --- SYSTEM PROMPT GENERATOR ---
const buildSystemPrompt = (baseInstruction, context, now) => {
  // Using array join to construct the prompt cleanly
  return [
    baseInstruction,
    "",
    "────────────────────────────",
    "🕒 CURRENT TIME CONTEXT",
    "────────────────────────────",
    "Today is: " + now,
    "Use this to resolve relative dates like 'tomorrow', 'this Saturday', 'next week' or '5pm'.",
    "",
    "────────────────────────────",
    "🎭 YOUR PERSONA",
    "────────────────────────────",
    "You are a top-tier, human-like Senior Real Estate Consultant.", 
    "- TONE: Warm, professional, enthusiastic, and confident.", 
    "- NEVER say 'I am an AI'. Act as a human agent.",
    "",
    "────────────────────────────",
    "🧠 INTELLIGENT RECOMMENDATION LOGIC",
    "────────────────────────────",
    "Use the 'RETRIEVED INVENTORY' below to answer.",
    "1. **MATCHING LOGIC**: If user asks for specific area/type, match loosely.",
    "2. **THE 'PIVOT' RULE**: If you don't have the exact listing, offer a nearby alternative.",
    "3. **CALL TO ACTION**: End with a question to advance the sale.",
    "",
    "────────────────────────────",
    "📚 RETRIEVED INVENTORY",
    "────────────────────────────",
    context || "No specific property details found. Engage to understand needs.",
    "",
    "────────────────────────────",
    "OUTPUT FORMAT (JSON)",
    "────────────────────────────",
    "Respond in valid JSON only:",
    ${JSON.stringify(RESPONSE_FORMAT_JSON)}
  ].join("\\n");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })

  try {
    const formData = await req.formData()
    const incomingMsg = formData.get('Body')?.toString() || ''
    let senderPhone = formData.get('From')?.toString() || ''
    let merchantPhone = formData.get('To')?.toString() || ''
    senderPhone = senderPhone.replace('whatsapp:', '')
    merchantPhone = merchantPhone.replace('whatsapp:', '')

    if (!incomingMsg) return new Response('No Body', { status: 200 })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openAiKey })

    // 1. GET MERCHANT PROFILE & SETTINGS
    const { data: profile } = await supabase.from('profiles').select('id, organization_id').eq('twilio_phone_number', merchantPhone).single()
    if (!profile) return new Response('Profile not found', { status: 404 })

    const { data: settings } = await supabase.from('user_settings').select('system_instruction').eq('user_id', profile.id).single()
    const systemInstruction = settings?.system_instruction || "You are a helpful real estate assistant."

    // 2. RAG: RETRIEVE CONTEXT
    let context = ""
    try {
        const embeddingResp = await openai.embeddings.create({ model: "text-embedding-3-small", input: incomingMsg, dimensions: 768 })
        const embedding = embeddingResp.data[0].embedding
        const { data: chunks } = await supabase.rpc('match_knowledge', { 
            query_embedding: embedding, match_threshold: 0.5, match_count: 3 
        })
        if (chunks && chunks.length > 0) context = chunks.map(c => c.content).join("\\n\\n")
    } catch (err) { console.error("RAG Error:", err) }

    // 3. FETCH HISTORY
    const { data: historyData } = await supabase.from('messages')
        .select('text, sender')
        .eq('user_id', profile.id)
        .eq('phone', senderPhone)
        .order('created_at', { ascending: false })
        .limit(10)
    
    const chatHistory = (historyData || []).reverse().map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
    }))

    // 4. GENERATE AI RESPONSE
    const now = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const fullPrompt = buildSystemPrompt(systemInstruction, context, now)

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: fullPrompt },
            ...chatHistory,
            { role: "user", content: incomingMsg }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
    })

    const aiContent = JSON.parse(completion.choices[0].message.content)
    const { intent, reply, action } = aiContent

    // 5. DB: INSERT USER MESSAGE (Logged as processed)
    await supabase.from('messages').insert({
        user_id: profile.id, text: incomingMsg, sender: 'user', direction: 'inbound', phone: senderPhone, intent_tag: intent
    })

    // 6. DB: INSERT BOT REPLY
    await supabase.from('messages').insert({
        user_id: profile.id, text: reply, sender: 'bot', direction: 'outbound', phone: senderPhone
    })

    // 7. CRM ACTIONS (Leads)
    // Check if lead exists
    const { data: lead } = await supabase.from('leads').select('id, tags').match({ user_id: profile.id, phone: senderPhone }).maybeSingle()
    
    let leadUpdates = { last_contacted_at: new Date().toISOString() }
    
    if (!lead) {
        // Create new lead if not exists
        await supabase.from('leads').insert({
            user_id: profile.id, name: 'Lead ' + senderPhone, phone: senderPhone, status: 'New', ...leadUpdates
        })
    } else {
        // Update existing lead based on Action
        if (action?.type === 'SCHEDULE_VIEWING' || action?.type === 'RESCHEDULE_APPOINTMENT') {
            leadUpdates.status = 'Proposal'
            leadUpdates.ai_analysis = \`Booking: \${action.reason}\`
            if (action.parameters?.appointmentDate) {
                leadUpdates.next_appointment = action.parameters.appointmentDate
            }
        }
        if (action?.type === 'CANCEL_APPOINTMENT') {
            leadUpdates.next_appointment = null
            leadUpdates.status = 'Qualified' // Revert to qualified
            leadUpdates.ai_analysis = 'Appointment cancelled by user.'
        }
        if (action?.parameters?.propertyInterest) {
            const newTag = action.parameters.propertyInterest
            const tags = lead.tags || []
            if (!tags.includes(newTag)) leadUpdates.tags = [...tags, newTag]
        }
        
        await supabase.from('leads').update(leadUpdates).eq('id', lead.id)
    }

    // 8. RETURN TWIML (To send reply via Twilio)
    return new Response(
      \`<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>\${reply}</Body></Message></Response>\`,
      { headers: { "Content-Type": "text/xml" } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
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
