
import React from 'react';
import { cn } from '../../lib/utils';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

interface ChatListProps {
  chats: [string, any[]][];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  className?: string;
}

export const ChatList: React.FC<ChatListProps> = ({ 
  chats, 
  selectedPhone, 
  onSelect, 
  searchQuery, 
  onSearchChange,
  className 
}) => {
  
  const filteredChats = chats.filter(([phone, msgs]) => {
      const lastMsg = msgs[msgs.length - 1];
      const content = lastMsg.text.toLowerCase();
      return phone.includes(searchQuery) || content.includes(searchQuery.toLowerCase());
  });

  return (
    <div className={cn("flex flex-col h-full bg-white border-r border-slate-200", className)}>
      <div className="p-4 pb-2">
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search" 
                className="pl-9 bg-slate-50 border-slate-200 rounded-2xl h-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500/50" 
            />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
        {filteredChats.map(([phone, msgs]) => {
            const lastMsg = msgs[msgs.length - 1];
            const isSelected = selectedPhone === phone;
            const time = lastMsg.timestamp;
            const unreadCount = 0; // Mock for now

            return (
                <div 
                    key={phone} 
                    onClick={() => onSelect(phone)}
                    className={cn(
                        "group relative flex items-start gap-3 p-4 rounded-[20px] cursor-pointer transition-all duration-200",
                        isSelected 
                            ? "bg-slate-100 border border-slate-200/50" 
                            : "hover:bg-slate-50 border border-transparent"
                    )}
                >
                    {/* Avatar */}
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 transition-colors",
                        isSelected 
                            ? "bg-white text-indigo-600 border border-slate-200 shadow-sm" 
                            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm"
                    )}>
                        {phone.slice(1, 3)}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className={cn(
                                "font-bold text-[15px] truncate",
                                isSelected ? "text-slate-900" : "text-slate-700"
                            )}>
                                {phone}
                            </span>
                            <span className="text-xs text-slate-400 shrink-0 ml-2">{time}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className={cn(
                                "text-sm truncate pr-2 leading-relaxed",
                                isSelected ? "text-slate-600" : "text-slate-500"
                            )}>
                                {lastMsg.direction === 'outbound' && <span className="text-indigo-600 mr-1 font-medium">You:</span>}
                                {lastMsg.text}
                            </p>
                            {lastMsg.intent_tag && (
                                <div className={cn(
                                    "w-2 h-2 rounded-full shrink-0",
                                    lastMsg.intent_tag.includes('Inquiry') ? "bg-orange-500" : "bg-indigo-500"
                                )}></div>
                            )}
                        </div>
                    </div>
                    
                    {isSelected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-indigo-600 rounded-r-full"></div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    )
}
