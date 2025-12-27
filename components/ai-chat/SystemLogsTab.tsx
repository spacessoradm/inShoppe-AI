
import React from 'react';
import { cn } from '../../lib/utils';

interface SystemLogsTabProps {
    logs: string[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const SystemLogsTab: React.FC<SystemLogsTabProps> = ({ logs, messagesEndRef }) => {
    return (
        <div className="flex-1 overflow-hidden m-0 bg-[#0c0c0c] text-white p-4 font-mono text-xs h-full">
            <div className="h-full overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                {logs.map((log, i) => (
                    <div key={i} className="border-b border-white/5 pb-1 break-all">
                        <span className="text-slate-500 mr-3">{log.split(']')[0]}]</span>
                        <span className={cn(log.includes('Error') ? "text-red-400" : log.includes('Realtime') ? "text-blue-400" : log.includes('Brain') ? "text-yellow-400" : "text-green-400")}>{log.split(']')[1]}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};
