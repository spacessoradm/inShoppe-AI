
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Plan, UserProfile, Organization, UserSettings, PLAN_LIMITS } from '../types';

// Storage keys
const PROFILE_KEY = 'inshoppe-profile';
const ORG_KEY = 'inshoppe-org';
const SETTINGS_KEY = 'inshoppe-settings';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  organization: Organization | null;
  settings: UserSettings | null; // Added Settings
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: any; data: any }>;
  signUp: (email: string, pass: string, companyName: string) => Promise<{ error: any; data: any }>;
  signOut: () => Promise<void>;
  upgradePlan: (plan: Plan, creditsToAdd: number) => Promise<void>;
  deductCredit: () => Promise<boolean>; 
  updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>; // Added Update Method
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
  const [settings, setSettings] = useState<UserSettings | null>(null);
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
                      await loadProfileAndOrg(data.session.user.id, data.session.user.email);
                  }
              }
          }
        } else {
          console.log("AuthContext: Initializing in DEMO MODE (Local Storage)...");
          // Fallback for demo without Supabase auth flow
          const savedProfile = localStorage.getItem(PROFILE_KEY);
          const savedOrg = localStorage.getItem(ORG_KEY);
          const savedSettings = localStorage.getItem(SETTINGS_KEY);

          if (mounted) {
              if (savedProfile) setProfile(JSON.parse(savedProfile));
              if (savedOrg) setOrganization(JSON.parse(savedOrg));
              if (savedSettings) setSettings(JSON.parse(savedSettings));
              
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

    // Safety timeout: If auth takes longer than 5 seconds, force loading to false
    const safetyTimeout = setTimeout(() => {
        if (mounted && loading) {
            console.warn("Auth timed out, forcing app load");
            setLoading(false);
        }
    }, 5000);

    // Setup listener only if supabase exists
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    
    if (supabase) {
        const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!mounted) return;
            
            const currentUser = session?.user ?? null;
            setSession(session);
            setUser(currentUser);
            
            if (currentUser) {
                // If we don't have profile/org yet, fetch them
                if (!profile || !organization) {
                    await loadProfileAndOrg(currentUser.id, currentUser.email);
                }
            } else {
                setProfile(null);
                setOrganization(null);
                setSettings(null);
            }
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

  // --- Profile, Org & Settings Management ---

  const loadProfileAndOrg = async (userId: string, userEmail?: string) => {
    if (!supabase) return;

    try {
      // 1. Fetch Profile
      let profileData = null;
      let retries = 0;
      
      while (!profileData && retries < 6) {
          const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle(); 
          
          if (data) {
              profileData = data;
          } else {
              retries++;
              await new Promise(r => setTimeout(r, 500)); 
          }
      }

      // --- SELF REPAIR LOGIC ---
      if (!profileData && userEmail) {
          console.warn("Profile missing. Attempting self-repair...");
          try {
              const { data: newOrg, error: orgError } = await supabase
                  .from('organizations')
                  .insert({ name: 'My Workspace', plan: 'Free', credits: 30 })
                  .select()
                  .single();

              if (newOrg && !orgError) {
                  const { data: newProfile, error: profileError } = await supabase
                      .from('profiles')
                      .insert({ 
                          id: userId, 
                          email: userEmail, 
                          organization_id: newOrg.id,
                          role: 'owner',
                          full_name: userEmail.split('@')[0]
                      })
                      .select()
                      .single();
                  
                  if (newProfile && !profileError) {
                      profileData = newProfile;
                      await supabase.from('user_settings').insert({ user_id: userId });
                  }
              }
          } catch (repairError) {
              console.error("Self-repair failed:", repairError);
          }
      }

      if (profileData) {
          setProfile(profileData);
          
          // 2. Fetch Organization
          let orgData = null;
          let orgRetries = 0;
          
          while (!orgData && orgRetries < 3) {
              const { data } = await supabase
                  .from('organizations')
                  .select('*')
                  .eq('id', profileData.organization_id)
                  .maybeSingle();
              
              if (data) {
                  orgData = data;
              } else {
                  orgRetries++;
                  await new Promise(r => setTimeout(r, 500));
              }
          }
          if (orgData) setOrganization(orgData);

          // 3. Fetch User Settings (NEW)
          const { data: settingsData } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();
          
          if (settingsData) {
              setSettings(settingsData);
          }
      } 
    } catch (e) {
      console.error("Error loading profile/org/settings:", e);
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
      if (!user) return;

      if (supabase) {
          const { error } = await supabase
              .from('user_settings')
              .upsert({ user_id: user.id, ...newSettings, updated_at: new Date().toISOString() });
          
          if (error) {
              console.error("Failed to update settings:", error);
              throw error;
          }
      }

      setSettings(prev => {
          const updated = prev ? { ...prev, ...newSettings } : { user_id: user.id, ...newSettings };
          // Sync local storage for demo/consistency
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
          return updated;
      });
  };

  const upgradePlan = async (newPlan: Plan, creditsToAdd: number) => {
    const now = new Date();
    const nextMonth = new Date(now.setMonth(now.getMonth() + 1)).toISOString();

    if (supabase && organization) {
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
      localStorage.setItem(ORG_KEY, JSON.stringify(updated));
      return true;
  };

  // --- Auth Functions ---

  const signIn = async (email: string, pass: string) => {
    if (supabase) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (!error && data.session) return { data, error: null };
            if (error) return { data: null, error };
        } catch (e) {
            console.error("Supabase signin failed", e);
        }
    }

    // Demo Mode Fallback
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
    const mockSettings: UserSettings = {
        user_id: 'user_demo_123',
        system_instruction: "You are a helpful assistant."
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setOrganization(mockOrg);
    setSettings(mockSettings);
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(mockProfile));
    localStorage.setItem(ORG_KEY, JSON.stringify(mockOrg));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(mockSettings));

    return { data: { user: mockUser, session: { user: mockUser } }, error: null };
  };

  const signUp = async (email: string, pass: string, companyName: string) => {
    const finalCompanyName = companyName || "My Workspace";

    if (supabase) {
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
            email, 
            password: pass,
            options: {
                data: {
                    company_name: finalCompanyName,
                    full_name: email.split('@')[0]
                }
            }
        });
        return { data: authData, error: authError };
    }

    // Demo Mode Sign Up
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
    const mockSettings: UserSettings = {
        user_id: 'user_demo_123'
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setOrganization(mockOrg);
    setSettings(mockSettings);
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(mockProfile));
    localStorage.setItem(ORG_KEY, JSON.stringify(mockOrg));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(mockSettings));
    
    return { data: { user: mockUser, session: { user: mockUser } }, error: null };
  };

  const signOut = async () => {
    try {
        if (supabase) {
            await Promise.race([
                supabase.auth.signOut(),
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
        }
    } catch (error) {
        console.error("Error signing out from Supabase:", error);
    } finally {
        setSession(null);
        setUser(null);
        setOrganization(null);
        setProfile(null);
        setSettings(null);
        
        localStorage.removeItem(PROFILE_KEY); 
        localStorage.removeItem(ORG_KEY);
        localStorage.removeItem(SETTINGS_KEY);

        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase')) {
                localStorage.removeItem(key);
            }
        });
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
    settings,
    loading,
    signIn,
    signUp,
    signOut,
    upgradePlan,
    deductCredit,
    updateUserSettings,
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
