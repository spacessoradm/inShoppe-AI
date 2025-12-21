
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Plan, UserProfile, Organization, PLAN_LIMITS } from '../types';

// Storage keys
const PROFILE_KEY = 'inshoppe-profile';
const ORG_KEY = 'inshoppe-org';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  organization: Organization | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: any; data: any }>;
  signUp: (email: string, pass: string, companyName: string) => Promise<{ error: any; data: any }>;
  signOut: () => Promise<void>;
  upgradePlan: (plan: Plan, creditsToAdd: number) => Promise<void>;
  deductCredit: () => Promise<boolean>; 
  isWhatsAppConnected: boolean;
  connectWhatsApp: () => void;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        if (supabase) {
          console.log("AuthContext: Initializing with Supabase...");
          // Attempt to get session from Supabase
          const { data, error } = await supabase.auth.getSession();
          
          if (mounted) {
              if (error) {
                  console.warn("Supabase session error:", error.message);
                  setSession(null);
                  setUser(null);
              } else {
                  setSession(data.session);
                  setUser(data.session?.user ?? null);
                  if (data.session?.user) {
                      await loadProfileAndOrg(data.session.user.id);
                  }
              }
          }
        } else {
          console.log("AuthContext: Initializing in DEMO MODE (Local Storage)...");
          // Fallback for demo without Supabase auth flow
          const savedProfile = localStorage.getItem(PROFILE_KEY);
          const savedOrg = localStorage.getItem(ORG_KEY);
          if (mounted) {
              if (savedProfile) setProfile(JSON.parse(savedProfile));
              if (savedOrg) setOrganization(JSON.parse(savedOrg));
              // Mock user session if profile exists in local storage
              if (savedProfile) {
                  const parsedProfile = JSON.parse(savedProfile);
                  setUser({ id: parsedProfile.id, email: parsedProfile.email } as User);
              }
          }
        }
      } catch (error) {
        console.warn("Auth initialization failed (using fallback/guest mode):", error);
        if (mounted) {
            setSession(null);
            setUser(null);
        }
      } finally {
        if (mounted) {
            setLoading(false);
        }
      }
    };

    initAuth();

    // Safety timeout: If auth takes longer than 3 seconds, force loading to false
    const safetyTimeout = setTimeout(() => {
        if (mounted && loading) {
            console.warn("Auth timed out, forcing app load");
            setLoading(false);
        }
    }, 3000);

    // Setup listener only if supabase exists
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    
    if (supabase) {
        const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!mounted) return;
            
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
                await loadProfileAndOrg(session.user.id);
            } else {
                setProfile(null);
                setOrganization(null);
            }
            setLoading(false);
        });
        authListener = data;
    }

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // --- Profile & Org Management ---

  const loadProfileAndOrg = async (userId: string) => {
    if (!supabase) return;

    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

      if (profileData) {
          setProfile(profileData);
          
          // 2. Fetch Organization
          const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', profileData.organization_id)
              .single();
          
          if (orgData) {
              setOrganization(orgData);
          }
      }
    } catch (e) {
      console.error("Error loading profile/org:", e);
    }
  };

  const upgradePlan = async (newPlan: Plan, creditsToAdd: number) => {
    const now = new Date();
    const nextMonth = new Date(now.setMonth(now.getMonth() + 1)).toISOString();

    if (supabase && organization) {
        // Update DB
        const { error } = await supabase.from('organizations').update({
            plan: newPlan,
            credits: organization.credits + creditsToAdd,
            subscription_status: 'active',
            current_period_end: nextMonth
        }).eq('id', organization.id);

        if (!error) {
             const updatedOrg = { 
                 ...organization, 
                 plan: newPlan, 
                 credits: organization.credits + creditsToAdd,
                 current_period_end: nextMonth,
                 subscription_status: 'active' as const
            };
            setOrganization(updatedOrg);
        }
    } else {
        // Local Demo Fallback
        if (!organization) return;
        const updatedOrg = { 
            ...organization, 
            plan: newPlan, 
            credits: organization.credits + creditsToAdd,
            current_period_end: nextMonth,
            subscription_status: 'active' as const
        };
        setOrganization(updatedOrg);
        localStorage.setItem(ORG_KEY, JSON.stringify(updatedOrg));
    }
  };

  const deductCredit = async (): Promise<boolean> => {
      if (!organization) return false;
      if (organization.credits <= 0) return false;

      const newCredits = organization.credits - 1;

      if (supabase) {
          const { error } = await supabase
            .from('organizations')
            .update({ credits: newCredits })
            .eq('id', organization.id);
          
          if (error) return false;
      }

      const updated = { ...organization, credits: newCredits };
      setOrganization(updated);
      localStorage.setItem(ORG_KEY, JSON.stringify(updated)); // Sync local for consistency
      return true;
  };

  // --- Auth Functions ---

  const signIn = async (email: string, pass: string) => {
    // 1. Try Supabase Auth
    if (supabase) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (!error && data.session) return { data, error: null };
            // If error, fall through to check for demo mode, or return error
            if (error) return { data: null, error };
        } catch (e) {
            console.error("Supabase signin failed", e);
        }
    }

    // 2. Demo/Offline Mode Fallback
    // If supabase is not configured OR the call failed but we want to allow demo access:
    
    // Create Mock Session
    const mockUser = { id: 'user_demo_123', email: email } as User;
    const mockProfile: UserProfile = {
        id: 'user_demo_123',
        email: email,
        organization_id: 'org_demo_123',
        role: 'owner',
        full_name: email.split('@')[0]
    };
    const mockOrg: Organization = {
        id: 'org_demo_123',
        name: 'Demo Workspace',
        plan: 'Free',
        credits: 30,
        subscription_status: 'active'
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setOrganization(mockOrg);
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(mockProfile));
    localStorage.setItem(ORG_KEY, JSON.stringify(mockOrg));

    return { data: { user: mockUser, session: { user: mockUser } }, error: null };
  };

  // Updated to include companyName
  const signUp = async (email: string, pass: string, companyName: string) => {
    const finalCompanyName = companyName || "My Workspace";

    if (supabase) {
        // 1. Create Auth User
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: pass });
        
        if (authError || !authData.user) return { data: authData, error: authError };

        // 2. Create Organization with provided name
        const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert({
                name: finalCompanyName,
                plan: 'Free',
                credits: 30, // Default Free Credits
                subscription_status: 'active'
            })
            .select()
            .single();
        
        if (orgError || !orgData) {
            console.error("Org creation failed", orgError);
            return { data: authData, error: orgError };
        }

        // 3. Create Profile linked to Org
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                email: email,
                organization_id: orgData.id,
                role: 'owner',
                full_name: email.split('@')[0]
            });
        
        return { data: authData, error: profileError };
    }

    // Demo Mode Sign Up (Mock)
    console.log("Supabase not available, using Demo Sign Up");
    const mockUser = { id: 'user_demo_123', email: email } as User;
    const mockProfile: UserProfile = {
        id: 'user_demo_123',
        email: email,
        organization_id: 'org_demo_123',
        role: 'owner',
        full_name: email.split('@')[0]
    };
    const mockOrg: Organization = {
        id: 'org_demo_123',
        name: finalCompanyName,
        plan: 'Free',
        credits: 30,
        subscription_status: 'active'
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setOrganization(mockOrg);
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(mockProfile));
    localStorage.setItem(ORG_KEY, JSON.stringify(mockOrg));
    
    return { data: { user: mockUser, session: { user: mockUser } }, error: null };
  };

  const signOut = async () => {
    try {
        if (supabase) {
            await supabase.auth.signOut();
        }
    } catch (error) {
        console.error("Error signing out from Supabase:", error);
    } finally {
        // ALWAYS clear local state, regardless of Supabase errors
        setSession(null);
        setUser(null);
        setOrganization(null);
        setProfile(null);
        localStorage.removeItem(PROFILE_KEY); 
        localStorage.removeItem(ORG_KEY);
    }
  };
  
  const connectWhatsApp = () => {
    setIsWhatsAppConnected(true);
  };

  const value = {
    session,
    user,
    profile,
    organization,
    loading,
    signIn,
    signUp,
    signOut,
    upgradePlan,
    deductCredit,
    isWhatsAppConnected,
    connectWhatsApp,
    isDemoMode: !isSupabaseConfigured
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
      