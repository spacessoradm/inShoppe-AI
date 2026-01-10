
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Modular Tab Components
import { SimulatorTab } from '../components/ai-chat/SimulatorTab';

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

type ViewMode = 'landing' | 'setup' | 'dashboard';

const AIChatPage: React.FC = () => {
    const { user, organization, deductCredit, settings } = useAuth();
    const navigate = useNavigate();

    // --- View State ---
    const [mode, setMode] = useState<ViewMode>('landing');
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [aiStatus, setAiStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [notification, setNotification] = useState<{type: 'success'|'error'|'info', message: string} | null>(null);
    
    // --- State: Configuration ---
    const [myPhoneNumber, setMyPhoneNumber] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    
    // --- State: Data ---
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const messagesRef = useRef<SimMessage[]>([]);
    
    // CRM Data Mapping
    const [phoneToNameMap, setPhoneToNameMap] = useState<Record<string, string>>({});

    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [input, setInput] = useState('');
    
    // Keep ref updated with latest state
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

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
        // Log to console instead of UI since Logs tab moved to settings
        console.log(`[System]: ${text}`);
    };

    const showNotification = (type: 'success'|'error'|'info', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000); 
    };

    // --- SYNC SETTINGS FROM CONTEXT ---
    useEffect(() => {
        if (settings) {
            setMyPhoneNumber(settings.twilio_phone_number || '');
            if (settings.webhook_url) setWebhookUrl(settings.webhook_url);

            // Determine Mode
            if (settings.twilio_account_sid && settings.twilio_auth_token && mode === 'landing') {
                setMode('dashboard');
            }
        }
    }, [settings, mode]); 

    // Fetch CRM Names to display in Chat
    useEffect(() => {
        if (!supabase || !user) return;

        const fetchLeadsMap = async () => {
            const { data } = await supabase
                .from('leads')
                .select('phone, name')
                .eq('user_id', user.id);
            
            if (data) {
                const map: Record<string, string> = {};
                data.forEach((l: any) => {
                    if (l.phone) map[l.phone] = l.name;
                });
                setPhoneToNameMap(map);
            }
        };

        fetchLeadsMap();

        const channel = supabase
            .channel('leads-name-sync')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leads',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    fetchLeadsMap();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Manual Classification Placeholder
    const classifyMessage = async (msgId: string, text: string) => {
        showNotification('info', 'Manual analysis requested.');
    };

    // --- Chat History Logic ---
    useEffect(() => {
        if (mode !== 'dashboard') return;

        const fetchHistory = async () => {
            setIsHistoryLoading(true);
            try {
                if (supabase && user) {
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
                            const updated = [...prev, formattedMsg].sort((a, b) => a.fullTimestamp - b.fullTimestamp);
                            localStorage.setItem('demo_chat_history', JSON.stringify(updated));
                            return updated;
                        });
                        
                        if (!selectedPhone) setSelectedPhone(newMsg.phone);
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

    // Handle Manual Send from ChatWindow (Simulating Customer)
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
                direction: 'outbound'
             }]);
             return;
        }

        const targetPhone = selectedPhone || '+60123456789';
        setInput(''); 
        
        if (supabase && user) {
             // 1. Save to DB (Simulate User Message)
             const { error } = await supabase.from('messages').insert({
                user_id: user.id,
                text: text,
                sender: 'user', // Simulate Customer
                direction: 'inbound',
                phone: targetPhone,
                intent_tag: 'Processing...'
             });
             
             if (error) {
                 addLog(`Error: Failed to save to DB. ${error.message}`);
                 return;
             }

             // 2. Trigger Edge Function (Server-Side Logic)
             if (webhookUrl) {
                 addLog(`System: 🚀 Invoking Edge Function (Simulated Webhook)...`);
                 setAiStatus('Thinking...');
                 
                 try {
                     const formData = new URLSearchParams();
                     formData.append('Body', text);
                     formData.append('From', `whatsapp:${targetPhone}`);
                     // The 'To' should match the merchant's Twilio Number for the Edge Function to find the profile
                     const merchantPhone = myPhoneNumber || 'whatsapp:+14155238886'; 
                     formData.append('To', merchantPhone.includes('whatsapp:') ? merchantPhone : `whatsapp:${merchantPhone}`);

                     const res = await fetch(webhookUrl, {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                         body: formData
                     });
                     
                     if (res.ok) {
                         addLog(`System: ✅ Edge Function invoked successfully.`);
                     } else {
                         const errText = await res.text();
                         addLog(`Error: Edge Function returned ${res.status} - ${errText}`);
                         setAiStatus('Error');
                     }
                 } catch (err: any) {
                     console.error("Webhook Call Error:", err);
                     addLog(`Error: Failed to call Webhook. ${err.message}`);
                     setAiStatus('Error');
                 } finally {
                     setTimeout(() => setAiStatus(''), 5000);
                 }
             } else {
                 addLog("Warning: No Webhook URL configured.");
             }

        } else {
            // Offline Demo Mode
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: text, sender: 'user', direction: 'inbound', 
                timestamp: new Date().toLocaleTimeString(), fullTimestamp: Date.now(), 
                phone: targetPhone, intent_tag: 'Demo Mode'
            }]);
            
            setTimeout(() => {
                 setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(), text: "I'm in Demo Mode. Connect Supabase to use the AI Agent.", sender: 'bot', direction: 'outbound', 
                    timestamp: new Date().toLocaleTimeString(), fullTimestamp: Date.now() + 1, phone: targetPhone
                }]);
            }, 1000);
        }
    };

    if (mode === 'landing') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <div className="w-full max-w-lg space-y-8 animate-fadeInUp">
                    <div className="flex justify-center">
                        <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 border border-slate-200">
                             <ChatIcon className="w-12 h-12 text-white" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-4xl font-bold text-slate-900 tracking-tight">WhatsApp AI Integration</h2>
                        <p className="text-slate-500 text-lg leading-relaxed">
                            Connect your Twilio account to enable the AI Action Engine. 
                        </p>
                    </div>
                    <div className="pt-4 flex flex-col gap-4 items-center">
                        <Button 
                            size="lg" 
                            className="bg-blue-600 hover:bg-blue-500 text-white px-10 h-12 text-base shadow-lg shadow-blue-500/40 w-full sm:w-auto" 
                            onClick={() => navigate('/console/settings')}
                        >
                            Configure in Settings
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 relative">
            {notification && (
                <div className={cn(
                    "fixed top-20 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg border text-sm font-medium animate-fadeInUp flex items-center gap-2",
                    notification.type === 'success' ? "bg-green-100 border-green-200 text-green-800" :
                    notification.type === 'error' ? "bg-red-100 border-red-200 text-red-800" :
                    "bg-blue-100 border-blue-200 text-blue-800"
                )}>
                    {notification.message}
                </div>
            )}

            <header className="border-b border-slate-200 bg-white/80 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div>
                    <h1 className="font-bold text-slate-900 tracking-wide">Live Simulator</h1>
                    <Badge variant="outline" className="text-xs border-slate-300 text-slate-500 hidden sm:inline-flex bg-slate-50">
                        {webhookUrl ? 'Live Backend' : 'Demo Mode'}
                    </Badge>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Credits</div>
                        <div className={cn("text-sm font-mono font-bold", organization ? ((organization.credits > 0) ? "text-green-600" : "text-red-600") : "text-slate-400")}>
                            {organization ? organization.credits : <span className="animate-pulse">...</span>}
                        </div>
                    </div>
                </div>
            </header>

            <SimulatorTab 
                chats={chats}
                selectedPhone={selectedPhone}
                setSelectedPhone={setSelectedPhone}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                messages={(selectedPhone && chats.find(([p]) => p === selectedPhone)?.[1]) || []}
                input={input}
                setInput={setInput}
                aiStatus={aiStatus}
                handleSimulatorSend={handleSimulatorSend}
                classifyMessage={classifyMessage}
                phoneToNameMap={phoneToNameMap}
            />
        </div>
    );
};

function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
}

export default AIChatPage;
