
// IMPORTANT: This is a placeholder for your Supabase client.
// We are now reading configuration from the .env file.
// 1. Open the .env file in your project root.
// 2. Fill in VITE_SUPABASE_ANON_KEY with your actual anon key from Supabase Dashboard.

import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
    try {
        const env = (import.meta as any).env;
        return {
            url: env?.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL",
            key: env?.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY"
        };
    } catch (e) {
        return {
            url: "YOUR_SUPABASE_URL",
            key: "YOUR_SUPABASE_ANON_KEY"
        };
    }
};

const config = getSupabaseConfig();
const supabaseUrl = config.url;
const supabaseAnonKey = config.key;

// This check ensures we only try to connect if real credentials are provided
export const isSupabaseConfigured =
  supabaseUrl !== "YOUR_SUPABASE_URL" && 
  supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY" &&
  supabaseUrl.startsWith("https") &&
  !supabaseAnonKey.includes("sb_publishable"); 

if (!isSupabaseConfigured) {
    console.warn("Supabase credentials are not set in .env. The app will run in Demo/Offline mode.");
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
