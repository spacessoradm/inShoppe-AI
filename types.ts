
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

export const PLAN_LIMITS: Record<Plan, number> = {
  'Free': 1,
  'Starter': 5,
  'Growth': 20, // Legacy/Intermediate
  'Pro': 50
};

export interface Organization {
  id: string;
  name: string;
  plan: Plan;
  credits: number;
  subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled';
  current_period_end?: string; // ISO Date string for expiration
  stripe_customer_id?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  organization_id: string; // Link to the organization
  role: 'owner' | 'member' | 'admin';
  twilio_phone_number?: string; // Persisted Twilio Number
}
