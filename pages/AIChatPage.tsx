
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../services/supabase';

// Types
interface SimMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: string; // Display time
  fullTimestamp: number; // Sorting
  phone?: string; // Grouping
  status?: 'sent' | 'delivered' | 'read';
}

type ViewMode = 'landing' | 'setup' | 'dashboard';

const AIChatPage: React.FC = () => {
    // --- View State ---
    const [mode, setMode] = useState<ViewMode>('landing');
    
    // --- State: Configuration ---
    const [loading, setLoading] = useState(false);
    
    // --- State: Credentials ---
    const [accountSid, setAccountSid] = useState('');
    const [authToken, setAuthToken] = useState('');
    const [myPhoneNumber, setMyPhoneNumber] = useState('');
    
    // --- State: Webhook ---
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookStatus, setWebhookStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    
    // --- State: AI ---
    const [systemInstruction, setSystemInstruction] = useState(
        "You are inShoppe AI, a polite sales assistant. Keep answers concise."
    );
    const [knowledgeBase, setKnowledgeBase] = useState(
        "Product: ProBuds X\nPrice: RM299\nStock: Available"
    );

    // --- State: Data ---
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [input, setInput] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- Derived State: Group Messages by Phone ---
    const chats = useMemo(() => {
        const groups: Record<string, SimMessage[]> = {};
        
        messages.forEach(msg => {
            // Ignore system messages for the chat grouping unless they have a phone attached
            const key = msg.phone || 'System Logs';
            if (msg.sender === 'system' && key === 'System Logs') return;
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(msg);
        });
        
        // Sort keys by latest message timestamp
        return Object.entries(groups).sort(([, a], [, b]) => {
            const lastA = a[a.length - 1].fullTimestamp;
            const lastB = b[b.length - 1].fullTimestamp;
            return lastB - lastA;
        });
    }, [messages]);

    // --- Effect: Load Config ---
    useEffect(() => {
        const savedConfig = localStorage.getItem('twilio_user_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            setAccountSid(parsed.accountSid || '');
            setAuthToken(parsed.authToken || '');
            setMyPhoneNumber(parsed.phoneNumber || '');
            setWebhookUrl(parsed.webhookUrl || '');
            if (parsed.systemInstruction) setSystemInstruction(parsed.systemInstruction);
            if (parsed.knowledgeBase) setKnowledgeBase(parsed.knowledgeBase);
            
            // Only jump straight to dashboard if fully configured
            if (parsed.accountSid && parsed.authToken) {
                setMode('dashboard');
            } else {
                setMode('landing');
            }
        }
    }, []);

    // --- Effect: Realtime Subscription ---
    useEffect(() => {
        if (!supabase || mode !== 'dashboard') return;

        // 1. Initial Fetch
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                const formatted: SimMessage[] = data.reverse().map((msg: any) => ({
                    id: msg.id.toString(),
                    text: msg.text,
                    sender: msg.sender === 'user' ? 'user' : 'bot',
                    timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    fullTimestamp: new Date(msg.created_at).getTime(),
                    phone: msg.phone,
                    status: 'delivered'
                }));
                setMessages(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newMsgs = formatted.filter(f => !existingIds.has(f.id));
                    return [...prev, ...newMsgs];
                });
            }
        };

        if (webhookUrl) fetchHistory();

        // 2. Subscribe
        const channel = supabase
            .channel('chat-updates')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new;
                    addLog(`Realtime: 📩 Message from ${newMsg.phone}`);
                    
                    const formattedMsg: SimMessage = {
                        id: newMsg.id.toString(),
                        text: newMsg.text,
                        sender: newMsg.sender === 'user' ? 'user' : 'bot',
                        timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        fullTimestamp: new Date(newMsg.created_at).getTime(),
                        phone: newMsg.phone,
                        status: 'delivered'
                    };
                    
                    setMessages(prev => [...prev, formattedMsg]);
                    
                    // Auto-select this phone if none selected
                    if (!selectedPhone) {
                        setSelectedPhone(newMsg.phone);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [mode, webhookUrl]);

    // --- Auto Scroll ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedPhone, mode]);

    // --- Helpers ---
    const addLog = (text: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 49)]);
    };

    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            localStorage.setItem('twilio_user_config', JSON.stringify({
                accountSid, authToken, phoneNumber: myPhoneNumber, systemInstruction, knowledgeBase, webhookUrl
            }));
            setLoading(false);
            setMode('dashboard');
            addLog('System: Configuration saved.');
        }, 800);
    };

    const checkWebhookReachability = async () => {
        if (!webhookUrl) return;
        setWebhookStatus('checking');
        addLog(`System: Pinging ${webhookUrl}...`);
        
        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ Body: 'PingTest', From: 'SystemCheck' })
            });
            
            if (res.ok || res.status === 200) {
                setWebhookStatus('success');
                addLog('System: Webhook Reachable (200 OK).');
            } else {
                setWebhookStatus('error');
                addLog(`Error: Webhook returned ${res.status}.`);
            }
        } catch (e) {
            setWebhookStatus('error');
            addLog('Error: Connection failed (CORS or Network).');
        }
    };

    // --- Simulator Send ---
    const handleSimulatorSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        const targetPhone = selectedPhone || '+60123456789';

        const userMsg: SimMessage = {
            id: Date.now().toString(),
            text: input,
            sender: 'user', 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullTimestamp: Date.now(),
            phone: targetPhone
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        
        await new Promise(resolve => setTimeout(resolve, 800)); 
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const ragPrompt = `
            You are an AI assistant.
            CONTEXT: ${knowledgeBase}
            RULES: ${systemInstruction}
            QUERY: ${userMsg.text}
            Answer concisely.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: ragPrompt,
            });

            const replyText = response.text || "Thinking...";
            addLog(`Gemini AI: Generated response for ${targetPhone}`);

            const botMsg: SimMessage = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                fullTimestamp: Date.now() + 1,
                phone: targetPhone,
                status: 'sent'
            };
            
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            addLog(`Error: AI Engine failed.`);
        }
    };

    // --- RENDER 1: Landing View ---
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
                            Automate replies, capture leads, and manage bookings directly from WhatsApp.
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
                        <p className="text-xs text-slate-500">
                            Takes about 2 minutes to setup credentials
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER 2: Setup View ---
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
                                <CardDescription>Found in your Twilio Console Dashboard.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
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
                                    <label className="text-sm font-medium">Webhook URL (Optional for Simulator)</label>
                                    <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="bg-slate-950/50 border-slate-700 text-blue-300 font-mono" placeholder="https://..." />
                                    <p className="text-xs text-slate-500">Leave blank to use internal Simulator only.</p>
                                </div>
                                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">System Instructions (AI Personality)</label>
                                        <textarea className="w-full bg-slate-950/50 border border-slate-700 rounded-md p-3 text-sm h-32 focus:ring-1 focus:ring-blue-500" value={systemInstruction} onChange={e => setSystemInstruction(e.target.value)} placeholder="You are a helpful assistant..." />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Knowledge Base (Product Info)</label>
                                        <textarea className="w-full bg-slate-950/50 border border-slate-700 rounded-md p-3 text-sm h-32 focus:ring-1 focus:ring-blue-500" value={knowledgeBase} onChange={e => setKnowledgeBase(e.target.value)} placeholder="Price list, policies, etc..." />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 w-full">
                                    {loading ? 'Validating...' : 'Save & Connect'}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        );
    }

    // --- RENDER 3: Dashboard View (Main) ---
    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-950">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/50 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
                    <h1 className="font-bold text-white tracking-wide">AI Action Engine</h1>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                        {webhookUrl ? 'Live Backend' : 'Simulator Mode'}
                    </Badge>
                </div>
                <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white" onClick={() => setMode('setup')}>
                    Config
                </Button>
            </header>

            {/* Tabs Content */}
            <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="chat" className="h-full flex flex-col">
                    <div className="px-4 pt-2 bg-slate-900/50 border-b border-slate-800 shrink-0">
                         <TabsList className="bg-transparent gap-4">
                            <TabsTrigger value="chat" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">
                                Live Chats
                            </TabsTrigger>
                            <TabsTrigger value="status" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">
                                Webhook Status
                            </TabsTrigger>
                            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">
                                System Logs
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* TAB 1: Live Chat Interface */}
                    <TabsContent value="chat" className="flex-1 overflow-hidden flex m-0">
                        {/* Sidebar: Chat List */}
                        <div className="w-[300px] border-r border-slate-800 flex flex-col bg-slate-900/30">
                            <div className="p-3 border-b border-slate-800">
                                <Input placeholder="Search chats..." className="bg-slate-950 border-slate-800 h-8 text-xs" />
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {chats.length === 0 && (
                                    <div className="p-4 text-center text-xs text-slate-500">No active chats</div>
                                )}
                                {chats.map(([phone, msgs]) => (
                                    <div 
                                        key={phone} 
                                        onClick={() => setSelectedPhone(phone)}
                                        className={cn(
                                            "p-3 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors",
                                            selectedPhone === phone && "bg-slate-800 border-l-2 border-l-blue-500"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-sm text-slate-200">{phone}</span>
                                            <span className="text-[10px] text-slate-500">{msgs[msgs.length-1].timestamp}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate pr-2">
                                            {msgs[msgs.length-1].sender === 'bot' ? 'You: ' : ''}
                                            {msgs[msgs.length-1].text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Main: Chat View */}
                        <div className="flex-1 flex flex-col bg-[#0b101a] relative">
                            {selectedPhone ? (
                                <>
                                    {/* Chat Header */}
                                    <div className="h-14 border-b border-slate-800 flex items-center px-4 bg-slate-900/60 backdrop-blur">
                                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                                            {selectedPhone.slice(1,3)}
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-sm font-semibold text-white">{selectedPhone}</h3>
                                            <p className="text-[10px] text-green-400 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active now
                                            </p>
                                        </div>
                                    </div>

                                    {/* Messages Area */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')] bg-repeat bg-[length:400px]">
                                        {(chats.find(([p]) => p === selectedPhone)?.[1] || []).map(msg => (
                                            <div key={msg.id} className={cn("flex w-full", msg.sender === 'bot' ? "justify-end" : "justify-start")}>
                                                 <div className={cn(
                                                    "max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm relative",
                                                    msg.sender === 'bot' ? "bg-[#005c4b] text-white rounded-tr-none" : "bg-slate-800 text-slate-200 rounded-tl-none"
                                                )}>
                                                    {msg.text}
                                                    <span className="text-[10px] text-white/50 block text-right mt-1">{msg.timestamp}</span>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Area */}
                                    <form onSubmit={handleSimulatorSend} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                                        <Input 
                                            value={input} 
                                            onChange={e => setInput(e.target.value)}
                                            placeholder="Type a message (Simulates User Input if using Simulator)..." 
                                            className="bg-slate-950 border-slate-700"
                                        />
                                        <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-500">
                                            <SendIcon className="w-4 h-4" />
                                        </Button>
                                    </form>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                    <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                        <ChatIcon className="h-8 w-8 text-slate-600" />
                                    </div>
                                    <p>Select a conversation to start chatting</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* TAB 2: Webhook Status */}
                    <TabsContent value="status" className="flex-1 overflow-y-auto p-6 m-0">
                        <div className="max-w-2xl mx-auto space-y-6">
                            <Card className="border border-slate-700/50 bg-slate-900/40 text-white">
                                <CardHeader>
                                    <CardTitle>Webhook Connection</CardTitle>
                                    <CardDescription>Test connectivity between Twilio and your Supabase backend.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input readOnly value={webhookUrl || "No URL Configured"} className="bg-slate-950 font-mono text-blue-300" />
                                        <Button onClick={checkWebhookReachability}>Test Ping</Button>
                                    </div>
                                    
                                    {webhookStatus === 'success' && (
                                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-400 text-sm flex items-center gap-2">
                                            <CheckCircleIcon className="w-4 h-4" /> Connection Successful (200 OK)
                                        </div>
                                    )}
                                    {webhookStatus === 'error' && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
                                            Connection Failed. Ensure your Edge Function is deployed and has CORS enabled.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border border-slate-700/50 bg-slate-900/40 text-white">
                                <CardHeader>
                                    <CardTitle>Backend Deployment</CardTitle>
                                    <CardDescription>Supabase Edge Function code required for this integration.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-xs text-green-400 font-mono border border-slate-800 max-h-[300px]">
{`import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
      const formData = await req.formData();
      const Body = formData.get('Body')?.toString() || '';
      const From = formData.get('From')?.toString() || '';

      if (!Body) return new Response('Ping', { headers: corsHeaders });

      await supabase.from('messages').insert([{ text: Body, sender: 'user', phone: From }])

      return new Response('<Response></Response>', { headers: { "Content-Type": "text/xml", ...corsHeaders } });
  } catch (err) {
      return new Response(String(err), { status: 500, headers: corsHeaders })
  }
})`}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Deploy command: <code>supabase functions deploy whatsapp --no-verify-jwt</code></p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB 3: Logs */}
                    <TabsContent value="logs" className="flex-1 overflow-hidden m-0 bg-[#0c0c0c] text-white p-4 font-mono text-xs">
                         <div className="h-full overflow-y-auto space-y-1">
                            {logs.map((log, i) => (
                                <div key={i} className="border-b border-white/5 pb-1">
                                    <span className="text-slate-500 mr-3">{log.split(']')[0]}]</span>
                                    <span className={cn(
                                        log.includes('Error') ? "text-red-400" : 
                                        log.includes('Realtime') ? "text-blue-400" : "text-green-400"
                                    )}>
                                        {log.split(']')[1]}
                                    </span>
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

// --- Icons ---
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
