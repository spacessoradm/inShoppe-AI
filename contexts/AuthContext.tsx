
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Plan } from '../types';

// Storage keys for non-auth persistence
const PLAN_KEY = 'inshoppe-plan';
const WHATSAPP_CONNECTED_KEY = 'inshoppe-whatsapp-connected';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: any; data: any }>;
  signUp: (email: string, pass: string) => Promise<{ error: any; data: any }>;
  signOut: () => Promise<void>;
  plan: Plan | null;
  selectPlan: (plan: Plan) => void;
  isWhatsAppConnected: boolean;
  connectWhatsApp: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  useEffect(() => {
    // 1. Initialize Supabase Auth
    const initAuth = async () => {
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
          setUser(session?.user ?? null);
        } catch (error) {
          console.error('Error checking auth session:', error);
        }
      }
      setLoading(false);
    };

    initAuth();

    // 2. Listen for Auth Changes
    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    // 3. Load Local Settings (Plan, WhatsApp status)
    const savedPlan = localStorage.getItem(PLAN_KEY) as Plan | null;
    if (savedPlan) setPlan(savedPlan);
    
    const savedWhatsAppStatus = sessionStorage.getItem(WHATSAPP_CONNECTED_KEY);
    if (savedWhatsAppStatus === 'true') setIsWhatsAppConnected(true);

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    if (!supabase) return { error: { message: "Supabase not configured" }, data: null };
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    return { data, error };
  };

  const signUp = async (email: string, pass: string) => {
    if (!supabase) return { error: { message: "Supabase not configured" }, data: null };
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    return { data, error };
  };

  const signOut = async () => {
    if (supabase) {
        await supabase.auth.signOut();
    }
    // Clear local app state
    setSession(null);
    setUser(null);
    sessionStorage.removeItem(WHATSAPP_CONNECTED_KEY);
    setIsWhatsAppConnected(false);
  };

  const selectPlan = (selectedPlan: Plan) => {
    localStorage.setItem(PLAN_KEY, selectedPlan);
    setPlan(selectedPlan);
  };
  
  const connectWhatsApp = () => {
    sessionStorage.setItem(WHATSAPP_CONNECTED_KEY, 'true');
    setIsWhatsAppConnected(true);
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    plan,
    selectPlan,
    isWhatsAppConnected,
    connectWhatsApp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
