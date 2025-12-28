
import React from 'react';
import { cn } from '../../lib/utils';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';

interface SimulatorTabProps {
    chats: [string, any[]][];
    selectedPhone: string | null;
    setSelectedPhone: (phone: string | null) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    messages: any[];
    input: string;
    setInput: (val: string) => void;
    aiStatus: string;
    handleSimulatorSend: (text: string) => void;
    classifyMessage: (msgId: string, text: string) => void;
    phoneToNameMap?: Record<string, string>;
}

export const SimulatorTab: React.FC<SimulatorTabProps> = ({
    chats,
    selectedPhone,
    setSelectedPhone,
    searchQuery,
    setSearchQuery,
    messages,
    input,
    setInput,
    aiStatus,
    handleSimulatorSend,
    classifyMessage,
    phoneToNameMap = {}
}) => {
    return (
        <div className="flex-1 overflow-hidden flex m-0 relative min-h-0 bg-slate-50 h-full">
            <div className={cn(
                "flex-col border-r border-slate-200 bg-white transition-all",
                selectedPhone ? "hidden md:flex w-[320px]" : "flex w-full md:w-[320px]"
            )}>
                <ChatList 
                    chats={chats} 
                    selectedPhone={selectedPhone} 
                    onSelect={setSelectedPhone}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    phoneToNameMap={phoneToNameMap}
                />
            </div>
            <div className={cn(
                "flex-col bg-slate-50 relative transition-all",
                selectedPhone ? "flex flex-1" : "hidden md:flex flex-1"
            )}>
                <ChatWindow 
                    selectedPhone={selectedPhone}
                    messages={messages}
                    onSendMessage={handleSimulatorSend}
                    input={input}
                    setInput={setInput}
                    aiStatus={aiStatus}
                    onBack={() => setSelectedPhone(null)}
                    onAnalyze={classifyMessage}
                    phoneToNameMap={phoneToNameMap}
                />
            </div>
        </div>
    );
};
