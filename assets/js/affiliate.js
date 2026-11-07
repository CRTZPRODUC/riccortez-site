// Affiliate dashboard: the signed-in affiliate's referral link, commission totals and the orders
// made with their code. Everything comes from two database functions that return only values
// and a short reference per order (supabase/migrations/*_affiliates.sql); the affiliate never
// reads the orders table, so buyer data, items and full order ids never reach this page.
// A paid order's commission is the value stored when it was paid (it does not change if the
// rate changes later); a pending order's commission is only a projection at the current rate.
// Every value from the server goes through esc() before it is placed in HTML.
import { boot, icon, money, esc, toast, $, $$ } from './app.js';
import { supa } from './auth.js';
import { CONFIG } from './config.js';

boot({ active: 'conta' });

const SITE = 'https://riccortez.com/';
const STATUS = {
  pago: ['Pago', 'is-ok'],
  pendente: ['Pendente', 'is-wait'],
  cancelado: ['Cancelado', 'is-bad'],
};
const FILTERS = [
  ['all', 'Todos', () => true],
  ['pago', 'Pagos', (o) => o.status === 'pago'],
  ['pendente', 'Pendentes', (o) => o.status === 'pendente'],
];

const stateBox = $('[data-state]');
const panel = $('[data-aff]');
let orders = [];
let filter = 'all';

const pct = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const date = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

// `html` is trusted markup written here.
function state(html) {
  stateBox.innerHTML = html;
  stateBox.hidden = !html;
}

function renderCards(s) {
  const cards = [
    ['Comissão a receber', money(s.commission_paid), 'Pedidos pagos', true],
    ['Comissão prevista', money(s.commission_pending), 'Pedidos aguardando pagamento (estimativa)'],
    ['Pedidos', String(s.orders_count), `${s.paid_count} pago${Number(s.paid_count) === 1 ? '' : 's'}`],
    ['Sua taxa', pct(s.commission_pct), 'Sobre o valor dos produtos'],
  ];
  $('[data-cards]').innerHTML = cards.map(([label, value, hint, hot]) => `
    <div class="aff-card${hot ? ' is-hot' : ''}">
      <span class="aff-card-label">${esc(label)}</span>
      <b class="aff-card-value">${esc(value)}</b>
      <span class="aff-card-hint muted small">${esc(hint)}</span>
    </div>`).join('');
}

function renderOrders() {
  $('[data-filters]').innerHTML = FILTERS.map(([key, label, test]) =>
    `<button class="aff-filter" type="button" role="tab" data-filter="${key}" aria-selected="${key === filter}">${label} <small>${orders.filter(test).length}</small></button>`).join('');
  const list = orders.filter(FILTERS.find(([k]) => k === filter)[2]);
  const box = $('[data-orders]');
  if (!list.length) {
    box.innerHTML = `<p class="aff-empty muted">${orders.length ? 'Nenhum pedido neste filtro.' : 'Nenhum pedido com seu link ainda. Assim que alguém comprar por ele, o pedido aparece aqui.'}</p>`;
    return;
  }
  box.innerHTML = `<ul class="aff-orders">${list.map((o) => {
    const [label, cls] = (STATUS[o.status] || [o.status, 'is-wait']).map(esc);
    return `<li class="aff-order">
      <span class="aff-order-top"><b>#${esc(o.ref_short)}</b><span class="order-status ${cls}">${label}</span></span>
      <span class="aff-order-date muted small">${date(o.created_at)}</span>
      <span class="aff-order-vals">
        <span><small class="muted">Produtos</small>${money(o.subtotal)}</span>
        <span class="${o.status === 'cancelado' ? 'is-void' : ''}"><small class="muted">${o.projected ? 'Comissão prevista' : 'Comissão'}</small>${o.status === 'cancelado' ? money(0) : esc(money(o.commission))}</span>
      </span>
    </li>`;
  }).join('')}</ul>`;
}

async function load(s) {
  state('<p class="muted">Carregando...</p>');
  panel.hidden = true;
  const [sum, list] = await Promise.all([s.rpc('my_affiliate_summary'), s.rpc('my_affiliate_orders')]);
  if (sum.error || list.error) {
    state(`<p class="form-note">${icon('info', 18)}<span>Não conseguimos carregar seus dados agora. Recarregue a página.</span></p>`);
    return;
  }
  const summary = sum.data?.[0];
  if (!summary) {
    state(`<div class="aff-msg">
      <h2>Você ainda não é afiliado</h2>
      <p class="muted">Esta área é para parceiros da Ric Cortez. Quer indicar nossos captadores e ganhar comissão? Fale com a gente.</p>
      <div class="aff-msg-actions">
        <a class="btn btn-primary" href="contato.html">Falar com a loja</a>
        <a class="btn btn-ghost" href="conta.html">Minha conta</a>
      </div>
    </div>`);
    return;
  }
  state('');
  panel.hidden = false;
  const url = `${SITE}?ref=${encodeURIComponent(summary.code)}`;
  $('[data-link]').value = url;
  $('[data-ref-days]').textContent = String(CONFIG.REF_DAYS);
  orders = list.data || [];
  renderCards(summary);
  renderOrders();
}

function signedOut() {
  panel.hidden = true;
  state(`<div class="aff-msg">
    <h2>Entre na sua conta</h2>
    <p class="muted">Para ver seu link e suas comissões, entre com o e-mail cadastrado como afiliado. Depois volte para esta página.</p>
    <div class="aff-msg-actions"><a class="btn btn-primary" href="conta.html">Entrar na minha conta</a></div>
  </div>`);
}

document.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (chip) { filter = chip.dataset.filter; renderOrders(); return; }
  if (e.target.closest('[data-copy-link]')) {
    const input = $('[data-link]');
    const done = () => toast('Link copiado');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(input.value).then(done, () => { input.select(); toast('Selecione e copie o link'); });
    } else {
      input.select();
      try { document.execCommand('copy'); done(); } catch { toast('Selecione e copie o link'); }
    }
  }
});

$$('[data-link]').forEach((i) => i.addEventListener('focus', () => i.select()));

supa().then((s) => {
  s.auth.onAuthStateChange((event, session) => {
    // Run after the callback returns: supabase-js holds its auth lock while it runs.
    setTimeout(() => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session?.user)) { signedOut(); return; }
      if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) load(s);
    }, 0);
  });
}).catch(() => state('<p class="muted">Não conseguimos carregar o login agora. Recarregue a página.</p>'));
