// Store admin panel: every order with the buyer's data, payment and shipping status, live.
// Sign-in is Supabase Auth; only accounts with app_metadata.role = "admin" get any rows back
// (row level security, supabase/migrations/*_orders_admin.sql). Admins can change only the
// shipping fields here; marking an order as shipped e-mails the customer the tracking code.
import { supa, captchaToken } from './auth.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (n) => BRL.format(Number(n) || 0);
const when = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const cpf = (s) => digits(s).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const cep = (s) => digits(s).replace(/^(\d{5})(\d{3})$/, '$1-$2');

const PAY = {
  pending: ['Aguardando pagamento', 'is-wait'],
  paid: ['Pago', 'is-ok'],
  canceled: ['Cancelado', 'is-bad'],
  refunded: ['Reembolsado', 'is-bad'],
};
const SHIP = {
  pending: ['Não enviado', 'is-mute'],
  preparing: ['Preparando', 'is-wait'],
  shipped: ['Enviado', 'is-info'],
  delivered: ['Entregue', 'is-ok'],
};
const METHOD = { credit_card: 'Cartão de crédito', pix: 'Pix' };

const toSend = (o) => o.status === 'paid' && (o.shipping_status === 'pending' || o.shipping_status === 'preparing');
const FILTERS = [
  ['send', 'Para enviar', toSend],
  ['all', 'Todos', () => true],
  ['pending', 'Aguardando pagamento', (o) => o.status === 'pending'],
  ['shipped', 'Enviados', (o) => o.shipping_status === 'shipped' || o.shipping_status === 'delivered'],
  ['closed', 'Cancelados/reembolsados', (o) => o.status === 'canceled' || o.status === 'refunded'],
];

let orders = [];
let filter = 'send';
let query = '';
const fresh = new Set();
let channel;

const toastEl = $('[data-toast]');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 4000);
}

// Short two-tone chime for a new paid order. Browsers allow audio only after a click on the
// page, so the first alert of a session may be silent.
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch { /* no audio */ }
}

function notify(title, body) {
  chime();
  toast(`${title} · ${body}`);
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(title, { body }); } catch { /* unsupported */ }
  }
}

// ---------- rendering ----------

function stats() {
  const now = new Date();
  const month = (o) => {
    const d = new Date(o.paid_at || o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const paid = orders.filter((o) => o.status === 'paid');
  const revenue = paid.filter(month).reduce((s, o) => s + (o.paid_amount_cents != null ? o.paid_amount_cents / 100 : Number(o.total)), 0);
  const sendN = orders.filter(toSend).length;
  $('[data-stats]').innerHTML = `
    <div class="adm-stat${sendN ? ' is-hot' : ''}"><b>${sendN}</b><span>Pagos para enviar</span></div>
    <div class="adm-stat"><b>${paid.filter(month).length}</b><span>Vendas no mês</span></div>
    <div class="adm-stat"><b>${money(revenue)}</b><span>Recebido no mês</span></div>
    <div class="adm-stat"><b>${orders.filter((o) => o.status === 'pending').length}</b><span>Aguardando pagamento</span></div>`;
  $('[data-filters]').innerHTML = FILTERS.map(([key, label, test]) =>
    `<button class="adm-chip" type="button" role="tab" data-filter="${key}" aria-selected="${key === filter}">${label}<small>${orders.filter(test).length}</small></button>`).join('');
}

function matches(o) {
  if (!query) return true;
  const c = o.customer || {};
  const a = o.address || {};
  const hay = [o.code, c.name, c.email, c.phone, digits(c.cpf), a.city, a.state, o.tracking_code].join(' ').toLowerCase();
  return query.split(/\s+/).every((w) => hay.includes(w) || (digits(w) && hay.includes(digits(w))));
}

function orderHtml(o, open) {
  const c = o.customer || {};
  const a = o.address || {};
  const s = o.shipping || {};
  const [payLabel, payCls] = PAY[o.status] || [o.status, 'is-mute'];
  const [shipLabel, shipCls] = SHIP[o.shipping_status] || [o.shipping_status, 'is-mute'];
  const paid = o.paid_amount_cents != null ? o.paid_amount_cents / 100 : null;
  const items = (o.items || []).map((i) => `<li><span>${Number(i.qty)} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></li>`).join('');
  const addrText = `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ''}\n${a.neighborhood} - ${a.city}/${a.state}\nCEP ${cep(a.cep)}`;
  const label = `${c.name}\nCPF ${cpf(c.cpf)}\nTel ${c.phone || ''}\n${addrText}`;
  const wa = digits(c.phone) ? `https://wa.me/55${digits(c.phone).replace(/^55(?=\d{10,11}$)/, '')}` : '';
  return `<details class="adm-order${fresh.has(o.code) ? ' is-new' : ''}" data-code="${esc(o.code)}"${open ? ' open' : ''}>
  <summary>
    <span class="adm-code">${esc(o.code)}</span>
    <span class="adm-sum-total">${money(paid ?? o.total)}</span>
    <span class="adm-sum-meta">${esc(c.name)} · ${esc(a.city)}/${esc(a.state)} · ${when(o.created_at)}</span>
    <span class="adm-badges"><span class="adm-badge ${payCls}">${payLabel}</span>${o.status === 'paid' ? `<span class="adm-badge ${shipCls}">${shipLabel}</span>` : ''}</span>
  </summary>
  <div class="adm-body">
    <div>
      <h3>Comprador</h3>
      <p><b>${esc(c.name)}</b></p>
      <p>CPF ${esc(cpf(c.cpf))}</p>
      <p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
      <p>${esc(c.phone)}${wa ? ` · <a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</p>
      <h3 style="margin-top:14px">Entrega</h3>
      <p style="white-space:pre-line">${esc(addrText)}</p>
      <p class="adm-muted">${esc(s.name || '')}${s.days_max ? ` · ${Number(s.days_min)}–${Number(s.days_max)} dias úteis + despacho` : ''}</p>
      <button class="adm-copy" type="button" data-copy="${esc(label)}">Copiar dados da etiqueta</button>
    </div>
    <div>
      <h3>Itens</h3>
      <ul class="adm-items">${items}</ul>
      <div class="adm-rows">
        <span>Produtos</span><span>${money(o.subtotal)}</span>
        <span>Frete cobrado</span><span>${Number(o.shipping_price) > 0 ? money(o.shipping_price) : 'Grátis'}</span>
        <span class="tot">${paid != null ? 'Pago' : 'Total'}</span><span class="tot">${money(paid ?? o.total)}</span>
      </div>
    </div>
    <div>
      <h3>Pagamento</h3>
      <p><span class="adm-badge ${payCls}">${payLabel}</span></p>
      ${o.capture_method ? `<p>${esc(METHOD[o.capture_method] || o.capture_method)}${Number(o.installments) > 1 ? ` em ${Number(o.installments)}x` : ''}</p>` : ''}
      ${o.paid_at ? `<p class="adm-muted">Pago em ${when(o.paid_at)}</p>` : ''}
      ${o.receipt_url ? `<p><a href="${esc(o.receipt_url)}" target="_blank" rel="noopener">Comprovante</a></p>` : ''}
      ${o.transaction_nsu ? `<p class="adm-muted">NSU ${esc(o.transaction_nsu)}</p>` : ''}
      ${o.ref ? `<p class="adm-muted">Indicação: ${esc(o.ref)}</p>` : ''}
      <p class="adm-muted">Criado em ${when(o.created_at)}</p>
    </div>
    ${o.status === 'paid' ? `<form class="adm-ship" data-ship>
      <label>Status do envio
        <select name="shipping_status">${Object.entries(SHIP).map(([k, [l]]) => `<option value="${k}"${k === o.shipping_status ? ' selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <label>Código de rastreio
        <input type="text" name="tracking_code" value="${esc(o.tracking_code || '')}" placeholder="Ex.: AA123456789BR" autocomplete="off">
      </label>
      <button class="adm-btn adm-btn--sm" type="submit">Salvar</button>
      <p class="adm-msg" data-ship-msg>${o.shipped_at ? `Enviado em ${when(o.shipped_at)}.` : 'Ao marcar "Enviado", o cliente recebe um e-mail com o código de rastreio.'}</p>
    </form>` : ''}
  </div>
</details>`;
}

function render() {
  stats();
  const test = FILTERS.find(([k]) => k === filter)[2];
  const list = orders.filter(test).filter(matches);
  const open = new Set([...document.querySelectorAll('.adm-order[open]')].map((d) => d.dataset.code));
  // Keep a half-typed tracking code when a live update re-renders the list.
  const drafts = {};
  document.querySelectorAll('.adm-order[open] [data-ship]').forEach((f) => {
    drafts[f.closest('.adm-order').dataset.code] = { s: f.shipping_status.value, t: f.tracking_code.value };
  });
  $('[data-list]').innerHTML = list.length
    ? list.map((o) => orderHtml(o, open.has(o.code))).join('')
    : `<p class="adm-muted">${orders.length ? 'Nenhum pedido neste filtro.' : 'Nenhum pedido ainda.'}</p>`;
  Object.entries(drafts).forEach(([code, d]) => {
    const f = document.querySelector(`.adm-order[data-code="${CSS.escape(code)}"] [data-ship]`);
    if (f) { f.shipping_status.value = d.s; f.tracking_code.value = d.t; }
  });
  fresh.clear();
}

// ---------- data ----------

async function load() {
  const s = await supa();
  const { data, error } = await s.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) { $('[data-list]').innerHTML = '<p class="adm-msg">Não conseguimos carregar os pedidos. Recarregue a página.</p>'; return; }
  orders = data;
  render();
}

function live() {
  supa().then((s) => {
    channel = s.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, ({ eventType, new: row, old }) => {
        const i = orders.findIndex((o) => o.code === (row?.code ?? old?.code));
        const before = i >= 0 ? orders[i] : null;
        if (eventType === 'DELETE') { if (i >= 0) orders.splice(i, 1); render(); return; }
        if (i >= 0) orders[i] = row; else orders.unshift(row);
        if (row.status === 'paid' && before?.status !== 'paid') {
          fresh.add(row.code);
          notify('Novo pedido pago', `${row.code} · ${row.customer?.name || ''} · ${money(row.paid_amount_cents != null ? row.paid_amount_cents / 100 : row.total)}`);
        } else if (!before) {
          fresh.add(row.code);
          toast(`Novo pedido ${row.code} aguardando pagamento`);
        }
        render();
      })
      .subscribe((status) => { $('[data-live]').hidden = status !== 'SUBSCRIBED'; });
  });
}

// ---------- events ----------

document.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (chip) { filter = chip.dataset.filter; render(); return; }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard.writeText(copy.dataset.copy).then(() => toast('Dados copiados'), () => toast('Não deu para copiar'));
  }
});

$('[data-search]').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); render(); });

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-ship]');
  if (!form) return;
  e.preventDefault();
  const code = form.closest('.adm-order').dataset.code;
  const order = orders.find((o) => o.code === code);
  const status = form.shipping_status.value;
  const tracking = form.tracking_code.value.trim().toUpperCase() || null;
  const msg = $('[data-ship-msg]', form);
  if (status === 'shipped' && !tracking && !confirm('Marcar como enviado sem código de rastreio? O cliente recebe o e-mail sem o código.')) return;
  const patch = { shipping_status: status, tracking_code: tracking, updated_at: new Date().toISOString() };
  if ((status === 'shipped' || status === 'delivered') && !order.shipped_at) patch.shipped_at = new Date().toISOString();
  const btn = $('button[type=submit]', form);
  btn.disabled = true;
  const { data, error } = await (await supa()).from('orders').update(patch).eq('code', code).select().single();
  btn.disabled = false;
  if (error) { msg.textContent = 'Não salvou. Tente de novo.'; return; }
  Object.assign(order, data);
  render();
  toast(status === 'shipped' && order.shipping_status === 'shipped' ? 'Salvo. O cliente vai receber o e-mail de envio.' : 'Salvo');
});

// ---------- auth ----------

const loginForm = $('[data-login]');
const loginMsg = $('[data-login-msg]');

function showLogin(message = '') {
  loginForm.hidden = false;
  $('[data-panel]').hidden = true;
  $('[data-signout]').hidden = true;
  $('[data-user]').textContent = '';
  loginMsg.textContent = message;
  if (channel) { supa().then((s) => s.removeChannel(channel)); channel = null; }
}

async function enter(user) {
  if (user?.app_metadata?.role !== 'admin') {
    await (await supa()).auth.signOut().catch(() => {});
    showLogin('Esta conta não tem acesso ao painel.');
    return;
  }
  loginForm.hidden = true;
  $('[data-panel]').hidden = false;
  $('[data-signout]').hidden = false;
  $('[data-user]').textContent = user.email;
  await load();
  if (!channel) live();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('button', loginForm);
  btn.disabled = true;
  loginMsg.textContent = '';
  try {
    const { data, error } = await (await supa()).auth.signInWithPassword({
      email: loginForm.email.value.trim(), password: loginForm.password.value,
      options: { captchaToken: await captchaToken(loginForm) },
    });
    if (error) { loginMsg.textContent = /invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : 'Não deu para entrar agora.'; return; }
    loginForm.reset();
    await enter(data.user);
  } catch {
    loginMsg.textContent = 'Sem conexão com o servidor.';
  } finally {
    btn.disabled = false;
  }
});

$('[data-signout]').addEventListener('click', async () => {
  await (await supa()).auth.signOut().catch(() => {});
  showLogin();
});

supa().then(async (s) => {
  const { data } = await s.auth.getSession();
  if (data.session?.user) await enter(data.session.user); else showLogin();
  s.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') setTimeout(() => showLogin(), 0); });
}).catch(() => showLogin('Não conseguimos carregar o login. Recarregue a página.'));
