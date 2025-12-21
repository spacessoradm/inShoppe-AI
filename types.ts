
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

export type Plan = 'Free' | 'Starter' | 'Growth' | 'Pro';

export interface UserProfile {
  id: string;
  email: string;
  plan: Plan;
  credits: number; // For AI generation
  subscription_status: 'active' | 'inactive' | 'past_due';
  current_period_end?: string;
}
