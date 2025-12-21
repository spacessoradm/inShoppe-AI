
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Plan, UserProfile } from '../types';

// Storage keys
const PROFILE_KEY = 'inshoppe-profile';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: any; data: any }>;
  signUp: (email: string, pass: string) => Promise<{ error: any; data: any }>;
  signOut: () => Promise<void>;
  upgradePlan: (plan: Plan, creditsToAdd: number) => void;
  deductCredit: () => boolean; // Returns true if successful
  isWhatsAppConnected: boolean;
  connectWhatsApp: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  useEffect(() => {
    // 1. Initialize
    const initAuth = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) loadProfile(session.user);
      } else {
        // Fallback for demo without Supabase auth flow
        const savedProfile = localStorage.getItem(PROFILE_KEY);
        if (savedProfile) setProfile(JSON.parse(savedProfile));
      }
      setLoading(false);
    };

    initAuth();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user);
      setLoading(false);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- Profile Management ---

  const loadProfile = async (user: User) => {
    // In a real app, fetch from 'profiles' table in Supabase
    // For this demo, we use localStorage to persist credit state across reloads
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
        setProfile(JSON.parse(saved));
    } else {
        // Initialize new profile
        const newProfile: UserProfile = {
            id: user.id,
            email: user.email || '',
            plan: 'Free',
            credits: 30, // 30 Free credits on signup (matches Free plan)
            subscription_status: 'active'
        };
        setProfile(newProfile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
    }
  };

  const upgradePlan = (newPlan: Plan, creditsToAdd: number) => {
    if (!profile) return;
    const updated: UserProfile = {
        ...profile,
        plan: newPlan,
        credits: profile.credits + creditsToAdd,
        subscription_status: 'active'
    };
    setProfile(updated);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  };

  const deductCredit = (): boolean => {
      if (!profile) return false;
      if (profile.credits <= 0) return false;

      const updated = { ...profile, credits: profile.credits - 1 };
      setProfile(updated);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return true;
  };

  // --- Auth Functions ---

  const signIn = async (email: string, pass: string) => {
    if (!supabase) return { error: { message: "Supabase not configured" }, data: null };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { data, error };
  };

  const signUp = async (email: string, pass: string) => {
    if (!supabase) return { error: { message: "Supabase not configured" }, data: null };
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    
    // In real app, triggering a SQL trigger to create profile row
    return { data, error };
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    // Optional: Keep profile in local storage for demo convenience, or clear it
    // localStorage.removeItem(PROFILE_KEY); 
  };
  
  const connectWhatsApp = () => {
    setIsWhatsAppConnected(true);
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    upgradePlan,
    deductCredit,
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
