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

// Cloudflare Turnstile token for the auth calls Supabase protects with a captcha (sign-in,
// sign-up, password reset, resend). Each token works once, so every call renders a fresh widget
// inside `form`, just above its submit button. In "interaction-only" mode the widget stays
// invisible unless Cloudflare wants the visitor to click the checkbox.
let turnstileReady;
function loadTurnstile() {
  turnstileReady ??= new Promise((resolve, reject) => {
    window.onTurnstileLoad = () => resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    s.async = true;
    s.onerror = () => { turnstileReady = null; reject(new Error('captcha unavailable')); };
    document.head.appendChild(s);
  });
  return turnstileReady;
}

const widgetIds = new WeakMap();

export async function captchaToken(form) {
  const turnstile = await loadTurnstile();
  let box = form.querySelector('.captcha');
  if (!box) {
    box = document.createElement('div');
    box.className = 'captcha';
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.before(box); else form.append(box);
  }
  if (widgetIds.has(box)) turnstile.remove(widgetIds.get(box));
  return new Promise((resolve, reject) => {
    widgetIds.set(box, turnstile.render(box, {
      sitekey: CONFIG.TURNSTILE_SITE_KEY,
      appearance: 'interaction-only',
      language: 'pt-br',
      callback: resolve,
      'error-callback': () => reject(new Error('captcha failed')),
      'expired-callback': () => reject(new Error('captcha expired')),
    }));
  });
}
