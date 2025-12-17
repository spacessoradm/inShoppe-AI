// IMPORTANT: This is a placeholder for your Supabase client.
// You need to create a Supabase project and fill in the details below.
// 1. Go to https://supabase.com/
// 2. Create a new project.
// 3. Go to Project Settings > API.
// 4. Find your Project URL and anon key.
// 5. Replace the placeholder values below.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://rwlecxyfukzberxcpqnr.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_CtKp3I5HYZkpnVL17mD3ag_AEewmLC6";

export const isSupabaseConfigured =
  supabaseUrl !== "YOUR_SUPABASE_URL" && supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY";

if (!isSupabaseConfigured) {
    console.warn("Supabase credentials are not set. The app will show a setup page. Please update services/supabase.ts with your project URL and anon key.");
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;