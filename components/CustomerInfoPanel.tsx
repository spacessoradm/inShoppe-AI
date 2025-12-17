
import React from 'react';
import { ChatSession } from '../types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';

interface CustomerInfoPanelProps {
  session: ChatSession | undefined;
  onClose: () => void;
}

export const CustomerInfoPanel: React.FC<CustomerInfoPanelProps> = ({ session, onClose }) => {

  const priorityColors = {
    Hot: 'bg-red-500 hover:bg-red-500/80',
    Warm: 'bg-yellow-500 hover:bg-yellow-500/80',
    Cold: 'bg-blue-500 hover:bg-blue-500/80',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-[60px] items-center border-b px-6">
        <h2 className="font-semibold text-lg">Customer Info</h2>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {session ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <img src={session.avatarUrl} alt={session.customerName} className="w-20 h-20 rounded-full mb-4" />
              <h3 className="font-semibold text-xl">{session.customerName}</h3>
            </div>
            <div className="space-y-4 text-sm">
                <div>
                    <p className="text-muted-foreground font-medium">Phone Number</p>
                    <p>{session.phone}</p>
                </div>
                 <div>
                    <p className="text-muted-foreground font-medium">Priority</p>
                    <Badge className={cn('text-white', priorityColors[session.priority])}>{session.priority}</Badge>
                </div>
                {/* Add more mock fields here if needed */}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">No customer selected</p>
          </div>
        )}
      </div>
    </div>
  );
};

function XIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
