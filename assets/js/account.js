// Account page with Supabase Auth: sign-in, sign-up (the e-mail must be confirmed before the
// first sign-in), password reset by e-mail, and the signed-in view with the customer's orders.
// Orders come straight from the `orders` table: row level security returns only the rows whose
// customer e-mail matches the signed-in account (supabase/migrations/*_orders_customer_read.sql).
import { boot, icon, money, esc, $, $$ } from './app.js';
import { supa, captchaToken } from './auth.js';

boot({ active: 'conta' });

const tabs = $$('[data-auth-tab]');
const tabBar = $('.auth-tabs');
const forms = $$('[data-auth-form]');
const dash = $('[data-dash]');
const pageUrl = location.origin + location.pathname;

function show(which) {
  const signedIn = which === 'dash';
  tabBar.hidden = signedIn || which === 'recover';
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.authTab === which)));
  forms.forEach((f) => { f.hidden = f.dataset.authForm !== which; });
  dash.hidden = !signedIn;
}

tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.authTab)));
if (location.hash === '#criar') show('signup');

$$('[data-pw-toggle]').forEach((b) => b.addEventListener('click', () => {
  const input = document.getElementById(b.dataset.pwToggle);
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  b.textContent = reveal ? 'Ocultar' : 'Mostrar';
  b.setAttribute('aria-label', reveal ? 'Ocultar senha' : 'Mostrar senha');
}));

// `msg` is trusted markup written here; anything from the user or the server goes through esc().
const note = (box, msg) => {
  $('[data-note]', box).innerHTML = msg ? `${icon('info', 18)}<span>${msg}</span>` : '';
};

// Supabase answers in English; these are the messages a customer can hit.
function authError(err) {
  const m = String(err?.message || '');
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar: abra o link que enviamos. <a href="#" data-resend>Reenviar e-mail</a>';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/password/i.test(m) && /(least|short|weak)/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/same.*password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  if (/invalid.*email|email.*invalid/i.test(m)) return 'Esse e-mail não parece válido.';
  if (/captcha/i.test(m)) return 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.';
  if (/fetch|network|load failed/i.test(m)) return 'Sem conexão com o servidor. Confira sua internet e tente de novo.';
  return 'Não deu certo agora. Tente de novo em instantes.';
}

function validate(form) {
  form.classList.add('was-submitted');
  const invalid = $$('input', form).find((i) => !i.checkValidity());
  if (invalid) { invalid.focus(); note(form, 'Confira os campos destacados.'); }
  return !invalid;
}

async function busy(form, run) {
  const btn = $('button[type="submit"]', form);
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Aguarde...';
  try { await run(); } finally { btn.disabled = false; btn.textContent = label; }
}

const loginForm = $('[data-auth-form="login"]');
const signupForm = $('[data-auth-form="signup"]');
const recoverForm = $('[data-auth-form="recover"]');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validate(loginForm)) return;
  busy(loginForm, async () => {
    const { error } = await (await supa()).auth.signInWithPassword({
      email: loginForm.email.value.trim(),
      password: loginForm.password.value,
      options: { captchaToken: await captchaToken(loginForm) },
    });
    if (error) note(loginForm, authError(error));
    // Success is handled by onAuthStateChange (SIGNED_IN).
  }).catch((err) => note(loginForm, authError(err)));
});

loginForm.addEventListener('click', (e) => {
  if (!e.target.closest('[data-resend]')) return;
  e.preventDefault();
  const email = loginForm.email.value.trim();
  Promise.all([supa(), captchaToken(loginForm)])
    .then(([s, captchaToken]) => s.auth.resend({ type: 'signup', email, options: { emailRedirectTo: pageUrl, captchaToken } }))
    .then(({ error }) => note(loginForm, error ? authError(error) : `Enviamos um novo link para <b>${esc(email)}</b>.`))
    .catch((err) => note(loginForm, authError(err)));
});

signupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validate(signupForm)) return;
  const email = signupForm.email.value.trim();
  busy(signupForm, async () => {
    const { data, error } = await (await supa()).auth.signUp({
      email,
      password: signupForm.password.value,
      options: { data: { name: signupForm.name.value.trim() }, emailRedirectTo: pageUrl, captchaToken: await captchaToken(signupForm) },
    });
    if (error) { note(signupForm, authError(error)); return; }
    // With e-mail confirmation on, an address that already has an account comes back with no
    // identities and no e-mail is sent.
    if (data.user && !data.user.identities?.length) {
      note(signupForm, 'Esse e-mail já tem conta. Use a aba Entrar ou "Esqueci minha senha".');
      return;
    }
    signupForm.reset();
    signupForm.classList.remove('was-submitted');
    note(signupForm, `Quase lá! Enviamos um link de confirmação para <b>${esc(email)}</b>. Abra o e-mail (confira o spam) e depois entre com sua senha.`);
  }).catch((err) => note(signupForm, authError(err)));
});

$('[data-forgot]').addEventListener('click', (e) => {
  e.preventDefault();
  const input = loginForm.email;
  if (!input.value.trim() || !input.checkValidity()) {
    input.focus();
    note(loginForm, 'Digite seu e-mail acima e clique de novo em "Esqueci minha senha".');
    return;
  }
  const email = input.value.trim();
  Promise.all([supa(), captchaToken(loginForm)])
    .then(([s, captchaToken]) => s.auth.resetPasswordForEmail(email, { redirectTo: pageUrl, captchaToken }))
    .then(({ error }) => note(loginForm, error ? authError(error)
      : `Se houver uma conta com <b>${esc(email)}</b>, enviamos um link para criar uma nova senha.`))
    .catch((err) => note(loginForm, authError(err)));
});

recoverForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validate(recoverForm)) return;
  busy(recoverForm, async () => {
    const s = await supa();
    const { error } = await s.auth.updateUser({ password: recoverForm.password.value });
    if (error) { note(recoverForm, authError(error)); return; }
    recoverForm.reset();
    recovering = false;
    const { data } = await s.auth.getSession();
    await renderDash(data.session?.user);
    note(dash, 'Senha alterada.');
  }).catch((err) => note(recoverForm, authError(err)));
});

$('[data-signout]').addEventListener('click', async () => {
  await (await supa()).auth.signOut().catch(() => {});
  show('login');
});

const STATUS = {
  pending: ['Aguardando pagamento', 'is-wait'],
  paid: ['Pago', 'is-ok'],
  canceled: ['Cancelado', 'is-bad'],
  refunded: ['Reembolsado', 'is-bad'],
};
const date = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

// Link to the affiliate dashboard, shown only when this account is an active affiliate.
// my_affiliate_summary() returns no row for everyone else.
async function showAffiliateLink() {
  const link = $('[data-aff-link]');
  link.hidden = true;
  try {
    const { data, error } = await (await supa()).rpc('my_affiliate_summary');
    const aff = !error && data?.[0];
    if (!aff) return;
    link.innerHTML = `${icon('bolt', 20)}<span><b>Painel do afiliado</b><br><span class="muted small">Seu link ${esc(aff.code)}, vendas e comissões</span></span>${icon('arrow', 18)}`;
    link.hidden = false;
  } catch { /* not shown */ }
}

async function renderDash(user) {
  if (!user) { show('login'); return; }
  const name = String(user.user_metadata?.name || '').trim().split(/\s+/)[0];
  $('[data-dash-hello]').textContent = name ? `Olá, ${name}!` : 'Olá!';
  $('[data-dash-email]').textContent = user.email || '';
  note(dash, '');
  show('dash');

  showAffiliateLink();

  const box = $('[data-orders]');
  box.innerHTML = '<p class="muted">Carregando...</p>';
  const { data, error } = await (await supa()).from('orders')
    .select('code,status,total,paid_amount_cents,created_at,items')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { box.innerHTML = '<p class="muted">Não conseguimos carregar seus pedidos agora. Recarregue a página.</p>'; return; }
  if (!data.length) {
    box.innerHTML = `<p class="muted">Nenhum pedido ainda com ${esc(user.email)}. Os pedidos feitos com este e-mail aparecem aqui.</p>`;
    return;
  }
  box.innerHTML = `<ul class="order-list">${data.map((o) => {
    const [label, cls] = STATUS[o.status] || [o.status, 'is-wait'];
    const total = o.paid_amount_cents != null ? o.paid_amount_cents / 100 : o.total;
    const items = (o.items || []).map((i) => `${i.qty} × ${esc(i.name)}`).join(', ');
    return `<li><a class="order-row" href="pedido.html?pedido=${encodeURIComponent(o.code)}">
      <span class="order-top"><b>${esc(o.code)}</b><span class="order-status ${cls}">${label}</span></span>
      <span class="order-items">${items}</span>
      <span class="order-meta muted small">${date(o.created_at)} · ${money(total)}</span>
    </a></li>`;
  }).join('')}</ul>`;
}

// Links from the confirmation and reset e-mails land here with the result in the URL hash.
// Read it now: supabase-js clears the hash once it has stored the session.
const hash = new URLSearchParams(location.hash.slice(1));
let recovering = hash.get('type') === 'recovery';
let welcome = hash.get('type') === 'signup' ? 'E-mail confirmado. Bem-vindo!' : '';
if (hash.get('error_code')) {
  const expired = /otp_expired/.test(hash.get('error_code'));
  note(loginForm, expired
    ? 'Esse link expirou ou já foi usado. Entre com sua senha ou peça um novo link.'
    : 'Não conseguimos validar o link. Peça um novo.');
  history.replaceState(null, '', pageUrl);
}

supa().then((s) => {
  s.auth.onAuthStateChange((event, session) => {
    // Run after the callback returns: supabase-js holds its auth lock while it runs.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') recovering = true;
      if (event === 'SIGNED_OUT') { show('login'); return; }
      if (!session?.user) return;
      if (recovering) { show('recover'); return; }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        renderDash(session.user).then(() => { if (welcome) { note(dash, welcome); welcome = ''; } });
      }
    }, 0);
  });
}).catch(() => note(loginForm, 'Não conseguimos carregar o login agora. Recarregue a página.'));
