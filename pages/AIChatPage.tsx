
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
import { MASTER_SQL_SCRIPT } from '../components/SupabaseSetup';
import { processIncomingMessage } from '../services/aiEngine';

// Types
interface SimMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system';
  direction?: 'inbound' | 'outbound';
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
    const { action, apiKey, ...payload } = await req.json()
    
    // 1. Resolve API Key
    const finalApiKey = apiKey || Deno.env.get('OPENAI_API_KEY')
    
    if (!finalApiKey) {
      // Return 200 with error field so frontend can read the message instead of getting a generic 500
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY. Set it in Supabase Secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      })
    }

    const openai = new OpenAI({ apiKey: finalApiKey })

    // 2. Route Action
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
    // Return error as JSON so frontend can display it
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 to bypass generic Supabase error handlers
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
    // UPDATED DEFAULT SYSTEM INSTRUCTION FOR SENIOR AGENT PERSONA
    const [systemInstruction, setSystemInstruction] = useState(
        "You are a Senior Real Estate Sales Agent at inShoppe. Your primary objective is to QUALIFY leads, ADVANCE them to the next sales step, and SECURE VIEWING BOOKINGS or human handover. Be confident, professional, and helpful."
    );
    const systemInstructionRef = useRef(systemInstruction);

    // --- State: Knowledge Base ---
    const [knowledgeInput, setKnowledgeInput] = useState('');
    const [isEmbedding, setIsEmbedding] = useState(false);
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

    const classifyMessage = async (msgId: string, text: string, verbose = true) => {
        if (!supabase || !user) return;
        if (verbose) setAiStatus('Classifying...');
        try {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, intent_tag: 'Analysing...' } : m));
            
            const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
            
            const { intent } = await processIncomingMessage(
                text, 
                user.id,
                systemInstructionRef.current,
                activeKey
            );
            
            await supabase.from('messages').update({ intent_tag: intent }).eq('id', msgId);
            if (verbose) setAiStatus('');
        } catch (e) {
            console.error("Classification error", e);
            if (verbose) setAiStatus('Error');
        }
    };

    const processAndReplyToMessage = async (msgId: string, text: string, phone: string) => {
        if (!supabase || !user) return;
        
        addLog(`AI Brain: 🧠 Processing message [${msgId}]...`);
        setAiStatus('Analyzing...');

        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, intent_tag: 'Analysing...' } : m));

        try {
            const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
            
            const { intent, reply, contextUsed } = await processIncomingMessage(
                text,
                user.id,
                systemInstructionRef.current,
                activeKey
            );

            await supabase.from('messages').update({ intent_tag: intent }).eq('id', msgId);

            setAiStatus(contextUsed ? 'Searching Knowledge...' : 'Replying...');
            await new Promise(resolve => setTimeout(resolve, 500));

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
                            direction: msg.direction,
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
                            direction: newMsg.direction,
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedPhone, mode, aiStatus]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        addLog(`System: Parsing ${file.name}...`);

        try {
            let text = '';
            
            if (file.type === 'application/pdf') {
                const pdfjsImport = await import('pdfjs-dist/build/pdf');
                const pdfjsLib = pdfjsImport.default || pdfjsImport;
                
                if (pdfjsLib.GlobalWorkerOptions) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
                }

                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ 
                    data: arrayBuffer,
                    cMapUrl: 'https://aistudiocdn.com/pdfjs-dist@4.0.379/cmaps/',
                    cMapPacked: true,
                });
                const pdf = await loadingTask.promise;
                const maxPages = pdf.numPages;
                
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    text += pageText + '\n\n';
                }
            } else {
                text = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target?.result as string);
                    reader.onerror = (error) => reject(error);
                    reader.readAsText(file);
                });
            }

            if (!text || text.trim().length === 0) {
                addLog("Warning: No text extracted. File might be empty.");
                return;
            }

            setKnowledgeInput(text.slice(0, 15000));
            addLog(`System: Extracted ${text.length} chars. Ready to vectorize.`);

        } catch (error: any) {
            console.error("File parsing error:", error);
            addLog(`Error parsing file: ${error.message}`);
        }
    };

    const addKnowledge = async () => {
        if (!knowledgeInput.trim() || !supabase || !organization) return;
        setIsEmbedding(true);
        addLog("System: Vectorizing content...");

        try {
            const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
            
            const { data, error: proxyError } = await supabase.functions.invoke('openai-proxy', {
                body: { 
                    action: 'embedding', 
                    apiKey: activeKey, 
                    model: "text-embedding-3-small", 
                    input: knowledgeInput 
                }
            });

            if (proxyError) throw new Error(proxyError.message || "Proxy Error");
            if (data.error) throw new Error(data.error);
            
            const embedding = data.data[0].embedding;
            
            if (!embedding) throw new Error("Failed to generate embedding: No values returned.");

            const { error } = await supabase.from('knowledge').insert({
                organization_id: organization.id,
                content: knowledgeInput,
                embedding: embedding
            });

            if (error) throw error;
            addLog("System: Knowledge saved to Vector DB.");
            setKnowledgeInput('');
            fetchKnowledgeBase();

        } catch (err: any) {
            console.error(err);
            addLog(`Error: ${err.message}`);
        } finally {
            setIsEmbedding(false);
        }
    };

    const handleSimulatorSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        const hasCredit = await deductCredit();
        if (!hasCredit) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "⚠️ Insufficient Organization Credits.",
                sender: 'system',
                timestamp: new Date().toLocaleTimeString(),
                fullTimestamp: Date.now(),
             }]);
             return;
        }

        const targetPhone = selectedPhone || '+60123456789';
        const msgText = input;
        setInput(''); 

        if (supabase && user) {
             const { error } = await supabase.from('messages').insert({
                user_id: user.id,
                text: msgText,
                sender: 'user',
                direction: 'inbound',
                phone: targetPhone,
                intent_tag: 'Processing...'
             });
             
             if (error) addLog(`Error: Failed to save to DB. ${error.message}`);

        } else {
            const demoId = Date.now().toString();
            setMessages(prev => [...prev, {
                id: demoId, text: msgText, sender: 'user', direction: 'inbound', 
                timestamp: new Date().toLocaleTimeString(), fullTimestamp: Date.now(), 
                phone: targetPhone, intent_tag: 'Analysing...'
            }]);
            
            setTimeout(async () => {
                 const activeKey = apiKey || getEnv('VITE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY');
                 const { intent, reply } = await processIncomingMessage(msgText, 'demo', systemInstruction, activeKey);
                 setMessages(prev => prev.map(m => m.id === demoId ? { ...m, intent_tag: intent } : m));
                 setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(), text: reply, sender: 'bot', direction: 'outbound', 
                    timestamp: new Date().toLocaleTimeString(), fullTimestamp: Date.now() + 1, phone: targetPhone
                }]);
            }, 1000);
        }
    };

    const checkWebhookReachability = async () => {
        if (!webhookUrl) return;
        setWebhookStatus('checking');
        try {
            await fetch(webhookUrl, { method: 'POST', body: JSON.stringify({ type: 'ping' }), mode: 'no-cors' });
            setWebhookStatus('success');
        } catch (e) {
            setWebhookStatus('error');
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
                    <div className="px-4 pt-2 bg-slate-900/50 border-b border-slate-800 shrink-0">
                         <TabsList className="bg-transparent gap-4">
                            <TabsTrigger value="chat" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">Live Chats</TabsTrigger>
                            <TabsTrigger value="knowledge" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">Knowledge Base (RAG)</TabsTrigger>
                            <TabsTrigger value="status" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">Connection Status</TabsTrigger>
                            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">System Logs</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="chat" className="flex-1 overflow-hidden flex m-0">
                        <div className="w-[300px] border-r border-slate-800 flex flex-col bg-slate-900/30">
                            <div className="p-3 border-b border-slate-800">
                                <Input placeholder="Search chats..." className="bg-slate-950 border-slate-800 h-8 text-xs" />
                            </div>
                            <div className="flex-1 overflow-y-auto relative">
                                {isHistoryLoading && chats.length === 0 && (
                                     <div className="p-4 text-center">
                                         <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                         <p className="text-xs text-slate-500">Syncing history...</p>
                                     </div>
                                )}
                                {!isHistoryLoading && chats.length === 0 && (
                                    <div className="p-4 text-center text-xs text-slate-500">No active chats</div>
                                )}
                                {chats.map(([phone, msgs]) => (
                                    <div key={phone} onClick={() => setSelectedPhone(phone)} className={cn("p-3 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors", selectedPhone === phone && "bg-slate-800 border-l-2 border-l-blue-500")}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-sm text-slate-200">{phone}</span>
                                            <span className="text-[10px] text-slate-500">{msgs[msgs.length-1].timestamp}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate pr-2">
                                            {msgs[msgs.length-1].direction === 'outbound' ? 'You: ' : ''}
                                            {msgs[msgs.length-1].text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col bg-[#0b101a] relative">
                            {selectedPhone ? (
                                <>
                                    <div className="h-14 border-b border-slate-800 flex items-center px-4 bg-slate-900/60 backdrop-blur justify-between">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">{selectedPhone.slice(1,3)}</div>
                                            <div className="ml-3">
                                                <h3 className="text-sm font-semibold text-white">{selectedPhone}</h3>
                                                <p className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active now</p>
                                            </div>
                                        </div>
                                        {aiStatus && (
                                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 shadow-lg shadow-blue-900/20">
                                                <div className="flex gap-1">
                                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                                                </div>
                                                <span className="text-xs text-blue-300 font-medium">{aiStatus}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')] bg-repeat bg-[length:400px]">
                                        {(chats.find(([p]) => p === selectedPhone)?.[1] || []).map(msg => (
                                            <div key={msg.id} className={cn("flex w-full flex-col", msg.direction === 'outbound' ? "items-end" : "items-start")}>
                                                 {(msg.sender === 'user' || msg.direction === 'inbound') && (
                                                     <div className="flex items-center gap-1 mb-1 ml-1 animate-fadeInUp">
                                                         {msg.intent_tag ? (
                                                             <span className="text-[9px] text-blue-300 bg-blue-900/60 border border-blue-800 px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm uppercase tracking-wider font-semibold">
                                                                 {(msg.intent_tag === 'Analysing...' || msg.intent_tag === 'Processing...') && <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5 animate-pulse"></span>}
                                                                 {msg.intent_tag}
                                                             </span>
                                                         ) : (
                                                             <button onClick={() => classifyMessage(msg.id, msg.text)} className="text-[9px] text-slate-500 hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-full hover:bg-slate-800/50">✨ Analyze</button>
                                                         )}
                                                     </div>
                                                 )}
                                                 <div className={cn("max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm relative", msg.direction === 'outbound' ? "bg-[#005c4b] text-white rounded-tr-none" : msg.sender === 'system' ? "bg-red-900/50 text-red-200 border border-red-800" : "bg-slate-800 text-slate-200 rounded-tl-none")}>
                                                    {msg.text}
                                                    <div className="flex justify-between items-center mt-1 gap-2">
                                                        <span className="text-[9px] text-white/40 uppercase">{msg.direction}</span>
                                                        <span className="text-[10px] text-white/50">{msg.timestamp}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                    <form onSubmit={handleSimulatorSend} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                                        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message (Simulates User Input)..." className="bg-slate-950 border-slate-700" />
                                        <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-500"><SendIcon className="w-4 h-4" /></Button>
                                    </form>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                    <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-4"><ChatIcon className="h-8 w-8 text-slate-600" /></div>
                                    <p>Select a conversation to start chatting</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="knowledge" className="flex-1 overflow-y-auto p-6 m-0">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Knowledge Base</h2>
                                    <p className="text-sm text-slate-400">Upload documents (PDF/Word/Text) to train your AI agent.</p>
                                </div>
                                <div className="flex gap-2">
                                     <Input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.csv,.json,.pdf,.docx" />
                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Upload File</Button>
                                </div>
                            </div>
                            <Card className="border border-slate-700/50 bg-slate-900/40 text-white">
                                <CardHeader><CardTitle className="text-sm">Add New Knowledge</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <textarea value={knowledgeInput} onChange={(e) => setKnowledgeInput(e.target.value)} className="w-full h-32 bg-slate-950/50 border border-slate-700 rounded-md p-3 text-sm focus:ring-1 focus:ring-blue-500" placeholder="Paste text here or upload a file..." />
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-slate-500">Note: Content is converted to vectors using OpenAI Embeddings via Proxy.</p>
                                        <Button onClick={addKnowledge} disabled={isEmbedding || !knowledgeInput.trim()} className="bg-blue-600 hover:bg-blue-500">{isEmbedding ? 'Vectorizing...' : 'Add to Knowledge Base'}</Button>
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
                            
                            {/* OpenAI Proxy Code Display */}
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
function SendIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
}
function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}

export default AIChatPage;
