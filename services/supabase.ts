
// IMPORTANT: This is a placeholder for your Supabase client.
// You need to create a Supabase project and fill in the details below.
// 1. Go to https://supabase.com/
// 2. Create a new project.
// 3. Go to Project Settings > API.
// 4. Find your Project URL and anon key.
// 5. Replace the placeholder values below.

import { createClient } from '@supabase/supabase-js';

// FIX: Use safe access for import.meta.env
const getSupabaseConfig = () => {
    try {
        const env = (import.meta as any).env;
        return {
            // Reverted to generic placeholders to ensure isSupabaseConfigured is false by default
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
  supabaseUrl.startsWith("http");

if (!isSupabaseConfigured) {
    console.warn("Supabase credentials are not set. The app will run in Demo/Offline mode.");
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
