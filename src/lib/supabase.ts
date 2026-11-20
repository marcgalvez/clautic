import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase is optional: without these variables the app stores data in the browser. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const supabaseConfigured = !!supabase;
