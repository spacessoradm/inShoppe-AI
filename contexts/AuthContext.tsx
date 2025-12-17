import React, { createContext, useContext, useEffect, useState } from 'react';
import { Plan } from '../types';

// Hardcoded credentials
const HARDCODED_EMAIL = 'test@inshoppe.ai';
const HARDCODED_PASSWORD = 'password';
const SESSION_KEY = 'inshoppe-auth';
const PLAN_KEY = 'inshoppe-plan';
const WHATSAPP_CONNECTED_KEY = 'inshoppe-whatsapp-connected';

interface User {
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: string | null }>;
  signOut: () => void;
  plan: Plan | null;
  selectPlan: (plan: Plan) => void;
  isWhatsAppConnected: boolean;
  connectWhatsApp: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  useEffect(() => {
    // Check for a saved session, plan and connection status on initial load
    try {
      const savedUser = sessionStorage.getItem(SESSION_KEY);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      const savedPlan = localStorage.getItem(PLAN_KEY) as Plan | null;
      if (savedPlan) {
        setPlan(savedPlan);
      }
      const savedWhatsAppStatus = sessionStorage.getItem(WHATSAPP_CONNECTED_KEY);
      if (savedWhatsAppStatus === 'true') {
        setIsWhatsAppConnected(true);
      }
    } catch (error) {
      console.error("Failed to parse from storage", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, pass: string): Promise<{ error: string | null }> => {
    setLoading(true);
    return new Promise(resolve => {
        setTimeout(() => {
            if (email === HARDCODED_EMAIL && pass === HARDCODED_PASSWORD) {
                const userData = { email };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
                setUser(userData);
                setLoading(false);
                resolve({ error: null });
            } else {
                setLoading(false);
                resolve({ error: 'Invalid email or password.' });
            }
        }, 500); // Simulate network delay
    });
  };

  const signOut = () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(WHATSAPP_CONNECTED_KEY);
    setUser(null);
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
    user,
    loading,
    signIn,
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
