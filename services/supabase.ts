
// IMPORTANT: This is a placeholder for your Supabase client.
// We are now reading configuration from the .env file.
// 1. Open the .env file in your project root.
// 2. Fill in VITE_SUPABASE_ANON_KEY with your actual anon key from Supabase Dashboard.

import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
    try {
        const env = (import.meta as any).env;
        return {
            url: (env?.VITE_SUPABASE_URL || "https://rwlecxyfukzberxcpqnr.supabase.co").trim(),
            key: (env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bGVjeHlmdWt6YmVyeGNwcW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Njc0NDAsImV4cCI6MjA4MTI0MzQ0MH0.ruVmzOf92Gi0Cl8im5JfMWzPfC6z_LPfxFUKR4SivuM").trim()
        };
    } catch (e) {
        return {
            url: "https://rwlecxyfukzberxcpqnr.supabase.co",
            key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bGVjeHlmdWt6YmVyeGNwcW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Njc0NDAsImV4cCI6MjA4MTI0MzQ0MH0.ruVmzOf92Gi0Cl8im5JfMWzPfC6z_LPfxFUKR4SivuM"
        };
    }
};

const config = getSupabaseConfig();
export const supabaseUrl = config.url;
export const supabaseAnonKey = config.key;

// Relaxed Check: We check if variables exist and have content.
// We do NOT validate the content format strictly, to avoid blocking valid but unusual keys.
// However, we log warnings if they look suspicious.
export const isSupabaseConfigured =
  supabaseUrl &&
  supabaseUrl.length > 0 &&
  supabaseUrl.startsWith("https") &&
  supabaseAnonKey &&
  supabaseAnonKey.length > 0;

if (!isSupabaseConfigured) {
    console.warn("Supabase credentials are not set in .env. The app will run in Demo/Offline mode.");
} else {
    console.log("Supabase configured with URL:", supabaseUrl);
    // Debug logging for key issues
    if (supabaseAnonKey.length < 100) {
        console.warn(`WARNING: Your VITE_SUPABASE_ANON_KEY is only ${supabaseAnonKey.length} characters long.`);
        console.warn("A valid Supabase Anon Key is usually a long JWT (150+ chars) starting with 'ey'.");
        console.warn("Please check your .env file and ensure you pasted the 'anon' 'public' key from Supabase Project Settings > API.");
    }
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
