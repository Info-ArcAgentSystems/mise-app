// src/lib/supabase.js
//
// Singleton Supabase client. Reads URL + anon key from Vite env vars.
// Create a `.env.local` file at the project root with:
//   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
//
// Never commit .env.local. The anon key is safe for client-side use only
// because Row-Level Security policies enforce per-user data isolation.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Create .env.local with VITE_SUPABASE_URL ' +
      'and VITE_SUPABASE_ANON_KEY, then restart `npm run dev`.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
