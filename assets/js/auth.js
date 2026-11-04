// Supabase client for customer accounts, loaded on demand from the CDN so pages that never
// touch the account do not pay for it.
import { CONFIG } from './config.js';

let client;

export async function supa() {
  if (!client) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm');
    client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

// The signed-in user, or null. Never throws: an offline CDN just means "not signed in".
export async function currentUser() {
  try {
    const { data } = await (await supa()).auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}
