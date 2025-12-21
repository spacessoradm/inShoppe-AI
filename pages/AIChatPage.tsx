
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MASTER_SQL_SCRIPT } from '../components/SupabaseSetup';

// Types
interface SimMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system';
  direction?: 'inbound' | 'outbound';
  timestamp: string; // Display time
  fullTimestamp: number; // Sorting
  phone?: string; // Grouping
  status?: 'sent' | 'delivered' | 'read';
}

interface KnowledgeItem {
    id: number;
    content: string;
    similarity?: number;
}

type ViewMode = 'landing' | 'setup' | 'dashboard';

const AIChatPage: React.FC = () => {
    const { user, profile, organization, deductCredit } = useAuth();
    const navigate = useNavigate();

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
        "You are inShoppe AI, a polite sales assistant. You MUST strictly use the provided Context to answer. If the answer isn't in the context, say 'I am not sure, please contact our support team'."
    );

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

    // --- Effect: Load Config from LocalStorage ---
    useEffect(() => {
        const savedConfig = localStorage.getItem('twilio_user_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            setAccountSid(parsed.accountSid || '');
            setAuthToken(parsed.authToken || '');
            // We set phone number here, but Profile DB takes precedence below
            if (!myPhoneNumber) setMyPhoneNumber(parsed.phoneNumber || ''); 
            setWebhookUrl(parsed.webhookUrl || '');
            if (parsed.systemInstruction) setSystemInstruction(parsed.systemInstruction);
            
            // If we have credentials locally, go to dashboard
            if (parsed.accountSid && parsed.authToken) {
                setMode('dashboard');
            }
        }
    }, []);

    // --- Effect: Load Config from DB Profile (Persistence across devices) ---
    useEffect(() => {
        if (profile?.twilio_phone_number) {
            console.log("Syncing Phone from Profile:", profile.twilio_phone_number);
            setMyPhoneNumber(profile.twilio_phone_number);
            
            // If user has a linked number in DB, allow access to dashboard immediately (Simulator Mode)
            // even if they haven't re-entered SID/Token on this specific device yet.
            if (mode === 'landing') {
                setMode('dashboard');
            }
        }
    }, [profile, mode]);

    // --- Effect: Load Knowledge Base (Shared by Org) ---
    useEffect(() => {
        if (!supabase || mode !== 'dashboard' || !organization) return;
        fetchKnowledgeBase();
    }, [mode, organization]);

    // --- Effect: Realtime Subscription (Isolated by User ID) ---
    useEffect(() => {
        if (!supabase || mode !== 'dashboard' || !user) return;

        const fetchHistory = async () => {
            // Updated: Fetch messages based on user_id, NOT organization_id
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('user_id', user.id) // IMPORTANT: User Isolation
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                const formatted: SimMessage[] = data.reverse().map((msg: any) => ({
                    id: msg.id.toString(),
                    text: msg.text,
                    // Map direction to sender if direction exists, else fallback
                    sender: msg.direction === 'inbound' ? 'user' : (msg.sender === 'user' ? 'user' : 'bot'),
                    direction: msg.direction,
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

        const channel = supabase
            .channel('chat-updates')
            .on(
                'postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages',
                    filter: `user_id=eq.${user.id}` // IMPORTANT: Listen for specific User ID
                },
                (payload) => {
                    const newMsg = payload.new;
                    addLog(`Realtime: 📩 New ${newMsg.direction} message`);
                    
                    const formattedMsg: SimMessage = {
                        id: newMsg.id.toString(),
                        text: newMsg.text,
                        sender: newMsg.direction === 'inbound' ? 'user' : 'bot',
                        direction: newMsg.direction,
                        timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        fullTimestamp: new Date(newMsg.created_at).getTime(),
                        phone: newMsg.phone,
                        status: 'delivered'
                    };
                    
                    setMessages(prev => [...prev, formattedMsg]);
                    
                    if (!selectedPhone) {
                        setSelectedPhone(newMsg.phone);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [mode, webhookUrl, user]);

    // --- Auto Scroll ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedPhone, mode]);

    // --- Helpers ---
    const addLog = (text: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 49)]);
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // 1. Save to Local Storage (Client preference)
        localStorage.setItem('twilio_user_config', JSON.stringify({
            accountSid, authToken, phoneNumber: myPhoneNumber, systemInstruction, webhookUrl
        }));

        // 2. Save Phone Mapping to Supabase Profile (Server persistence)
        if (supabase && user && myPhoneNumber) {
             try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ twilio_phone_number: myPhoneNumber })
                    .eq('id', user.id);
                
                if (error) {
                    addLog(`Error: Failed to link phone number to profile: ${error.message}`);
                } else {
                    addLog('System: Phone number linked to User Profile.');
                }
             } catch (err) {
                 console.error("Profile update failed", err);
             }
        }

        setTimeout(() => {
            setLoading(false);
            setMode('dashboard');
            addLog('System: Configuration saved.');
        }, 800);
    };

    // --- Knowledge Base Logic (RAG) ---
    
    const fetchKnowledgeBase = async () => {
        if (!supabase || !organization) return;
        // Knowledge is still tied to Organization ID (Shared context)
        const { data } = await supabase
            .from('knowledge')
            .select('id, content')
            .eq('organization_id', organization.id)
            .limit(20);
            
        if (data) setKnowledgeItems(data);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        addLog(`System: Parsing ${file.name}...`);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            setKnowledgeInput(text.slice(0, 5000));
            addLog(`System: Extracted ${text.length} chars. Ready to vectorize.`);
        };
        reader.readAsText(file);
    };

    const getAiClient = () => {
        try {
            const env = (import.meta as any).env;
            const apiKey = env?.VITE_GOOGLE_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : undefined);
            if (!apiKey) throw new Error("Missing API Key");
            return new GoogleGenAI({ apiKey });
        } catch (e) {
            console.error("Failed to init AI client", e);
            throw e;
        }
    };

    const addKnowledge = async () => {
        if (!knowledgeInput.trim() || !supabase || !organization) return;
        setIsEmbedding(true);
        addLog("System: Vectorizing content...");

        try {
            const ai = getAiClient();
            const embeddingResult = await ai.models.embedContent({
                model: "text-embedding-004",
                contents: knowledgeInput,
            });
            const embedding = embeddingResult.embeddings?.[0]?.values;

            if (!embedding) throw new Error("Failed to generate embedding");

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
            addLog(`Error: ${err.message}`);
        } finally {
            setIsEmbedding(false);
        }
    };

    // --- AI RAG Logic ---
    const handleSimulatorSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        // --- 1. Credit Check ---
        const hasCredit = await deductCredit();
        if (!hasCredit) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "⚠️ Insufficient Organization Credits. Please upgrade your plan in Settings.",
                sender: 'system',
                timestamp: new Date().toLocaleTimeString(),
                fullTimestamp: Date.now(),
                phone: selectedPhone || undefined
             }]);
             return;
        }

        const targetPhone = selectedPhone || '+60123456789';

        // 1. Display User Message (Inbound Simulation)
        const userMsg: SimMessage = {
            id: Date.now().toString(),
            text: input,
            sender: 'user', 
            direction: 'inbound', // Mark as Received
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullTimestamp: Date.now(),
            phone: targetPhone
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // 2. Save User Message to DB (Simulation Mode)
        if (supabase && user && webhookUrl) {
             await supabase.from('messages').insert({
                user_id: user.id,
                text: input,
                sender: 'user',
                direction: 'inbound',
                phone: targetPhone,
                intent_tag: 'Simulation'
             });
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        try {
            const ai = getAiClient();
            
            // 3. Semantic Search (RAG)
            let contextText = "No specific knowledge found in uploaded files.";
            
            if (supabase && organization) {
                const embeddingResult = await ai.models.embedContent({
                    model: "text-embedding-004",
                    contents: userMsg.text,
                });
                const queryEmbedding = embeddingResult.embeddings?.[0]?.values;
                
                if (queryEmbedding) {
                    const { data: searchResults } = await supabase.rpc('match_knowledge', {
                        query_embedding: queryEmbedding,
                        match_threshold: 0.5,
                        match_count: 3
                    });

                    if (searchResults && searchResults.length > 0) {
                        addLog(`System: Found ${searchResults.length} relevant knowledge chunks.`);
                        contextText = searchResults.map((r: any) => r.content).join("\n---\n");
                    }
                }
            }

            // 4. Generate Answer
            const ragPrompt = `
            SYSTEM: ${systemInstruction}
            RELEVANT CONTEXT: ${contextText}
            USER QUERY: ${userMsg.text}
            INSTRUCTIONS: Use Context to answer. If unsure, say "Please contact support".
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: ragPrompt,
            });

            const replyText = response.text || "Thinking...";

            const botMsg: SimMessage = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: 'bot',
                direction: 'outbound', // Mark as Sent
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                fullTimestamp: Date.now() + 1,
                phone: targetPhone,
                status: 'sent'
            };
            
            setMessages(prev => [...prev, botMsg]);

            // 5. Save Bot Message to DB
            if (supabase && user && webhookUrl) {
                await supabase.from('messages').insert({
                   user_id: user.id,
                   text: replyText,
                   sender: 'bot',
                   direction: 'outbound',
                   phone: targetPhone
                });
           }

        } catch (error) {
            console.error(error);
            addLog(`Error: AI Engine failed.`);
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
                                    <label className="text-sm font-medium">Your Twilio Phone Number</label>
                                    <Input required value={myPhoneNumber} onChange={e => setMyPhoneNumber(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono text-blue-300" placeholder="+1234567890" />
                                    <p className="text-xs text-slate-500">Must match the number in your Twilio account exactly (e.g., +15551234567). This maps incoming messages to your user ID.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Webhook URL (Optional for Simulator)</label>
                                    <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="bg-slate-950/50 border-slate-700 font-mono" placeholder="https://..." />
                                </div>
                                <div className="space-y-2 pt-4 border-t border-slate-800">
                                    <label className="text-sm font-medium">System Instructions (AI Personality)</label>
                                    <textarea className="w-full bg-slate-950/50 border border-slate-700 rounded-md p-3 text-sm h-32 focus:ring-1 focus:ring-blue-500" value={systemInstruction} onChange={e => setSystemInstruction(e.target.value)} placeholder="You are a helpful assistant..." />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 w-full">
                                    {loading ? 'Validating & Linking...' : 'Save & Connect'}
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
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 hidden sm:inline-flex">
                        {webhookUrl ? 'Live Backend' : 'Simulator Mode'}
                    </Badge>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Credits</div>
                        <div className={cn("text-sm font-mono font-bold", (organization?.credits || 0) > 0 ? "text-green-400" : "text-red-400")}>
                            {organization?.credits || 0}
                        </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white" onClick={() => setMode('setup')}>
                        Config
                    </Button>
                </div>
            </header>

            {/* Tabs Content */}
            <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="knowledge" className="h-full flex flex-col">
                    <div className="px-4 pt-2 bg-slate-900/50 border-b border-slate-800 shrink-0">
                         <TabsList className="bg-transparent gap-4">
                            <TabsTrigger value="chat" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">
                                Live Chats
                            </TabsTrigger>
                            <TabsTrigger value="knowledge" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-2 px-1">
                                Knowledge Base (RAG)
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
                                            {msgs[msgs.length-1].direction === 'outbound' ? 'You: ' : ''}
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
                                            <div key={msg.id} className={cn("flex w-full", msg.direction === 'outbound' ? "justify-end" : "justify-start")}>
                                                 <div className={cn(
                                                    "max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm relative",
                                                    msg.direction === 'outbound' ? "bg-[#005c4b] text-white rounded-tr-none" : 
                                                    msg.sender === 'system' ? "bg-red-900/50 text-red-200 border border-red-800" :
                                                    "bg-slate-800 text-slate-200 rounded-tl-none"
                                                )}>
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

                                    {/* Input Area */}
                                    <form onSubmit={handleSimulatorSend} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                                        <Input 
                                            value={input} 
                                            onChange={e => setInput(e.target.value)}
                                            placeholder="Type a message (Simulates User Input)..." 
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

                    {/* TAB 2: Knowledge Base (RAG) */}
                     <TabsContent value="knowledge" className="flex-1 overflow-y-auto p-6 m-0">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Knowledge Base</h2>
                                    <p className="text-sm text-slate-400">Upload documents (PDF/Word/Text) to train your AI agent.</p>
                                </div>
                                <div className="flex gap-2">
                                     <Input 
                                        type="file" 
                                        className="hidden" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                        accept=".txt,.md,.csv,.json,.pdf,.docx" 
                                    />
                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                        Upload File
                                    </Button>
                                </div>
                            </div>

                            <Card className="border border-slate-700/50 bg-slate-900/40 text-white">
                                <CardHeader>
                                    <CardTitle className="text-sm">Add New Knowledge</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <textarea 
                                        value={knowledgeInput}
                                        onChange={(e) => setKnowledgeInput(e.target.value)}
                                        className="w-full h-32 bg-slate-950/50 border border-slate-700 rounded-md p-3 text-sm focus:ring-1 focus:ring-blue-500"
                                        placeholder="Paste text here or upload a file. E.g., Product prices, return policies, company info..."
                                    />
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-slate-500">
                                            Note: Content is converted to vectors using Gemini Embeddings and stored in Supabase.
                                        </p>
                                        <Button onClick={addKnowledge} disabled={isEmbedding || !knowledgeInput.trim()} className="bg-blue-600 hover:bg-blue-500">
                                            {isEmbedding ? 'Vectorizing...' : 'Add to Knowledge Base'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {knowledgeItems.map((item) => (
                                    <Card key={item.id} className="border border-slate-800 bg-slate-900/20">
                                        <CardContent className="p-4">
                                            <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed">
                                                {item.content}
                                            </p>
                                            <div className="mt-3 flex justify-between items-center text-[10px] text-slate-500">
                                                <span>ID: {item.id}</span>
                                                <Badge variant="outline" className="border-slate-800">Chunk</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {knowledgeItems.length === 0 && (
                                    <div className="col-span-full p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                                        No knowledge added yet. Upload a file or paste text to get started.
                                    </div>
                                )}
                            </div>
                        </div>
                     </TabsContent>

                    {/* TAB 3: Webhook Status */}
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
                                    <CardTitle>Supabase SQL Setup</CardTitle>
                                    <CardDescription>Run this SQL in Supabase to enable Tables, Vector Search, and RLS.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-xs text-blue-300 font-mono border border-slate-800 max-h-[300px]">
                                        {MASTER_SQL_SCRIPT}
                                    </div>
                                    <Button size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(MASTER_SQL_SCRIPT)}>Copy SQL</Button>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB 4: Logs */}
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
