
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

// --- EDGE FUNCTION CODE SNIPPET (TWILIO WEBHOOK) ---
const EDGE_FUNCTION_CODE = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const formData = await req.formData()
    const incomingMsg = formData.get('Body')?.toString() || ''
    
    let senderPhone = formData.get('From')?.toString() || ''
    let merchantPhone = formData.get('To')?.toString() || ''

    senderPhone = senderPhone.replace('whatsapp:', '')
    merchantPhone = merchantPhone.replace('whatsapp:', '')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('twilio_phone_number', merchantPhone)
      .single()

    if (!profile) return new Response('Profile not found', { status: 404 })

    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        user_id: profile.id, 
        text: incomingMsg,
        sender: 'user',
        direction: 'inbound',
        phone: senderPhone,
        intent_tag: 'Processing...'
      })

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
`;

// --- OPENAI PROXY CODE SNIPPET (ROBUST VERSION) ---
const OPENAI_PROXY_CODE = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from 'https://esm.sh/openai@4.28.0'
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12'

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
    console.log('Action received:', action)
    
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
      console.log('Scraping URL:', url);
      
      const controller = new AbortController();
      // 25s target timeout - fail fast if site is stuck so we can return error to UI
      const timeoutId = setTimeout(() => controller.abort(), 25000); 

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Upgrade-Insecure-Requests': '1'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
             // Return as text so UI can show it
             return new Response(JSON.stringify({ text: "Error: Failed to fetch URL (" + response.status + "). Site might block bots." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        
        // STREAMING READ with Size Limit (Max 2MB)
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let html = '';
        let receivedLength = 0;
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB limit

        if (reader) {
          while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            receivedLength += value.length;
            html += decoder.decode(value, {stream: true});
            if (receivedLength > MAX_SIZE) {
              console.log('Scraper: Size limit exceeded, truncating download.');
              reader.cancel();
              break;
            }
          }
          html += decoder.decode(); 
        } else {
          html = await response.text();
        }
        
        const $ = cheerio.load(html);
        
        // Remove junk
        $('script, style, noscript, iframe, svg, canvas, video, audio, link, button, input, form').remove();
        $('header, footer, nav, aside, [role="banner"], [role="navigation"], [role="contentinfo"]').remove();
        $('.menu, .nav, .sidebar, .comments, .ad, .ads, .popup, .modal, .cookie-banner, .social-share').remove();
        
        // Priority Extraction for Real Estate/Articles
        let text = '';
        const selectors = [
            'article', 
            'main', 
            '#content', 
            '.content', 
            '.property-description', 
            '.listing-details', 
            '.post-content',
            '#main',
            '.entry-content'
        ];
        
        // Try to find the best container
        for (const sel of selectors) {
            const el = $(sel);
            if (el.length > 0 && el.text().trim().length > 200) {
                text = el.text();
                break;
            }
        }
        
        // Fallback to body if specific selectors fail
        if (!text) {
            text = $('body').text();
        }
        
        // Clean whitespace
        text = text.replace(new RegExp('[\\\\s\\\\n\\\\r]+', 'g'), ' ').trim();
        
        if (text.length > 25000) text = text.substring(0, 25000) + '... (Truncated)';
        
        if (!text || text.length < 50) {
             text = "Error: Could not extract readable text. The site might be dynamic (React/Vue/SPA) and requires a headless browser.";
        }
          
        return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      } catch (fetchErr) {
        clearTimeout(timeoutId);
        let errorMsg = "Error: Scraping failed.";
        if (fetchErr.name === 'AbortError') {
            errorMsg = "Error: Site took too long to respond (Timeout). Please copy text manually.";
        } else {
            errorMsg = "Error: " + fetchErr.message;
        }
        // Return 200 with error message in text so client doesn't throw
        return new Response(JSON.stringify({ text: errorMsg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
    console.error('Edge Function Error:', error);
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
        <div className="flex-1 overflow-y-auto p-6 m-0 h-full scrollbar-thin scrollbar-thumb-slate-800">
            <div className="max-w-3xl mx-auto space-y-6">
                <Card className="border border-slate-700/50 bg-slate-900/40 text-white">
                    <CardHeader><CardTitle>Webhook Connection</CardTitle><CardDescription>Test connectivity to your Supabase Edge Function.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input readOnly value={webhookUrl || "No URL Configured"} className="bg-slate-950 font-mono text-blue-300" />
                            <Button onClick={checkWebhookReachability}>Test Ping</Button>
                        </div>
                        <div className="text-sm text-slate-400">
                            <p>Status: <span className={cn("font-bold", webhookStatus === 'success' ? "text-green-400" : webhookStatus === 'error' ? "text-red-400" : "text-slate-500")}>{webhookStatus}</span></p>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border border-blue-500/30 bg-blue-900/10 text-white">
                    <CardHeader>
                        <CardTitle className="text-blue-300">Required: OpenAI Proxy Function</CardTitle>
                        <CardDescription>
                            To fix CORS errors, you MUST deploy this function to Supabase as <code>openai-proxy</code>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-xs text-green-300 font-mono border border-slate-800 max-h-[300px]"><pre>{OPENAI_PROXY_CODE}</pre></div>
                        <Button size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(OPENAI_PROXY_CODE)}>Copy Function Code</Button>
                        <div className="mt-2 text-xs text-slate-500">
                            Deploy command: <code className="bg-slate-800 px-1">supabase functions deploy openai-proxy --no-verify-jwt</code>
                        </div>
                        <div className="mt-4 text-xs text-slate-400 border-t border-slate-800 pt-2">
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

                <Card className="border border-slate-700/50 bg-slate-900/40 text-white">
                    <CardHeader><CardTitle>Twilio Webhook Function</CardTitle></CardHeader>
                    <CardContent>
                        <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-xs text-yellow-300 font-mono border border-slate-800 max-h-[300px]"><pre>{EDGE_FUNCTION_CODE}</pre></div>
                        <Button size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(EDGE_FUNCTION_CODE)}>Copy Code</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
