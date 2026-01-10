
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

export interface UserSettings {
  user_id: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  webhook_url?: string;
  system_instruction?: string;
  model?: string;
  updated_at?: string;
}

export interface Lead {
  id: number;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'New' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
  deal_value?: number;
  tags?: string[];
  created_at: string;
  last_contacted_at?: string;
  ai_score?: number; // 0 to 100
  ai_analysis?: string; // Short reason
  next_appointment?: string; // ISO Date string
}
