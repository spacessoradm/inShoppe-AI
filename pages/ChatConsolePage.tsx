import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Message, ChatSession } from '../types';
import { CustomerInfoPanel } from '../components/CustomerInfoPanel';
import { Switch } from '../components/ui/Switch';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

// This data is just for the mock logic within the chat view
const mockChatSessions: ChatSession[] = [
  { id: '1', customerName: 'John Doe', lastMessage: 'Okay, thank you!', avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', unreadCount: 2, phone: '+1-202-555-0104', priority: 'Hot' },
  { id: '2', customerName: 'Jane Smith', lastMessage: 'I have a question about pricing.', avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026705d', unreadCount: 0, phone: '+1-202-555-0176', priority: 'Warm' },
  { id: '3', customerName: 'Sam Wilson', lastMessage: 'Can you call me back?', avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026706d', unreadCount: 0, phone: '+1-202-555-0182', priority: 'Cold' },
];

const mockMessagesData: { [key: string]: Message[] } = {
  '1': [
    { id: 'm1', text: 'Hello, I am interested in your product.', sender: 'user', timestamp: '10:00 AM', intentTag: 'Product Inquiry' },
    { id: 'm2', text: 'Hi John! We are happy to help. What can we assist you with?', sender: 'bot', timestamp: '10:01 AM' },
    { id: 'm3', text: 'I would like to know more about the premium package.', sender: 'user', timestamp: '10:02 AM', intentTag: 'Asking Price' },
    { id: 'm4', text: 'Okay, thank you!', sender: 'user', timestamp: '10:05 AM', intentTag: 'Follow Up' },
  ],
  '2': [
     { id: 'm5', text: 'I have a question about pricing.', sender: 'user', timestamp: '11:30 AM', intentTag: 'Asking Price' },
  ],
  '3': [],
};

// Define structured mock scenarios sequence for Auto-Reply
const SCENARIO_SEQUENCE = [
  {
    text: "Hi, do you have the wireless earbuds in stock?",
    intent: "Product Inquiry",
    reply: "Hello! Yes, the ProBuds X are available. They feature active noise cancellation and 30-hour battery life."
  },
  {
    text: "How much are they?",
    intent: "Asking Price",
    reply: "The ProBuds X are currently on sale for RM299 (Normal price RM399)."
  },
  {
    text: "Do you ship to Penang?",
    intent: "Shipping Inquiry",
    reply: "Yes, we ship nationwide! Delivery to Penang typically takes 2-3 working days."
  },
  {
    text: "Okay, I want to buy a pair.",
    intent: "Purchase Intent",
    reply: "Fantastic! You can complete your purchase securely here: https://inshoppe.store/buy/probuds-x"
  }
];

type ConnectionStatus = 'idle' | 'scanning' | 'connecting';

const ChatConsolePage: React.FC = () => {
  const { isWhatsAppConnected, connectWhatsApp } = useAuth();
  const { chatId } = useParams<{ chatId?: string }>();
  const [messages, setMessages] = useState<{ [key: string]: Message[] }>(mockMessagesData);
  const [newMessage, setNewMessage] = useState('');
  const [isAutoReplyOn, setIsAutoReplyOn] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [scenarioStep, setScenarioStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connection State Machine
  useEffect(() => {
    if (isWhatsAppConnected) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    if (connectionStatus === 'idle') {
      // Step 1: Start Scanning immediately
      setConnectionStatus('scanning');
    } else if (connectionStatus === 'scanning') {
      // Step 2: Scan for 3 seconds, then switch to connecting
      timeoutId = setTimeout(() => {
        setConnectionStatus('connecting');
      }, 3000);
    } else if (connectionStatus === 'connecting') {
      // Step 3: Connect for 6 seconds, then finish
      timeoutId = setTimeout(() => {
        connectWhatsApp();
      }, 6000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [connectionStatus, isWhatsAppConnected, connectWhatsApp]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, chatId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !chatId) return;

    const message: Message = {
      id: `msg-${Date.now()}`,
      text: newMessage,
      sender: 'bot', // Simulating merchant sending a message
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), message]
    }));
    setNewMessage('');
  };

  const handleReceiveMockMessage = () => {
    if (!chatId) return;

    // Pick scenario from sequence
    const scenario = SCENARIO_SEQUENCE[scenarioStep % SCENARIO_SEQUENCE.length];

    const customerMessage: Message = {
      id: `msg-${Date.now()}`,
      text: scenario.text,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      intentTag: scenario.intent,
    };

    setMessages(prev => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), customerMessage]
    }));
    
    // Advance step
    setScenarioStep(prev => prev + 1);

    if (isAutoReplyOn) {
      setTimeout(() => {
        const botMessage: Message = {
          id: `bot-reply-${Date.now()}`,
          text: scenario.reply,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), botMessage]
        }));
      }, 1500); // Realistic delay
    }
  };

  // Helper to render text with clickable links
  const renderMessageText = (text: string, sender: 'user' | 'bot') => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
        if (urlRegex.test(part)) {
            return (
                <a 
                    key={i} 
                    href={part} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={cn(
                        "underline break-all", 
                        sender === 'bot' ? "text-blue-100 hover:text-white" : "text-blue-400 hover:text-blue-300"
                    )}
                >
                    {part}
                </a>
            );
        }
        return <span key={i}>{part}</span>;
    });
  };

  if (!isWhatsAppConnected) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-950/50">
        <Card className="w-full max-w-md text-center border-slate-800 bg-slate-900/50 backdrop-blur-xl">
          {connectionStatus === 'scanning' && (
            <>
              <CardHeader>
                <CardTitle className="text-white">Connect Your WhatsApp</CardTitle>
                <CardDescription>
                  Please scan the QR code with your phone.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 pb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                  <div className="relative overflow-hidden rounded-xl border border-slate-700 shadow-2xl bg-white p-2">
                     <img
                        src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=inShoppe-AI-WhatsApp-Connect"
                        alt="WhatsApp QR Code"
                        className="w-48 h-48"
                      />
                      {/* Scanning Animation overlay */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-scan"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-400 font-medium animate-pulse">
                   <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                   Scanning...
                </div>
              </CardContent>
            </>
          )}
          {connectionStatus === 'connecting' && (
             <>
              <CardHeader>
                <CardTitle className="text-white">Connecting to WhatsApp</CardTitle>
                <CardDescription>
                  Please wait while we link your device...
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-6 h-[256px]">
                <div className="relative">
                     <div className="w-16 h-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
                     <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-purple-500/50 rounded-full animate-spin [animation-duration:1.5s]"></div>
                </div>
                <p className="text-sm text-slate-400 font-medium">Authenticating...</p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    );
  }

  const activeSession = mockChatSessions.find(c => c.id === chatId);
  const currentMessages = chatId ? messages[chatId] || [] : [];

  return (
    <div className="flex h-full w-full overflow-hidden">
        {/* CENTER - Main Chat Window */}
        <div className="flex flex-col flex-1 min-w-0 bg-transparent">
          {/* Header - Sticky and Solid Background */}
          <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 shadow-md px-6">
            <div className="flex items-center gap-3 min-w-0">
               {activeSession ? (
                 <>
                    <img src={activeSession.avatarUrl} alt="" className="w-10 h-10 rounded-full border border-slate-700" />
                    <div className="min-w-0">
                      <h1 className="text-base font-semibold text-white truncate leading-tight">{activeSession.customerName}</h1>
                      <p className="text-xs text-slate-400 truncate leading-tight">{activeSession.phone}</p>
                    </div>
                 </>
               ) : (
                 <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <span className="text-base font-semibold text-white">Chat Console</span>
                 </div>
               )}
            </div>
            
            <div className="flex items-center gap-4 shrink-0 overflow-hidden">
               <div className={cn(
                   "flex items-center gap-3 rounded-full px-4 py-2 border shadow-sm transition-all duration-300",
                   isAutoReplyOn ? "bg-green-500/10 border-green-500/50" : "bg-slate-800 border-slate-700"
               )}>
                <label htmlFor="auto-reply-switch" className={cn(
                    "text-sm font-bold cursor-pointer select-none transition-colors whitespace-nowrap",
                    isAutoReplyOn ? "text-green-400" : "text-slate-300"
                )}>
                    AI Auto-Reply
                </label>
                <Switch 
                    id="auto-reply-switch" 
                    checked={isAutoReplyOn} 
                    onCheckedChange={setIsAutoReplyOn} 
                    className={cn(
                        "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-600 border-2 border-transparent"
                    )}
                />
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          {chatId ? (
            <>
                <main className="flex-1 flex flex-col gap-4 p-4 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent bg-transparent">
                    <div className="space-y-6 max-w-4xl mx-auto w-full">
                        {currentMessages.map((msg) => (
                            <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                                {msg.sender === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                )}
                                <div className="relative max-w-[85%] sm:max-w-[70%]">
                                    {msg.sender === 'user' && msg.intentTag && (
                                        <Badge className="absolute -top-3 left-0 text-[10px] bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 shadow-sm z-10 px-2 pointer-events-none">
                                            {msg.intentTag}
                                        </Badge>
                                    )}
                                    <div className={`rounded-2xl px-5 py-3.5 text-sm shadow-sm leading-relaxed ${
                                        msg.sender === 'user' 
                                        ? 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/50 mt-1.5' 
                                        : 'bg-blue-600 text-white rounded-br-none shadow-blue-900/20'
                                    }`}>
                                        <p>{renderMessageText(msg.text, msg.sender)}</p>
                                        <p className={`text-[10px] mt-1.5 text-right opacity-60 font-medium ${msg.sender === 'user' ? 'text-slate-400' : 'text-blue-100'}`}>
                                            {msg.timestamp}
                                        </p>
                                    </div>
                                </div>
                                {msg.sender === 'bot' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-900/20">
                                        <RobotIcon className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                {/* Footer Input Area */}
                <footer className="border-t border-slate-800 bg-slate-900/60 backdrop-blur-md p-4 shrink-0">
                    <div className="flex items-center gap-3 max-w-4xl mx-auto w-full">
                    <Button onClick={handleReceiveMockMessage} variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 shrink-0" title="Simulate Customer Message">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg>
                    </Button>
                    
                    <form onSubmit={handleSendMessage} className="relative flex-1 flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full px-2 py-1.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
                        <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        autoComplete="off"
                        className="flex-1 bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-3"
                        />
                        <Button 
                            type="submit" 
                            size="icon"
                            className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white shrink-0 shadow-sm transition-transform active:scale-95"
                            disabled={!newMessage.trim()}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        </Button>
                    </form>
                    </div>
                </footer>
            </>
          ) : (
            /* No Chat Selected State */
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center bg-slate-900/40 p-10 rounded-2xl border border-slate-800/50 backdrop-blur-sm max-w-sm mx-4">
                    <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-white">No Chat Selected</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Please select a conversation from the sidebar to view messages.
                    </p>
                </div>
            </div>
          )}
        </div>
        
        {/* RIGHT PANEL - User Info (Visible on Large Screens) */}
        {chatId && (
            <aside className="hidden lg:flex w-[300px] border-l border-slate-800 bg-slate-900/50 backdrop-blur-md flex-col shrink-0">
                <CustomerInfoPanel session={activeSession} onClose={() => {}} />
            </aside>
        )}
    </div>
  );
};


function RobotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}


export default ChatConsolePage;