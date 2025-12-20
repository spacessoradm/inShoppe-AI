
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";

// Types for the simulator
interface SimMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

const AIChatPage: React.FC = () => {
    // Configuration State
    const [isConfigured, setIsConfigured] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showToken, setShowToken] = useState(false);
    
    // Credentials
    const [accountSid, setAccountSid] = useState('');
    const [authToken, setAuthToken] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    
    // Webhook Configuration
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookStatus, setWebhookStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    
    // AI & Vector DB Configuration
    const [systemInstruction, setSystemInstruction] = useState(
        "You are inShoppe AI, a polite and efficient sales assistant. Always check the context before answering. Keep answers concise for WhatsApp."
    );
    const [knowledgeBase, setKnowledgeBase] = useState(
        "Product: ProBuds X\nPrice: RM299\nStock: Available\nFeatures: Noise Cancellation, 30h Battery\nShipping: Free (2-3 days in Malaysia)\nReturn Policy: 30 days money back."
    );

    // Simulator State
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const [input, setInput] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load saved config on mount
    useEffect(() => {
        const savedConfig = localStorage.getItem('twilio_user_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            setAccountSid(parsed.accountSid || '');
            setAuthToken(parsed.authToken || '');
            setPhoneNumber(parsed.phoneNumber || '');
            setWebhookUrl(parsed.webhookUrl || '');
            if (parsed.systemInstruction) setSystemInstruction(parsed.systemInstruction);
            if (parsed.knowledgeBase) setKnowledgeBase(parsed.knowledgeBase);
            
            if (parsed.accountSid && parsed.authToken) {
                setIsConfigured(true);
            }
        }
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const addLog = (text: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 49)]);
    };

    const checkWebhookReachability = async () => {
        if (!webhookUrl) return;
        if (webhookUrl.includes("api.inshoppe.ai")) {
             setWebhookStatus('error');
             addLog('Error: "api.inshoppe.ai" is a placeholder. You must deploy your own backend.');
             return;
        }

        setWebhookStatus('checking');
        addLog(`System: Pinging ${webhookUrl}...`);
        
        try {
            // We verify by sending a dummy POST. 
            // Note: This might fail with CORS if the backend doesn't allow it, but that's a hint in itself.
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ Body: 'Ping', From: 'SystemCheck' })
            });
            
            if (res.ok || res.status === 200) {
                setWebhookStatus('success');
                addLog('System: Webhook is reachable (200 OK).');
            } else {
                setWebhookStatus('error');
                addLog(`Error: Webhook returned status ${res.status}.`);
            }
        } catch (e) {
            // Often CORS errors in browser, but implies connectivity issues
            setWebhookStatus('error');
            addLog('Error: Failed to reach Webhook. Is CORS enabled? Is the URL public?');
        }
    };

    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        // Simulate validating credentials
        setTimeout(() => {
            localStorage.setItem('twilio_user_config', JSON.stringify({
                accountSid, authToken, phoneNumber, systemInstruction, knowledgeBase, webhookUrl
            }));
            setLoading(false);
            setIsConfigured(true);
            addLog('System: Configuration saved.');
            if (webhookUrl) {
                addLog(`System: Registered Webhook: ${webhookUrl}`);
            } else {
                 addLog(`System: No backend Webhook URL configured. Simulation Mode active.`);
            }
        }, 1000);
    };

    const handleDisconnect = () => {
        setIsConfigured(false);
        setMessages([]);
        setLogs([]);
    };

    // --- Simulator Logic ---
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        // 1. Simulate Incoming Webhook
        const userMsg: SimMessage = {
            id: Date.now().toString(),
            text: input,
            sender: 'user', 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        
        addLog(`Webhook (Simulated): Incoming from Customer -> ${phoneNumber}`);
        addLog(`Payload: { Body: "${userMsg.text}" }`);
        
        // 2. AI Processing
        addLog(`AI Processing: Embedding query...`);
        await new Promise(resolve => setTimeout(resolve, 800)); 
        
        try {
            // NOTE: In production, this call happens on your server (Supabase Edge Function)
            // We do it client-side here ONLY for simulation/testing purposes.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const ragPrompt = `
            You are an AI assistant for a business.
            CONTEXT: ${knowledgeBase}
            RULES: ${systemInstruction}
            QUERY: ${userMsg.text}
            Answer concisely.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: ragPrompt,
            });

            const replyText = response.text || "I'm having trouble thinking right now.";

            addLog(`Gemini AI: Generated response.`);
            addLog(`Twilio API: POST /Messages.json`);

            const botMsg: SimMessage = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'sent'
            };
            
            setMessages(prev => [...prev, botMsg]);
            
            setTimeout(() => {
                setMessages(prev => prev.map(m => m.id === botMsg.id ? { ...m, status: 'delivered' } : m));
            }, 1000);

        } catch (error) {
            console.error("AI Error:", error);
            addLog(`Error: Failed to connect to AI Engine.`);
        }
    };

    // The code snippet to display for Supabase Edge Functions
    const supabaseFunctionCode = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. Setup Supabase Client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // 2. Handle Twilio Webhook Verification (Optional)
  const url = new URL(req.url);
  
  // 3. Parse Incoming Message
  const formData = await req.formData();
  const Body = formData.get('Body')?.toString() || '';
  const From = formData.get('From')?.toString() || '';
  const AccountSid = formData.get('AccountSid')?.toString();

  if (!Body) return new Response('No Body', { status: 200 });

  console.log(\`Received message from \${From}: \${Body}\`);

  // 4. Store in Database (triggers Realtime updates)
  const { error } = await supabase
    .from('messages')
    .insert([{ 
        text: Body, 
        sender: 'user', 
        phone: From,
        metadata: { twilio_sid: AccountSid }
    }])

  // 5. Call AI (Gemini) here OR trigger another function
  // ... Add your Gemini logic here ...

  // 6. Respond to Twilio (TwiML)
  // Returning empty TwiML tells Twilio "We received it, don't reply automatically"
  return new Response('<Response></Response>', {
    headers: { "Content-Type": "text/xml" },
  });
})`;

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
             <div className="max-w-[1400px] mx-auto space-y-6">
                 {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Twilio Integration</h1>
                        <p className="text-slate-400">Manage your WhatsApp connection and AI behavior.</p>
                    </div>
                    {isConfigured && (
                        <div className="flex items-center gap-2">
                             <Badge className={cn("px-3 py-1", webhookUrl && webhookStatus !== 'error' ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50")}>
                                {webhookUrl ? "● Live Backend Configured" : "○ Simulation Mode"}
                            </Badge>
                            <Button variant="destructive" onClick={handleDisconnect} size="sm" className="ml-2">Edit Config</Button>
                        </div>
                    )}
                </div>

                {!isConfigured ? (
                    <Tabs defaultValue="credentials" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-4 bg-slate-800">
                            <TabsTrigger value="credentials" className="data-[state=active]:bg-slate-700">Credentials</TabsTrigger>
                            <TabsTrigger value="backend" className="data-[state=active]:bg-slate-700">Backend Setup</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="credentials">
                            <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
                                <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                                    <CardHeader>
                                        <CardTitle>Connection Details</CardTitle>
                                        <CardDescription className="text-slate-400">
                                            Enter your credentials from the Twilio Console.
                                        </CardDescription>
                                    </CardHeader>
                                    <form onSubmit={handleSaveConfig}>
                                        <CardContent className="space-y-6">
                                            {/* Twilio Inputs */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Account SID <span className="text-red-400">*</span></label>
                                                    <Input placeholder="ACxxxxxxxx..." required value={accountSid} onChange={(e) => setAccountSid(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Auth Token <span className="text-red-400">*</span></label>
                                                    <div className="relative">
                                                        <Input type={showToken ? "text" : "password"} placeholder="Enter token" required value={authToken} onChange={(e) => setAuthToken(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono pr-10" />
                                                        <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                                            {showToken ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Webhook Input */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-medium flex items-center gap-2">
                                                        Webhook URL (Backend)
                                                        <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30">Supabase Function</Badge>
                                                    </label>
                                                    <button type="button" onClick={checkWebhookReachability} className="text-xs text-slate-400 hover:text-white underline">
                                                        Test Connection
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        placeholder="https://[project-id].supabase.co/functions/v1/whatsapp" 
                                                        value={webhookUrl}
                                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                                        className={cn(
                                                            "bg-slate-950/50 border-slate-700 font-mono text-blue-300",
                                                            webhookStatus === 'error' && "border-red-500 focus:ring-red-500"
                                                        )}
                                                    />
                                                </div>
                                                {webhookStatus === 'error' && (
                                                    <p className="text-xs text-red-400">
                                                        Connection Failed. Ensure this URL is publicly accessible and returns 200 OK.
                                                    </p>
                                                )}
                                                {webhookStatus === 'success' && (
                                                    <p className="text-xs text-green-400">
                                                        Connection Successful! Twilio can reach this URL.
                                                    </p>
                                                )}
                                                <p className="text-xs text-slate-500">
                                                    Don't have a backend? Leave blank to use <strong>Simulator Mode</strong>. To receive real messages, follow the "Backend Setup" tab.
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">WhatsApp Phone Number</label>
                                                <Input placeholder="+1 415 555 1234" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono" />
                                            </div>

                                            <div className="space-y-2 pt-6 border-t border-slate-800">
                                                <label className="text-sm font-medium flex items-center gap-2 text-blue-400">
                                                    <BotIcon className="h-4 w-4" />
                                                    AI System Instructions
                                                </label>
                                                <textarea className="flex min-h-[80px] w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="Define behavior..." value={systemInstruction} onChange={(e) => setSystemInstruction(e.target.value)} />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center gap-2 text-purple-400">
                                                    <DatabaseIcon className="h-4 w-4" />
                                                    Knowledge Base Context
                                                </label>
                                                <textarea className="flex min-h-[120px] w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Paste product info..." value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)} />
                                            </div>
                                        </CardContent>
                                        <CardFooter className="border-t border-slate-800/50 pt-6 bg-slate-900/20">
                                            <Button type="submit" disabled={loading || !accountSid || !authToken} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                                                {loading ? 'Validating...' : 'Save Configuration'}
                                            </Button>
                                        </CardFooter>
                                    </form>
                                </Card>
                                
                                <div className="space-y-6">
                                    <Card className="border border-red-900/30 bg-red-900/10 text-slate-300">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium text-red-200">Fixing Error 11200</CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm space-y-4">
                                            <p className="text-slate-400">
                                                <strong>Twilio Error 11200</strong> means "HTTP Retrieval Failure". Twilio cannot reach your Webhook URL.
                                            </p>
                                            <p className="text-slate-400">
                                                <strong>Cause:</strong> You are likely using a placeholder URL or localhost which isn't public.
                                            </p>
                                            <p className="text-slate-400">
                                                <strong>Solution:</strong> Go to the "Backend Setup" tab, copy the code, deploy it to Supabase Edge Functions, and paste the <strong>new URL</strong> here.
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="backend">
                             <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                                <CardHeader>
                                    <CardTitle>Supabase Edge Function</CardTitle>
                                    <CardDescription>Deploy this code to Supabase to handle incoming Twilio webhooks.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-slate-400">
                                        1. Create a new function: <code>supabase functions new whatsapp</code><br/>
                                        2. Paste the code below into <code>index.ts</code><br/>
                                        3. Deploy: <code>supabase functions deploy whatsapp --no-verify-jwt</code><br/>
                                        4. Use the deployed URL as your Webhook URL.
                                    </p>
                                    <div className="relative">
                                        <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-xs text-green-400 font-mono border border-slate-800 max-h-[400px]">
                                            <code>{supabaseFunctionCode}</code>
                                        </pre>
                                        <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => navigator.clipboard.writeText(supabaseFunctionCode)}>Copy Code</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                ) : (
                    // CONNECTED / DASHBOARD STATE
                    <div className="grid gap-6 lg:grid-cols-12 h-[calc(100vh-200px)] min-h-[600px]">
                        
                        {/* LEFT COL: Connection Info */}
                        <div className="lg:col-span-4 space-y-6 flex flex-col h-full overflow-y-auto pr-2">
                            <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white shadow-md">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-semibold">Live Webhook Status</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {webhookUrl ? (
                                        <>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-slate-500 uppercase font-bold">Current Endpoint</label>
                                                <Input readOnly value={webhookUrl} className="h-9 text-xs bg-black border-slate-800 font-mono text-blue-300" />
                                            </div>
                                            <div className="pt-2 flex items-center gap-2 text-xs text-green-400">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                Listening for POST requests...
                                            </div>
                                             <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                                                Check <a href="https://console.twilio.com/us1/monitor/logs/debugger" target="_blank" className="text-blue-400 hover:underline">Twilio Debugger</a> if messages fail to arrive.
                                            </p>
                                        </>
                                    ) : (
                                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md text-xs text-yellow-200">
                                            <strong>Simulator Mode Only</strong><br/>
                                            No backend webhook configured. Real WhatsApp messages will not appear here. Use the chat input on the right to test logic.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="flex-1 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white flex flex-col min-h-[200px]">
                                <CardHeader className="py-3 px-4 border-b border-slate-800">
                                    <CardTitle className="text-xs font-mono uppercase text-slate-500">System Logs</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5 bg-black/40">
                                    {logs.length === 0 && <span className="text-slate-600 italic">Logs will appear here...</span>}
                                    {logs.map((log, i) => (
                                        <div key={i} className="border-b border-slate-800/30 pb-1 break-all">
                                            <span className="text-slate-500 mr-2">{log.split(']')[0]}]</span>
                                            <span className={cn(
                                                log.includes('Error') ? "text-red-400" :
                                                log.includes('Webhook') ? "text-blue-400" :
                                                log.includes('Gemini') ? "text-purple-400" :
                                                "text-green-400"
                                            )}>{log.split(']')[1]}</span>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT COL: Simulator */}
                        <div className="lg:col-span-8 flex flex-col h-full">
                            <Card className="h-full border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white flex flex-col overflow-hidden shadow-2xl">
                                <CardHeader className="py-3 px-4 border-b border-slate-800 bg-slate-900/60 flex flex-row justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.888.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.978zm11.374-10.213c-2.269-1.156-3.354-1.637-4.326-.775-.826.734-1.936 2.373-2.399 2.146-.666-.326-3.141-1.472-5.06-3.391-1.919-1.919-3.065-4.394-3.391-5.06-.227-.463 1.412-1.573 2.146-2.399.862-.972.381-2.057-.775-4.326-.887-1.742-1.258-1.947-1.706-1.968-.432-.02-3.102-.02-3.481 1.218-.328 1.071 1.259 6.255 7.152 12.148 5.893 5.893 11.077 7.48 12.148 7.152 1.238-.379 1.238-3.049 1.218-3.481-.021-.448-.226-.819-1.968-1.706z"/></svg>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">Simulator & Preview</h3>
                                            <p className="text-[10px] text-slate-400">Monitoring: {phoneNumber || 'Your Number'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" className="h-7 text-xs border border-slate-700 hover:bg-slate-800" onClick={() => { setIsConfigured(false); }}>
                                            Edit Config
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')] bg-repeat bg-[length:400px]">
                                    {messages.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 opacity-80">
                                            <div className="bg-slate-200/80 p-4 rounded-full">
                                                <BotIcon className="h-8 w-8 text-slate-600" />
                                            </div>
                                            <p className="text-sm font-medium bg-white/80 px-4 py-1 rounded-full shadow-sm text-center">
                                                Simulator Ready.<br/>
                                                <span className="text-xs font-normal text-slate-500">Send a message below to test your AI logic logic immediately.</span>
                                            </p>
                                        </div>
                                    )}
                                    {messages.map(msg => (
                                        <div key={msg.id} className={cn("flex w-full", msg.sender === 'bot' ? "justify-end" : "justify-start")}>
                                            <div className={cn(
                                                "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words relative",
                                                msg.sender === 'bot' 
                                                    ? "bg-[#d9fdd3] text-gray-900 rounded-tr-none"
                                                    : msg.sender === 'system'
                                                    ? "bg-red-100 border border-red-200 text-red-800 text-xs w-full text-center"
                                                    : "bg-white text-gray-900 rounded-tl-none"
                                            )}>
                                                {msg.sender === 'user' && <span className="text-[10px] font-bold text-slate-500 block mb-1">Customer</span>}
                                                {msg.sender === 'bot' && <span className="text-[10px] font-bold text-green-700 block mb-1">AI Agent</span>}
                                                {msg.text}
                                                <div className="flex justify-end items-center gap-1 mt-1">
                                                    <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                                                    {msg.sender === 'bot' && (
                                                        <span className={cn("text-[10px]", 
                                                            msg.status === 'read' ? "text-blue-500" : "text-gray-400"
                                                        )}>
                                                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </CardContent>
                                <CardFooter className="p-3 bg-[#f0f2f5] border-t border-slate-300 flex flex-col gap-2">
                                    <div className="w-full text-xs text-center text-slate-400 font-medium">
                                        Simulate Incoming Message (Test AI)
                                    </div>
                                    <form onSubmit={handleSendMessage} className="flex w-full gap-2 items-center">
                                        <Button type="button" size="icon" variant="ghost" className="text-slate-500">
                                            <PlusIcon className="h-6 w-6" />
                                        </Button>
                                        <div className="flex-1 relative">
                                            <Input 
                                                value={input} 
                                                onChange={e => setInput(e.target.value)} 
                                                placeholder="Type what a customer would say..." 
                                                className="bg-white border-none focus-visible:ring-0 rounded-lg h-10 py-2 px-4 shadow-sm text-black placeholder:text-gray-500"
                                            />
                                        </div>
                                        {input.trim() ? (
                                            <Button type="submit" size="icon" className="bg-[#00a884] hover:bg-[#008f6f] h-10 w-10">
                                                <SendIcon className="h-5 w-5 text-white" />
                                            </Button>
                                        ) : (
                                            <Button type="button" size="icon" variant="ghost" className="text-slate-500">
                                                 <MicIcon className="h-6 w-6" />
                                            </Button>
                                        )}
                                    </form>
                                </CardFooter>
                            </Card>
                        </div>
                    </div>
                )}
             </div>
        </div>
    );
};

// --- Icons ---
function BotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  )
}

function DatabaseIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s 9-1.34 9-3V5" />
        </svg>
    )
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" x2="11" y1="2" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    )
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.44 0 .87-.03 1.28-.08" />
            <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
    )
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}

function MicIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="23" />
            <line x1="8" x2="16" y1="23" y2="23" />
        </svg>
    )
}

export default AIChatPage;
