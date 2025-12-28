
import React, { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot' | 'system'; // user = customer (left), bot = agent (right)
    direction: 'inbound' | 'outbound';
    timestamp: string;
    intent_tag?: string;
}

interface ChatWindowProps {
    selectedPhone: string | null;
    messages: Message[];
    onSendMessage: (text: string) => void;
    input: string;
    setInput: (val: string) => void;
    aiStatus: string;
    onBack: () => void;
    onAnalyze: (msgId: string, text: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
    selectedPhone, 
    messages, 
    onSendMessage, 
    input, 
    setInput, 
    aiStatus,
    onBack,
    onAnalyze
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
        }
    };

    if (!selectedPhone) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 h-full">
                <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-200">
                    <ChatBubbleIcon className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Design chat</h3>
                <p>Select a conversation to start chatting</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Header */}
            <header className="h-20 px-6 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="md:hidden -ml-2 text-slate-500 hover:text-slate-900"
                        onClick={onBack}
                    >
                        <ArrowLeftIcon className="w-6 h-6" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedPhone}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-sm text-slate-500">10 online</span>
                            {aiStatus && (
                                <Badge variant="outline" className="ml-2 border-indigo-200 text-indigo-600 bg-indigo-50 text-[10px] uppercase tracking-wider">
                                    {aiStatus}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700">
                        <SearchIcon className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700">
                        <PhoneIcon className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700">
                        <MoreVerticalIcon className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
                {messages.map((msg, index) => {
                    // Logic for Sender/Receiver visualization
                    // In a CRM: Outbound (Agent) is RIGHT. Inbound (Customer) is LEFT.
                    // System messages can be treated as Agent (RIGHT) or Centered.
                    const isAgent = msg.direction === 'outbound' || msg.sender === 'bot' || msg.sender === 'system';
                    
                    return (
                        <div 
                            key={msg.id} 
                            className={cn(
                                "flex w-full gap-4",
                                isAgent ? "justify-end" : "justify-start"
                            )}
                        >
                            {!isAgent && (
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 mt-1">
                                    {selectedPhone.slice(1,3)}
                                </div>
                            )}

                            <div className={cn("flex flex-col max-w-[70%] sm:max-w-[60%]", isAgent ? "items-end" : "items-start")}>
                                <div className="flex items-baseline gap-2 mb-1 px-1">
                                    <span className={cn("text-sm font-bold", isAgent ? "text-indigo-600" : "text-slate-600")}>
                                        {msg.sender === 'system' ? 'System' : (isAgent ? "InShoppe AI" : selectedPhone)}
                                    </span>
                                    {/* Intent Tag for Customer Messages */}
                                    {!isAgent && msg.intent_tag && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm">
                                            {msg.intent_tag}
                                        </span>
                                    )}
                                </div>

                                <div className={cn(
                                    "relative px-5 py-4 text-[15px] leading-relaxed shadow-sm",
                                    isAgent 
                                        ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-indigo-200" 
                                        : "bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-200"
                                )}>
                                    {msg.text}
                                    
                                    {/* Timestamp inside bubble for cleaner look */}
                                    <div className={cn(
                                        "text-[10px] mt-2 text-right opacity-80",
                                        isAgent ? "text-indigo-100" : "text-slate-400"
                                    )}>
                                        {msg.timestamp}
                                    </div>
                                </div>

                                {/* AI Analysis Action for inbound messages without tags */}
                                {!isAgent && (!msg.intent_tag || msg.intent_tag === 'Processing...') && (
                                    <button 
                                        onClick={() => onAnalyze(msg.id, msg.text)}
                                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-500 flex items-center gap-1 transition-colors ml-1"
                                    >
                                        <SparklesIcon className="w-3 h-3" /> Analyze Intent
                                    </button>
                                )}
                            </div>

                            {isAgent && (
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 mt-1">
                                    <BotIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 bg-slate-50 sticky bottom-0 z-10">
                <form 
                    onSubmit={handleSubmit}
                    className="flex items-center gap-3 bg-white p-2 pl-4 pr-2 rounded-[24px] border border-slate-200 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all shadow-lg shadow-slate-200/50"
                >
                    <Button type="button" size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600 shrink-0 h-9 w-9">
                        <PaperclipIcon className="w-5 h-5" />
                    </Button>
                    
                    <Input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Your message" 
                        className="flex-1 bg-transparent border-none focus-visible:ring-0 px-2 text-base placeholder:text-slate-400 h-10 text-slate-900"
                    />
                    
                    <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600 shrink-0 h-9 w-9">
                            <MicIcon className="w-5 h-5" />
                        </Button>
                        <Button 
                            type="submit" 
                            size="icon" 
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full h-10 w-10 shrink-0 shadow-lg shadow-indigo-600/20"
                            disabled={!input.trim()}
                        >
                            <SendIcon className="w-5 h-5 ml-0.5" />
                        </Button>
                    </div>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-slate-400">AI Active • Press Enter to send</p>
                </div>
            </div>
        </div>
    );
};

// Icons
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
}
function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
}
function MoreVerticalIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
}
function PaperclipIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
}
function MicIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
}
function SendIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
}
function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
}
function ChatBubbleIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
}
function BotIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
}
function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>
}
