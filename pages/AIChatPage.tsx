
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { cn } from '../lib/utils';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { processIncomingMessage } from '../services/aiEngine';
// New Components
import { ChatList } from '../components/ai-chat/ChatList';
import { ChatWindow } from '../components/ai-chat/ChatWindow';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Types
interface SimMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system';
  direction: 'inbound' | 'outbound';
  timestamp: string; 
  fullTimestamp: number;
  phone?: string;
  status?: 'sent' | 'delivered' | 'read';
  intent_tag?: string;
}

interface KnowledgeItem {
    id: number;
    content: string;
    similarity?: number;
}

type ViewMode = 'landing' | 'setup' | 'dashboard';

const getEnv = (key: string) => {
    let val = '';
    try {
        if ((import.meta as any).env && (import.meta as any).env[key]) {
            val = (import.meta as any).env[key];
        }
    } catch (e) {}

    if (!val) {
        try {
            if (typeof process !== 'undefined' && process.env && process.env[key]) {
                val = process.env[key] as string;
            }
        } catch (e) {}
    }
    return val;
};

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
    // Basic body parsing check
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
      if (!url) throw new Error('URL is required for scrape action');
      console.log('Scraping URL:', url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for the fetch itself

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Failed to fetch URL: ' + response.status + ' ' + response.statusText);
        
        const html = await response.text();
        
        // Basic HTML to Text stripping using RegExp constructor to avoid bundling issues
        // Note: For SPAs (React/Vue sites), this might return empty text if content is JS-rendered.
        const text = html
          .replace(new RegExp('<script[^>]*>([\\\\s\\\\S]*?)</script>', 'gi'), '')
          .replace(new RegExp('<style[^>]*>([\\\\s\\\\S]*?)</style>', 'gi'), '')
          .replace(new RegExp('<[^>]+>', 'g'), ' ')
          .replace(new RegExp('\\\\s+', 'g'), ' ')
          .trim();
          
        return new Response(JSON.stringify({ text: text || "No readable text found (Site might be SPA/JavaScript only)." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
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

const AIChatPage: React.FC = () => {
    const { user, profile, organization, deductCredit } = useAuth();
    const navigate = useNavigate();

    // --- View State ---
    const [mode, setMode] = useState<ViewMode>('landing');
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [aiStatus, setAiStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // --- State: Configuration ---
    const [loading, setLoading] = useState(false);
    
    // --- State: Credentials ---
    const [accountSid, setAccountSid] = useState(() => getEnv('VITE_TWILIO_ACCOUNT_SID') || getEnv('TWILIO_ACCOUNT_SID') || '');
    const [authToken, setAuthToken] = useState(() => getEnv('VITE_TWILIO_AUTH_TOKEN') || getEnv('TWILIO_AUTH_TOKEN') || '');
    const [myPhoneNumber, setMyPhoneNumber] = useState(() => getEnv('VITE_TWILIO_PHONE_NUMBER') || getEnv('TWILIO_PHONE_NUMBER') || '');
    const [webhookUrl, setWebhookUrl] = useState('https://rwlecxyfukzberxcpqnr.supabase.co/functions/v1/dynamic-endpoint');
    const [apiKey, setApiKey] = useState('');
    
    // --- State: Webhook ---
    const [webhookStatus, setWebhookStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    
    // --- State: AI ---
    const [systemInstruction, setSystemInstruction] = useState(
        "You are a Senior Real Estate Sales Agent at inShoppe. Your primary objective is to QUALIFY leads, ADVANCE them to the next sales step, and SECURE VIEWING BOOKINGS or human handover. Be confident, professional, and helpful."
    );
    const systemInstructionRef = useRef(systemInstruction);

    // --- State: Knowledge Base ---
    const [knowledgeInput, setKnowledgeInput] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [isScraping, setIsScraping] = useState(false);
    const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
    
    // --- State: Data ---
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [input, setInput] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Keep ref updated
    useEffect(() => {
        systemInstructionRef.current = systemInstruction;
    }, [systemInstruction]);

    // --- Derived State: Group Messages by Phone ---
    const chats = useMemo(() => {
        const groups: Record<string, SimMessage[]> = {};
        
        messages.forEach(msg => {
            const key = msg.phone || 'System Logs';
            if (msg.sender === 'system' && key === 'System Logs') return;
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(msg);
        });
        
        return Object.entries(groups).sort(([, a], [, b]) => {
            const lastA = a[a.length - 1].fullTimestamp;
            const lastB = b[b.length - 1].fullTimestamp;
            return lastB - lastA;
        });
    }, [messages]);

    // --- Helpers ---
    const addLog = (text: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 49)]);
    };

    const fetchKnowledgeBase = async () => {
        if (!supabase || !organization) return;
        try {
            const { data, error } = await supabase
                .from('knowledge')
                .select('id, content')
                .eq('organization_id', organization.id)
                .order('id', { ascending: false })
                .limit(50);

            if (!error && data) {
                setKnowledgeItems(data);
            }
        } catch (e) {
            console.error("Failed to fetch knowledge base", e);
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (apiKey) localStorage.setItem('openai_api_key', apiKey); 

        localStorage.setItem('twilio_user_config', JSON.stringify({
             accountSid, authToken, phoneNumber: myPhoneNumber, webhookUrl, systemInstruction
        }));

        if (supabase && user) {
            try {
                await supabase.from('user_settings').upsert({
                    user_id: user.id,
                    twilio_account_sid: accountSid,
                    twilio_auth_token: authToken,
                    twilio_phone_number: myPhoneNumber,
                    webhook_url: webhookUrl,
                    system_instruction: systemInstruction,
                    updated_at: new Date().toISOString()
                });
            } catch (err: any) {
                console.error("Error saving settings to DB:", err);
                addLog(`Settings Save Error: ${err.message}`);
            }
        }
        
        setLoading(false);
        setMode('dashboard');
    };

    useEffect(() => {
        const loadConfig = async () => {
            const localKey = localStorage.getItem('openai_api_key');
            if (localKey) setApiKey(localKey);

            if (!supabase || !user) {
                const savedConfig = localStorage.getItem('twilio_user_config');
                if (savedConfig) {
                    const parsed = JSON.parse(savedConfig);
                    setAccountSid(parsed.accountSid || '');
                    setAuthToken(parsed.authToken || '');
                    setMyPhoneNumber(parsed.phoneNumber || ''); 
                    setWebhookUrl(parsed.webhookUrl || '');
                    if (parsed.systemInstruction) setSystemInstruction(parsed.systemInstruction);
                    
                    if (parsed.accountSid && parsed.authToken) {
                        setMode('dashboard');
                    }
                }
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                
                if (data) {
                    setAccountSid(data.twilio_account_sid || '');
                    setAuthToken(data.twilio_auth_token || '');
                    setMyPhoneNumber(data.twilio_phone_number || '');
                    setWebhookUrl(data.webhook_url || '');
                    if (data.system_instruction) setSystemInstruction(data.system_instruction);

                    if (data.twilio_account_sid && data.twilio_phone_number && mode === 'landing') {
                        setMode('dashboard');
                    }
                }
            } catch (err) {
                console.error("Error loading config:", err);
            }
        };

        loadConfig();
    }, [user, mode]);

    useEffect(() => {
        if (!supabase || mode !== 'dashboard' || !organization) return;
        fetchKnowledgeBase();
    }, [mode, organization]);

    const sendToTwilio = async (to: string, body: string) => {
        if (!accountSid || !authToken || !myPhoneNumber) {
            addLog("System: ⚠️ Twilio credentials missing. Reply saved to DB but not sent to WhatsApp.");
            return;
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const formData = new URLSearchParams();
        
        let targetPhone = to.trim();
        if (!targetPhone.includes('whatsapp:')) {
            targetPhone = `whatsapp:${targetPhone}`;
        }
        
        let sourcePhone = myPhoneNumber.trim();
        if (!sourcePhone.includes('whatsapp:')) {
            sourcePhone = `whatsapp:${sourcePhone}`;
        }

        formData.append('To', targetPhone);
        formData.append('From', sourcePhone);
        formData.append('Body', body);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || response.statusText);
            }
            
            addLog(`System: 📤 Sent to WhatsApp (${targetPhone})`);
        } catch (error: any) {
            console.error("Twilio Send Error:", error);
            addLog(`Error: Twilio Send Failed - ${error.message}`);
            if (error.message.includes('Failed to fetch')) {
                 addLog("Hint: Browser blocked Twilio call (CORS). Use an Edge Function or Proxy for production.");
            }
        }
    };

    const classifyMessage = async (msgId: string, text: string) => {
        if (!supabase || !user) return;
        setAiStatus('Classifying...');
        try {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, intent_tag: 'Analysing...' } : m));
            
            const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
            
            // Timeout safety for classify
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
            const processPromise = processIncomingMessage(
                text, 
                user.id,
                systemInstructionRef.current,
                activeKey
            );
            
            const result: any = await Promise.race([processPromise, timeoutPromise]);
            const { intent } = result;
            
            await supabase.from('messages').update({ intent_tag: intent }).eq('id', msgId);
            setAiStatus('');
        } catch (e) {
            console.error("Classification error", e);
            setAiStatus('Error');
            await supabase.from('messages').update({ intent_tag: 'Manual Review' }).eq('id', msgId);
        }
    };

    const processAndReplyToMessage = async (msgId: string, text: string, phone: string) => {
        if (!supabase || !user) return;
        
        addLog(`AI Brain: 🧠 Processing message [${msgId}]...`);
        setAiStatus('Analyzing...');

        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, intent_tag: 'Analysing...' } : m));

        try {
            const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
            
            // Race against a timeout to ensure we don't hang indefinitely
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Processing timed out (15s)")), 15000)
            );

            const processPromise = processIncomingMessage(
                text,
                user.id,
                systemInstructionRef.current,
                activeKey
            );

            // Wait for result or timeout
            const result: any = await Promise.race([processPromise, timeoutPromise]);
            const { intent, reply, contextUsed } = result;

            // Update intent
            await supabase.from('messages').update({ intent_tag: intent }).eq('id', msgId);

            setAiStatus(contextUsed ? 'Searching Knowledge...' : 'Replying...');
            // Small delay for UX naturalness, but only if it was fast
            await new Promise(resolve => setTimeout(resolve, 500));

            // Send Reply
            await supabase.from('messages').insert({
                user_id: user.id,
                text: reply,
                sender: 'bot',
                direction: 'outbound',
                phone: phone
            });

            addLog(`AI Brain: ✅ Replied to [${msgId}] internally.`);
            setAiStatus('');

            if (webhookUrl) {
                await sendToTwilio(phone, reply);
            }

        } catch (error: any) {
            console.error("AI Processing Failed:", error);
            addLog(`Error: AI Failed - ${error.message}`);
            setAiStatus('Error');
            
            const fallbackReply = "I apologize, but I am experiencing high traffic. A human agent will be with you shortly.";
            
            await supabase.from('messages').insert({
                user_id: user.id,
                text: fallbackReply,
                sender: 'bot',
                direction: 'outbound',
                phone: phone
            });
            
            await supabase.from('messages').update({ intent_tag: 'System Error' }).eq('id', msgId);
            
            if (webhookUrl) {
                await sendToTwilio(phone, fallbackReply);
            }
        }
    };

    useEffect(() => {
        if (mode !== 'dashboard') return;

        const fetchHistory = async () => {
            setIsHistoryLoading(true);
            try {
                if (supabase && user) {
                    addLog(`System: Syncing history from Database...`);
                    const { data, error } = await supabase
                        .from('messages')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(50);
                    
                    if (data && data.length > 0) {
                        const formatted: SimMessage[] = data.reverse().map((msg: any) => ({
                            id: msg.id.toString(),
                            text: msg.text,
                            sender: msg.direction === 'inbound' ? 'user' : (msg.sender === 'user' ? 'user' : 'bot'),
                            direction: msg.direction || (msg.sender === 'user' ? 'inbound' : 'outbound'),
                            timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            fullTimestamp: new Date(msg.created_at).getTime(),
                            phone: msg.phone,
                            status: 'delivered',
                            intent_tag: msg.intent_tag
                        }));
                        setMessages(formatted);
                    } else {
                        loadLocalHistory();
                    }
                } else {
                    addLog('System: Loading history from Local Storage (Demo Mode)...');
                    loadLocalHistory();
                }
            } catch (e) {
                console.error("Critical error in fetchHistory", e);
                loadLocalHistory();
            } finally {
                setIsHistoryLoading(false);
            }
        };

        const loadLocalHistory = () => {
             const savedMsgs = localStorage.getItem('demo_chat_history');
             if (savedMsgs) {
                 try {
                     const parsed = JSON.parse(savedMsgs);
                     if (parsed && parsed.length > 0) setMessages(parsed);
                 } catch (e) {}
             }
        };

        fetchHistory();

        if (supabase && user) {
            const channel = supabase
                .channel('chat-updates')
                .on(
                    'postgres_changes',
                    { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'messages',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        const newMsg = payload.new;
                        const msgId = newMsg.id.toString();
                        
                        const formattedMsg: SimMessage = {
                            id: msgId,
                            text: newMsg.text,
                            sender: newMsg.direction === 'inbound' ? 'user' : 'bot',
                            direction: newMsg.direction || (newMsg.sender === 'user' ? 'inbound' : 'outbound'),
                            timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            fullTimestamp: new Date(newMsg.created_at).getTime(),
                            phone: newMsg.phone,
                            status: 'delivered',
                            intent_tag: newMsg.intent_tag
                        };
                        
                        setMessages(prev => {
                            if (prev.some(m => m.id === msgId)) return prev;
                            
                            addLog(`Realtime: 📩 New ${newMsg.direction} message [ID:${newMsg.id}]`);
                            const updated = [...prev, formattedMsg].sort((a, b) => a.fullTimestamp - b.fullTimestamp);
                            localStorage.setItem('demo_chat_history', JSON.stringify(updated));
                            return updated;
                        });
                        
                        if (!selectedPhone) setSelectedPhone(newMsg.phone);

                        if (
                            (newMsg.direction === 'inbound' || newMsg.sender === 'user') && 
                            (!newMsg.intent_tag || newMsg.intent_tag === 'Processing...')
                        ) {
                            processAndReplyToMessage(msgId, newMsg.text, newMsg.phone);
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'messages',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        const updatedMsg = payload.new;
                        setMessages(prev => prev.map(m => {
                            if (m.id === updatedMsg.id.toString()) {
                                return { ...m, intent_tag: updatedMsg.intent_tag };
                            }
                            return m;
                        }));
                    }
                )
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [mode, user]); 

    // Handle Manual Send from new ChatWindow
    const handleSimulatorSend = async (text: string) => {
        if (!text.trim()) return;
        
        const hasCredit = await deductCredit();
        if (!hasCredit) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "⚠️ Insufficient Organization Credits.",
                sender: 'system',
                timestamp: new Date().toLocaleTimeString(),
                fullTimestamp: Date.now(),
                direction: 'outbound' // System messages shown as outbound-ish
             }]);
             return;
        }

        const targetPhone = selectedPhone || '+60123456789';
        setInput(''); 
        
        if (supabase && user) {
             const { error } = await supabase.from('messages').insert({
                user_id: user.id,
                text: text,
                sender: 'user', // Simulate Customer
                direction: 'inbound',
                phone: targetPhone,
                intent_tag: 'Processing...'
             });
             
             if (error) addLog(`Error: Failed to save to DB. ${error.message}`);

        } else {
            const demoId = Date.now().toString();
            setMessages(prev => [...prev, {
                id: demoId, text: text, sender: 'user', direction: 'inbound', 
                timestamp: new Date().toLocaleTimeString(), fullTimestamp: Date.now(), 
                phone: targetPhone, intent_tag: 'Analysing...'
            }]);
            
            setTimeout(async () => {
                 const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
                 const { intent, reply } = await processIncomingMessage(text, 'demo', systemInstructionRef.current, activeKey);
                 setMessages(prev => prev.map(m => m.id === demoId ? { ...m, intent_tag: intent } : m));
                 setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(), text: reply, sender: 'bot', direction: 'outbound', 
                    timestamp: new Date().toLocaleTimeString(), fullTimestamp: Date.now() + 1, phone: targetPhone
                }]);
            }, 1000);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            if (file.type === 'application/pdf') {
                try {
                    // Set worker source
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
                    
                    const arrayBuffer = await file.arrayBuffer();
                    // @ts-ignore
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        // @ts-ignore
                        const pageText = textContent.items.map((item: any) => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    setKnowledgeInput(fullText);
                    addLog(`System: PDF extracted (${pdf.numPages} pages).`);
                } catch (err) {
                    console.error("PDF Parse Error:", err);
                    addLog("Error: Failed to parse PDF file. Ensure it is a valid PDF.");
                }
            } else {
                // Fallback for text-based files
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const text = e.target?.result;
                    if (typeof text === 'string') {
                        setKnowledgeInput(text);
                    }
                };
                reader.readAsText(file);
            }
        }
    };

    const handleScrape = async () => {
        if (!urlInput || !supabase) return;
        setIsScraping(true);
        addLog(`System: Scraping content from ${urlInput}...`);
        
        try {
            // Increased timeout to 45s for heavier sites
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Request timed out (45s). Site might be slow or blocking bots.")), 45000)
            );

            const requestPromise = supabase.functions.invoke('openai-proxy', {
                body: { action: 'scrape', url: urlInput }
            });

            const { data, error } = await Promise.race([requestPromise, timeoutPromise]) as any;

            if (error) {
                // Handle specific transport errors
                console.error("Supabase Invoke Error:", error);
                if (error.message && (error.message.includes('non-2xx') || error.message.includes('404'))) {
                    throw new Error("Function not found or crashed. Please re-deploy 'openai-proxy' function using the provided code.");
                }
                if (error.message && error.message.includes('Failed to fetch')) {
                    throw new Error("Network error connecting to Supabase Edge Function. Check internet or CORS.");
                }
                throw error;
            }
            if (data?.error) throw new Error(data.error);
            
            if (data?.text) {
                setKnowledgeInput(data.text);
                addLog('System: Content scraped successfully.');
            } else {
                addLog('Warning: No content extracted from URL.');
            }
        } catch (e: any) {
            console.error("Scrape Error:", e);
            addLog(`Error: Scraping failed - ${e.message}`);
        } finally {
            setIsScraping(false);
        }
    };

    const addKnowledge = async () => {
        if (!knowledgeInput.trim() || !supabase || !organization) return;
        setIsEmbedding(true);
        try {
            const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
            // Replicating invokeAI logic for embedding
            const { data, error } = await supabase.functions.invoke('openai-proxy', {
                body: { 
                    action: 'embedding', 
                    apiKey: activeKey,
                    model: "text-embedding-3-small",
                    input: knowledgeInput,
                    dimensions: 768
                }
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            if (data?.data?.[0]?.embedding) {
                 const { error: dbError } = await supabase.from('knowledge').insert({
                    organization_id: organization.id,
                    content: knowledgeInput,
                    embedding: data.data[0].embedding,
                    metadata: { source: 'manual', date: new Date().toISOString() }
                });
                if (dbError) throw dbError;
                
                setKnowledgeInput('');
                addLog('System: Knowledge added successfully.');
                fetchKnowledgeBase();
            }
        } catch (e: any) {
            console.error("Add Knowledge Error:", e);
            addLog(`Error: ${e.message}`);
        } finally {
            setIsEmbedding(false);
        }
    };

    const checkWebhookReachability = async () => {
        if (!webhookUrl) return;
        setWebhookStatus('checking');
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                body: new URLSearchParams({
                    Body: 'Ping from Dashboard',
                    From: 'whatsapp:+0000000000',
                    To: 'whatsapp:+0000000000'
                })
            });
            if (response.ok) {
                setWebhookStatus('success');
                addLog('System: Webhook reachable.');
            } else {
                setWebhookStatus('error');
                addLog(`System: Webhook returned ${response.status}`);
            }
        } catch (e: any) {
            setWebhookStatus('error');
            addLog(`System: Webhook unreachable. ${e.message}`);
        }
    };

    if (mode === 'landing') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950/50">
                <div className="w-full max-w-lg space-y-8 animate-fadeInUp">
                    <div className="flex justify-center">
                        <div className="w-24 h-24 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-900/20 border border-slate-700">
                             <ChatIcon className="w-12 h-12 text-blue-400" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-4xl font-bold text-white tracking-tight">WhatsApp AI Integration</h2>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Connect your Twilio account to enable the AI Action Engine. 
                        </p>
                    </div>
                    <div className="pt-4 flex flex-col gap-4 items-center">
                        <Button 
                            size="lg" 
                            className="bg-blue-600 hover:bg-blue-500 text-white px-10 h-12 text-base shadow-lg shadow-blue-900/40 w-full sm:w-auto" 
                            onClick={() => setMode('setup')}
                        >
                            Connect WhatsApp
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'setup') {
        return (
            <div className="h-full overflow-y-auto p-4 lg:p-6 bg-slate-950/50">
                <div className="max-w-3xl mx-auto space-y-6 animate-fadeInUp">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white">Twilio Configuration</h1>
                            <p className="text-slate-400">Enter your credentials to link your number.</p>
                        </div>
                        <Button variant="ghost" onClick={() => setMode('landing')} className="text-slate-400 hover:text-white">
                            Cancel
                        </Button>
                    </div>
                    <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                        <form onSubmit={handleSaveConfig}>
                            <CardHeader>
                                <CardTitle>Connection Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-[#8A9A5B]">API Key</label>
                                    <Input value={apiKey} onChange={e => setApiKey(e.target.value)} className="bg-slate-950/50 border-[#8A9A5B]/50 font-mono" placeholder="OpenAI API Key (Optional if set in Backend Secrets)" type="password" />
                                    <p className="text-xs text-slate-500">
                                        Note: We recommend setting <code>OPENAI_API_KEY</code> in Supabase Secrets for production.
                                    </p>
                                </div>
                                <div className="border-t border-slate-800 my-4"></div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Account SID</label>
                                        <Input required value={accountSid} onChange={e => setAccountSid(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono" placeholder="AC..." />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Auth Token</label>
                                        <Input type="password" required value={authToken} onChange={e => setAuthToken(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono" placeholder="Token..." />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Your Twilio Phone Number</label>
                                    <Input required value={myPhoneNumber} onChange={e => setMyPhoneNumber(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono text-blue-300" placeholder="+1234567890" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Webhook URL</label>
                                    <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono" placeholder="https://..." />
                                </div>
                                <div className="space-y-2 pt-4 border-t border-slate-800">
                                    <label className="text-sm font-medium">System Instructions</label>
                                    <textarea className="w-full bg-slate-950/50 border border-slate-700 rounded-md p-3 text-sm h-32 focus:ring-1 focus:ring-blue-500" value={systemInstruction} onChange={e => setSystemInstruction(e.target.value)} placeholder="You are a helpful assistant..." />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 w-full">
                                    {loading ? 'Saving...' : 'Save & Connect'}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-950">
            <header className="border-b border-slate-800 bg-slate-900/50 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
                    <h1 className="font-bold text-white tracking-wide">AI Action Engine</h1>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 hidden sm:inline-flex">
                        {webhookUrl ? 'Live Backend' : 'Simulator Mode'}
                    </Badge>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Credits</div>
                        <div className={cn("text-sm font-mono font-bold", organization ? ((organization.credits > 0) ? "text-green-400" : "text-red-400") : "text-slate-400")}>
                            {organization ? organization.credits : <span className="animate-pulse">...</span>}
                        </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white" onClick={() => setMode('setup')}>
                        Config
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="chat" className="h-full flex flex-col">
                    <div className="px-6 pt-2 bg-[#0b101a] border-b border-slate-800 shrink-0">
                         <TabsList className="bg-transparent h-12 gap-6 p-0">
                            <TabsTrigger 
                                value="chat" 
                                className="h-full rounded-none border-b-2 border-transparent px-2 pb-3 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:border-blue-500 data-[state=active]:text-white transition-all data-[state=active]:bg-transparent"
                            >
                                Live Chats
                            </TabsTrigger>
                            <TabsTrigger 
                                value="knowledge" 
                                className="h-full rounded-none border-b-2 border-transparent px-2 pb-3 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:border-blue-500 data-[state=active]:text-white transition-all data-[state=active]:bg-transparent"
                            >
                                Knowledge Base (RAG)
                            </TabsTrigger>
                            <TabsTrigger 
                                value="status" 
                                className="h-full rounded-none border-b-2 border-transparent px-2 pb-3 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:border-blue-500 data-[state=active]:text-white transition-all data-[state=active]:bg-transparent"
                            >
                                Connection Status
                            </TabsTrigger>
                            <TabsTrigger 
                                value="logs" 
                                className="h-full rounded-none border-b-2 border-transparent px-2 pb-3 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:border-blue-500 data-[state=active]:text-white transition-all data-[state=active]:bg-transparent"
                            >
                                System Logs
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="chat" className="flex-1 overflow-hidden flex m-0 relative min-h-0 bg-[#0b101a]">
                        <div className={cn(
                            "flex-col border-r border-slate-800 bg-slate-900/30 transition-all",
                            selectedPhone ? "hidden md:flex w-[320px]" : "flex w-full md:w-[320px]"
                        )}>
                            <ChatList 
                                chats={chats} 
                                selectedPhone={selectedPhone} 
                                onSelect={setSelectedPhone}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                            />
                        </div>
                        <div className={cn(
                            "flex-col bg-[#0b101a] relative transition-all",
                            selectedPhone ? "flex flex-1" : "hidden md:flex flex-1"
                        )}>
                            <ChatWindow 
                                selectedPhone={selectedPhone}
                                messages={(selectedPhone && chats.find(([p]) => p === selectedPhone)?.[1]) || []}
                                onSendMessage={handleSimulatorSend}
                                input={input}
                                setInput={setInput}
                                aiStatus={aiStatus}
                                onBack={() => setSelectedPhone(null)}
                                onAnalyze={classifyMessage}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="knowledge" className="flex-1 overflow-y-auto p-6 m-0">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Knowledge Base</h2>
                                    <p className="text-sm text-slate-400">Add documents or website content to train your AI agent.</p>
                                </div>
                            </div>
                            
                            <Card className="border border-slate-700/50 bg-slate-900/40 text-white">
                                <CardHeader><CardTitle className="text-sm">Add New Knowledge</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Import Sources Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                                        <div className="flex gap-2 items-center">
                                            <Input 
                                                placeholder="https://example.com/property" 
                                                value={urlInput} 
                                                onChange={(e) => setUrlInput(e.target.value)} 
                                                className="bg-slate-950 border-slate-700 h-10" 
                                            />
                                            <Button 
                                                variant="outline" 
                                                onClick={handleScrape} 
                                                disabled={isScraping || !urlInput}
                                                className="border-slate-700 hover:bg-slate-800"
                                            >
                                                {isScraping ? 'Scraping...' : 'Import URL'}
                                            </Button>
                                        </div>
                                        <div className="flex justify-end gap-2 items-center">
                                            <span className="text-xs text-slate-500">or upload file:</span>
                                            <Input 
                                                type="file" 
                                                className="hidden" 
                                                ref={fileInputRef} 
                                                onChange={handleFileUpload} 
                                                accept=".txt,.md,.csv,.json,.pdf,.docx" 
                                            />
                                            <Button 
                                                variant="outline" 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-slate-700 hover:bg-slate-800"
                                            >
                                                Upload File (PDF/Text)
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Content Editor */}
                                    <textarea 
                                        value={knowledgeInput} 
                                        onChange={(e) => setKnowledgeInput(e.target.value)} 
                                        className="w-full h-48 bg-slate-950/50 border border-slate-700 rounded-md p-3 text-sm focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed" 
                                        placeholder="Content from files or URLs will appear here for review before saving..." 
                                    />
                                    
                                    <div className="flex justify-between items-center pt-2">
                                        <p className="text-xs text-slate-500">Content is converted to vectors using OpenAI Embeddings.</p>
                                        <Button onClick={addKnowledge} disabled={isEmbedding || !knowledgeInput.trim()} className="bg-blue-600 hover:bg-blue-500 px-6">
                                            {isEmbedding ? 'Vectorizing...' : 'Save to Knowledge Base'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {knowledgeItems.map((item) => (
                                    <Card key={item.id} className="border border-slate-800 bg-slate-900/20">
                                        <CardContent className="p-4">
                                            <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed">{item.content}</p>
                                            <div className="mt-3 flex justify-between items-center text-[10px] text-slate-500"><span>ID: {item.id}</span><Badge variant="outline" className="border-slate-800">Chunk</Badge></div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                     </TabsContent>

                    <TabsContent value="status" className="flex-1 overflow-y-auto p-6 m-0">
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
                    </TabsContent>

                    <TabsContent value="logs" className="flex-1 overflow-hidden m-0 bg-[#0c0c0c] text-white p-4 font-mono text-xs">
                         <div className="h-full overflow-y-auto space-y-1">
                            {logs.map((log, i) => (
                                <div key={i} className="border-b border-white/5 pb-1">
                                    <span className="text-slate-500 mr-3">{log.split(']')[0]}]</span>
                                    <span className={cn(log.includes('Error') ? "text-red-400" : log.includes('Realtime') ? "text-blue-400" : log.includes('Brain') ? "text-yellow-400" : "text-green-400")}>{log.split(']')[1]}</span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                         </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
}

export default AIChatPage;
