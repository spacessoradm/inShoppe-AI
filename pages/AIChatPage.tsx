
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";

// Types for the simulator
interface SimMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: string;
}

const AIChatPage: React.FC = () => {
    // Configuration State
    const [isConfigured, setIsConfigured] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Credentials
    const [accountSid, setAccountSid] = useState('AC_b92384729384723984729384723984');
    const [authToken, setAuthToken] = useState('6283472384723894723894723894723');
    const [sandboxNumber, setSandboxNumber] = useState('+1 415 523 8886');
    const [sandboxCode, setSandboxCode] = useState('join sweet-potato');
    
    // AI & Vector DB Configuration
    const [systemInstruction, setSystemInstruction] = useState(
        "You are inShoppe AI, a helpful sales assistant. Answer based on the retrieved context."
    );
    const [knowledgeBase, setKnowledgeBase] = useState(
        "Product: ProBuds X\nPrice: RM299\nBattery: 30 Hours\nWarranty: 2 Years\nShipping: Free nationwide (2-3 days)."
    );

    // Simulator State
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const [input, setInput] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load saved config on mount
    useEffect(() => {
        const savedConfig = localStorage.getItem('twilio_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            setAccountSid(parsed.accountSid);
            setAuthToken(parsed.authToken);
            setSandboxNumber(parsed.sandboxNumber);
            setSandboxCode(parsed.sandboxCode);
            if (parsed.systemInstruction) setSystemInstruction(parsed.systemInstruction);
            if (parsed.knowledgeBase) setKnowledgeBase(parsed.knowledgeBase);
            setIsConfigured(true);
            addLog('System: Configuration loaded from local storage.');
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

    const handleConnect = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        // Simulate validation
        setTimeout(() => {
            localStorage.setItem('twilio_config', JSON.stringify({
                accountSid, authToken, sandboxNumber, sandboxCode, systemInstruction, knowledgeBase
            }));
            setLoading(false);
            setIsConfigured(true);
            addLog('System: Credentials validated and saved.');
            addLog('System: Vector Database Index Updated.');
        }, 1000);
    };

    const handleDisconnect = () => {
        setIsConfigured(false);
        localStorage.removeItem('twilio_config');
        setMessages([]);
        setLogs([]);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg: SimMessage = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        
        // 1. Webhook Received
        addLog(`Webhook: Incoming Message from +15550001234`);
        
        // 2. Vector DB Retrieval Simulation
        addLog(`Vector DB: Search query embedding for OrgID: org_8823...`);
        
        // Simulate network delay for vector search
        await new Promise(resolve => setTimeout(resolve, 600)); 
        
        addLog(`Vector DB: Found relevant context (Score: 0.92).`);
        addLog(`RAG: Injecting context into prompt...`);

        try {
            // CALL REAL AI MODEL with RAG Context
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Construct the RAG Prompt
            const ragPrompt = `
            Context information is below.
            ---------------------
            ${knowledgeBase}
            ---------------------
            Given the context information and not prior knowledge, answer the query.
            User Query: ${userMsg.text}
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: ragPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    maxOutputTokens: 200,
                }
            });

            const replyText = response.text || "I'm having trouble thinking right now.";

            const botMsg: SimMessage = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            
            setMessages(prev => [...prev, botMsg]);
            addLog(`API: Generated response via Gemini 2.5 Flash`);
            addLog(`Twilio: Message sent to user.`);

        } catch (error) {
            console.error("AI Error:", error);
            addLog(`Error: Failed to generate AI response. Check API Key.`);
            
            // Fallback for demo
            const fallbackMsg: SimMessage = {
                id: (Date.now() + 1).toString(),
                text: "[System Error: AI Service Unavailable]",
                sender: 'system',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, fallbackMsg]);
        }
    };

    // Generate Deep Link for WhatsApp
    const cleanNumber = sandboxNumber.replace(/[^0-9]/g, '');
    const encodedCode = encodeURIComponent(sandboxCode);
    const whatsappLink = `https://wa.me/${cleanNumber}?text=${encodedCode}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(whatsappLink)}`;

    // Mock Webhook URL for display
    const webhookUrl = `https://your-project.supabase.co/functions/v1/whatsapp-webhook`;

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
             <div className="max-w-[1400px] mx-auto space-y-8">
                 {/* Page Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Twilio Sandbox Manager</h1>
                        <p className="text-slate-400">Connect to Twilio's WhatsApp Sandbox to test your AI agent in real-time.</p>
                    </div>
                    {isConfigured && (
                        <Button variant="destructive" onClick={handleDisconnect} size="sm">Disconnect Configuration</Button>
                    )}
                </div>

                {!isConfigured ? (
                    // SETUP STATE
                    <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
                        <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                            <CardHeader>
                                <CardTitle>Sandbox Configuration</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Enter your Twilio API credentials. You can find these in the Twilio Console under Account Info.
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={handleConnect}>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Account SID</label>
                                            <Input 
                                                placeholder="AC..." 
                                                required 
                                                value={accountSid}
                                                onChange={(e) => setAccountSid(e.target.value)}
                                                className="bg-slate-950/50 border-slate-700 font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Auth Token</label>
                                            <Input 
                                                type="password" 
                                                required
                                                value={authToken}
                                                onChange={(e) => setAuthToken(e.target.value)}
                                                className="bg-slate-950/50 border-slate-700 font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <div className="space-y-2">
                                            <label className="text-sm font-medium">Sandbox Number</label>
                                            <Input 
                                                required 
                                                value={sandboxNumber}
                                                onChange={(e) => setSandboxNumber(e.target.value)}
                                                className="bg-slate-950/50 border-slate-700 font-mono"
                                            />
                                        </div>
                                         <div className="space-y-2">
                                            <label className="text-sm font-medium">Sandbox Join Code</label>
                                            <Input 
                                                required 
                                                value={sandboxCode}
                                                onChange={(e) => setSandboxCode(e.target.value)}
                                                className="bg-slate-950/50 border-slate-700 font-mono"
                                                placeholder="join word-word"
                                            />
                                            <p className="text-xs text-slate-500">Found in Messaging {'>'} Try it out {'>'} Send a WhatsApp message</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-slate-800">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            <BotIcon className="h-4 w-4 text-blue-400" />
                                            System Instructions (AI Persona)
                                        </label>
                                        <textarea 
                                            className="flex min-h-[80px] w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-slate-200"
                                            placeholder="You are a helpful assistant..."
                                            value={systemInstruction}
                                            onChange={(e) => setSystemInstruction(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            <DatabaseIcon className="h-4 w-4 text-purple-400" />
                                            Knowledge Base (Vector DB Content)
                                        </label>
                                        <textarea 
                                            className="flex min-h-[120px] w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-slate-200"
                                            placeholder="Enter product details, pricing, policies..."
                                            value={knowledgeBase}
                                            onChange={(e) => setKnowledgeBase(e.target.value)}
                                        />
                                        <p className="text-xs text-slate-500">
                                            The system will simulate retrieving this information (RAG) when answering user queries.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t border-slate-800/50 pt-6">
                                    <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-500">
                                        {loading ? 'Initializing Vector Store...' : 'Save & Initialize AI Brain'}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                        
                        <div className="space-y-6">
                             <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                                <h3 className="font-semibold text-white mb-2 text-sm">RAG Architecture</h3>
                                <p className="text-sm text-slate-400 mb-2">
                                    This module simulates a <strong>Retrieval-Augmented Generation</strong> pipeline:
                                </p>
                                <ol className="list-decimal list-inside text-xs text-slate-500 space-y-1">
                                    <li>User sends WhatsApp message</li>
                                    <li>System embeds query & searches Vector DB</li>
                                    <li>Relevant content is retrieved</li>
                                    <li>Gemini generates answer using that context</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                ) : (
                    // CONNECTED / DASHBOARD STATE
                    <div className="grid gap-6 lg:grid-cols-3 h-[600px]">
                        
                        {/* LEFT COL: Connection Status & Webhook Info */}
                        <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
                            <Card className="border border-green-500/30 bg-green-500/5 backdrop-blur-xl text-white">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                                        Active Sandbox
                                    </CardTitle>
                                    <CardDescription>Scan to connect your real device</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center justify-center gap-6">
                                    <div className="p-2 bg-white rounded-xl shadow-lg">
                                        <img src={qrUrl} alt="Join Sandbox QR" className="w-32 h-32 mix-blend-multiply" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <code className="bg-slate-950 px-3 py-1 rounded text-lg font-mono text-green-400 block">{sandboxCode}</code>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="flex-1 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white flex flex-col">
                                <CardHeader className="py-4">
                                    <CardTitle className="text-sm uppercase text-slate-500">Production Webhook Setup</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-xs text-slate-400">
                                        To enable the <strong>Real AI</strong> on your phone, paste this URL into your Twilio Sandbox Configuration:
                                    </p>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-blue-400">WHEN A MESSAGE COMES IN</label>
                                        <div className="flex gap-2">
                                            <Input readOnly value={webhookUrl} className="h-8 text-xs bg-black border-slate-800 font-mono text-blue-300" />
                                            <Button size="sm" variant="secondary" className="h-8">Copy</Button>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-800">
                                        <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold mb-2">
                                            <DatabaseIcon className="h-3 w-3" />
                                            Vector DB Status
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Index: <span className="text-green-400">Active</span><br/>
                                            Org ID: <span className="text-slate-300">org_8823_a9b1</span><br/>
                                            Documents: <span className="text-slate-300">1 (Knowledge Base)</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT COL: Simulator & Logs */}
                        <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                            
                            {/* Live Simulator */}
                            <Card className="flex-1 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white flex flex-col overflow-hidden shadow-2xl">
                                <CardHeader className="py-3 px-4 border-b border-slate-800 bg-slate-900/60 flex flex-row justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <BotIcon className="h-5 w-5 text-red-500" />
                                        <span className="font-semibold">AI Bot Simulator (RAG Enabled)</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" className="h-6 text-[10px] border border-slate-700" onClick={() => { setIsConfigured(false); }}>Edit Knowledge Base</Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
                                    {messages.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50">
                                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                                                <BotIcon className="h-6 w-6" />
                                            </div>
                                            <p className="text-sm">Type a message to test RAG retrieval...</p>
                                        </div>
                                    )}
                                    {messages.map(msg => (
                                        <div key={msg.id} className={cn("flex w-full", msg.sender === 'user' ? "justify-end" : "justify-start")}>
                                            <div className={cn(
                                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-md whitespace-pre-wrap break-words",
                                                msg.sender === 'user' 
                                                    ? "bg-red-600 text-white rounded-br-none" 
                                                    : msg.sender === 'system'
                                                    ? "bg-red-900/50 border border-red-500/50 text-red-200 text-xs"
                                                    : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700"
                                            )}>
                                                {msg.text}
                                                <p className="text-[10px] opacity-50 mt-1 text-right">{msg.timestamp}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </CardContent>
                                <CardFooter className="p-3 bg-slate-900 border-t border-slate-800">
                                    <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                                        <Input 
                                            value={input} 
                                            onChange={e => setInput(e.target.value)} 
                                            placeholder="Ask a question based on your Knowledge Base..." 
                                            className="bg-slate-950 border-slate-700 focus:ring-red-500/50"
                                        />
                                        <Button type="submit" size="icon" className="bg-red-600 hover:bg-red-500">
                                            <SendIcon className="h-4 w-4" />
                                        </Button>
                                    </form>
                                </CardFooter>
                            </Card>

                            {/* System Logs */}
                            <Card className="h-[150px] border border-slate-700/50 bg-black/40 backdrop-blur-xl text-white flex flex-col">
                                <CardHeader className="py-2 px-4 border-b border-slate-800">
                                    <CardTitle className="text-xs font-mono uppercase text-slate-500">Live Execution Logs</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-2 font-mono text-xs text-green-400 space-y-1">
                                    {logs.map((log, i) => (
                                        <div key={i} className="border-b border-slate-800/30 pb-0.5">{log}</div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
             </div>
        </div>
    );
};

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

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
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

export default AIChatPage;
