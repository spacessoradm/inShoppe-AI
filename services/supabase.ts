
// IMPORTANT: This is a placeholder for your Supabase client.
// We are now reading configuration from the .env file.
// 1. Open the .env file in your project root.
// 2. Fill in VITE_SUPABASE_ANON_KEY with your actual anon key from Supabase Dashboard.

import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
    try {
        const env = (import.meta as any).env;
        return {
            url: env?.VITE_SUPABASE_URL || "https://rwlecxyfukzberxcpqnr.supabase.co",
            key: env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_CtKp3I5HYZkpnVL17mD3ag_AEewmLC6"
        };
    } catch (e) {
        return {
            url: "https://rwlecxyfukzberxcpqnr.supabase.co",
            key: "sb_publishable_CtKp3I5HYZkpnVL17mD3ag_AEewmLC6"
        };
    }
};

const config = getSupabaseConfig();
const supabaseUrl = config.url;
const supabaseAnonKey = config.key;

// This check ensures we only try to connect if real credentials are provided
export const isSupabaseConfigured =
  supabaseUrl !== "https://rwlecxyfukzberxcpqnr.supabase.co" && 
  supabaseAnonKey !== "sb_publishable_CtKp3I5HYZkpnVL17mD3ag_AEewmLC6" &&
  supabaseUrl.startsWith("https") &&
  !supabaseAnonKey.includes("sb_publishable"); 

if (!isSupabaseConfigured) {
    console.warn("Supabase credentials are not set in .env. The app will run in Demo/Offline mode.");
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
