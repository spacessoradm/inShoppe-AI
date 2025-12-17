
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  intentTag?: string; // For customer messages
}

export interface ChatSession {
  id: string;
  customerName: string;
  lastMessage: string;
  avatarUrl: string;
  unreadCount: number;
  phone: string;
  priority: 'Hot' | 'Warm' | 'Cold';
}

export type Plan = 'Starter' | 'Growth' | 'Pro';
