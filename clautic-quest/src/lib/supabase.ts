import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'clautic-quest-auth' },
});

/** Domini intern per als comptes d'alumne: entren només amb el nom d'usuari. */
export const STUDENT_DOMAIN = 'alumnes.clautic.app';
export const toLoginEmail = (u: string) => {
  const v = u.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${STUDENT_DOMAIN}`;
};
