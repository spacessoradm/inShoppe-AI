
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
        // Defaults reverted to placeholders to prevent '406' errors from invalid keys
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
// We compare against generic placeholders "YOUR_SUPABASE_URL" to allow your specific values to pass
export const isSupabaseConfigured =
  supabaseUrl !== "YOUR_SUPABASE_URL" && 
  supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY" &&
  supabaseUrl.startsWith("https") &&
  !supabaseAnonKey.includes("sb_publishable"); // Basic check to avoid invalid publishable keys being used as anon keys

if (!isSupabaseConfigured) {
    console.warn("Supabase credentials are not set (or invalid). The app will run in Demo/Offline mode.");
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
