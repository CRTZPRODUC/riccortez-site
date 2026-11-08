// Store admin panel: every order with the buyer's data, payment and shipping status, live.
// Sign-in is Supabase Auth plus a TOTP code (MFA): only accounts with app_metadata.role = "admin"
// and an aal2 session get any rows back (row level security, public.is_admin(),
// supabase/migrations/*_orders_admin.sql and *_integrity.sql). Admins can change only the
// shipping fields here; marking an order as shipped e-mails the customer the tracking code.
// The "Afiliados" tab manages referral partners and shows their commissions; "Integridade"
// runs the Edge Function `verificar` (order seals, commissions, audit log hash chain).
// Every value from the server goes through esc() before it is placed in HTML.
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
  const hay = [o.code, c.name, c.email, c.phone, digits(c.cpf), a.city, a.state, o.tracking_code, o.ref].join(' ').toLowerCase();
  return query.split(/\s+/).every((w) => hay.includes(w) || (digits(w) && hay.includes(digits(w))));
}

// Commission hold, mirroring affiliate_commission_state() in the database: held for HOLD_DAYS
// after payment, then released; canceled when the order is canceled/refunded during the hold.
const HOLD_DAYS = 15;
const DAY = 86400000;
function holdText(o) {
  const release = new Date(new Date(o.paid_at).getTime() + HOLD_DAYS * DAY);
  if (o.status === 'canceled' || o.status === 'refunded') {
    return o.canceled_at && new Date(o.canceled_at) >= release ? 'liberada antes do cancelamento' : 'comissão cancelada';
  }
  return Date.now() < release.getTime() ? `retida até ${when(release.toISOString())}` : 'liberada';
}

// Affiliate commission of one order: the snapshot stored when it was paid (with the seal state),
// or, while it waits for payment, a note that it is computed at payment time.
function commissionHtml(o) {
  if (o.paid_at) {
    const seal = o.seal ? '<span class="adm-badge is-ok" title="Valores assinados no pagamento">Selado</span>'
      : '<span class="adm-badge is-bad" title="Pedido pago sem selo: rode a verificação de integridade">Sem selo</span>';
    const aff = o.affiliate_code
      ? `Afiliado ${esc(o.affiliate_code)} · comissão ${esc(money(o.commission))} (${esc(pct(o.commission_pct))}) · ${esc(holdText(o))}`
      : (o.ref ? 'Indicação sem afiliado ativo no pagamento: sem comissão' : '');
    return `${aff ? `<p class="adm-muted">${aff}</p>` : ''}<p>${seal}</p>`;
  }
  return o.ref && o.status === 'pending' ? '<p class="adm-muted">Comissão calculada quando o pedido for pago.</p>' : '';
}

function orderHtml(o, open) {
  const c = o.customer || {};
  const a = o.address || {};
  const s = o.shipping || {};
  const [payLabel, payCls] = (PAY[o.status] || [o.status, 'is-mute']).map(esc);
  const [shipLabel, shipCls] = (SHIP[o.shipping_status] || [o.shipping_status, 'is-mute']).map(esc);
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
    <span class="adm-badges">${o.coupon_code ? `<span class="adm-badge is-ref" title="Cupom">${esc(o.coupon_code)}</span>` : ''}${o.ref ? `<span class="adm-badge is-ref" title="Código de indicação">Ref ${esc(o.ref)}</span>` : ''}<span class="adm-badge ${payCls}">${payLabel}</span>${o.status === 'paid' ? `<span class="adm-badge ${shipCls}">${shipLabel}</span>` : ''}</span>
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
        ${o.coupon_code ? `<span>Cupom ${esc(o.coupon_code)}${o.status === 'pending' ? ' (só no Pix)' : ''}</span><span>${Number(o.coupon_discount) > 0 ? `− ${money(o.coupon_discount)}` : 'não usado (cartão)'}</span>` : ''}
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
      ${commissionHtml(o)}
      <p class="adm-muted">Criado em ${when(o.created_at)}</p>
      ${o.canceled_at ? `<p class="adm-muted">${o.status === 'refunded' ? 'Reembolsado' : 'Cancelado'} em ${when(o.canceled_at)}</p>` : ''}
      ${o.status === 'paid' || o.status === 'pending' ? `<p class="adm-cancel">
        <button class="adm-copy" type="button" data-cancel="canceled">Cancelar pedido</button>
        ${o.status === 'paid' ? '<button class="adm-copy" type="button" data-cancel="refunded">Marcar como devolvido</button>' : ''}
      </p>` : ''}
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
  const tab = e.target.closest('[data-view-tab]');
  if (tab) { showView(tab.dataset.viewTab); return; }
  const edit = e.target.closest('[data-aff-edit]');
  if (edit) {
    const a = affiliates.find((x) => x.code === edit.dataset.affEdit);
    if (a) {
      affForm.email.value = a.email || '';
      affForm.code.value = a.code;
      affForm.name.value = a.name;
      affMsg.textContent = '';
      affForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      affForm.name.focus({ preventScroll: true });
    }
    return;
  }
  const chip = e.target.closest('[data-filter]');
  if (chip) { filter = chip.dataset.filter; render(); return; }
  const cancel = e.target.closest('[data-cancel]');
  if (cancel) { cancelOrder(cancel); return; }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard.writeText(copy.dataset.copy).then(() => toast('Copiado'), () => toast('Não deu para copiar'));
  }
});

// Cancel or refund through admin_cancel_order(): the database stamps canceled_at, logs the change
// and cancels the affiliate commission if it is still inside the hold.
async function cancelOrder(btn) {
  const code = btn.closest('.adm-order').dataset.code;
  const status = btn.dataset.cancel;
  const what = status === 'refunded' ? 'marcar o pedido como devolvido/reembolsado' : 'cancelar o pedido';
  if (!confirm(`Confirma ${what} ${code}?

O cliente recebe um e-mail avisando. Se houver comissão de afiliado ainda retida, ela é cancelada. Isso não pode ser desfeito.

O estorno do dinheiro é feito na InfinitePay.`)) return;
  btn.disabled = true;
  const { data, error } = await (await supa()).rpc('admin_cancel_order', { p_code: code, p_status: status });
  btn.disabled = false;
  if (error) { toast('Não deu para alterar. Saia e entre de novo, ou tente mais tarde.'); return; }
  const order = orders.find((o) => o.code === code);
  if (order && data?.[0]) Object.assign(order, data[0]);
  render();
  toast(status === 'refunded' ? 'Pedido marcado como devolvido' : 'Pedido cancelado');
}

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

// ---------- affiliates ----------
// Commission totals come from admin_affiliates_report(); the form and the active switch call
// admin_upsert_affiliate() and admin_set_affiliate_active(). All three check is_admin() in the
// database (supabase/migrations/*_affiliates.sql).

let affiliates = [];
const affForm = $('[data-aff-form]');
const affMsg = $('[data-aff-msg]');
const pct = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function showView(view) {
  document.querySelectorAll('[data-view-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.viewTab === view)));
  document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== view; });
  if (view === 'affiliates') loadAffiliates();
}

// ---------- integrity ----------
// The Edge Function `verificar` recomputes every paid order's seal (HMAC with a key kept outside
// the database) and commission, and walks the whole audit log hash chain. The head hash it
// returns is worth saving outside the system: pasting it back later proves that the history up
// to that point was not rewritten.

const PROBLEM = {
  missing_seal: 'Pedido pago sem selo',
  seal_mismatch: 'Selo não confere: valores alterados depois do pagamento',
  commission_mismatch: 'Comissão diferente da conta',
  affiliate_mismatch: 'Afiliado diferente da indicação do pedido',
  seal_key_missing: 'Chave do selo não configurada no servidor',
  invalid_data: 'Dados inválidos',
};
const intForm = $('[data-integrity]');
const intOut = $('[data-integrity-out]');

function intMessage(text, cls = 'is-bad') {
  intOut.className = `adm-integrity-out ${cls}`;
  intOut.innerHTML = `<p>${esc(text)}</p>`;
}

function renderIntegrity(r) {
  const bad = [];
  if (!r.seal_key_configured) bad.push('<li>Chave do selo (ORDER_SEAL_SECRET) não configurada no servidor: os selos não puderam ser conferidos.</li>');
  for (const f of r.orders?.failed ?? []) {
    bad.push(`<li><b>${esc(f.code)}</b>: ${(f.problems ?? []).map((p) => `${esc(PROBLEM[p.code] || p.code)} (${esc(p.detail)})`).join('; ')}</li>`);
  }
  if (r.chain && !r.chain.ok) bad.push(`<li>Histórico quebrado no registro #${esc(r.chain.break_at)}: ${esc(r.chain.problem)}</li>`);
  const cp = r.chain?.checkpoint;
  if (cp && !cp.ok) bad.push(`<li>O código guardado (registro #${esc(cp.id)}) não confere: ${esc(cp.problem)}</li>`);
  const head = r.chain?.head_hash ? `#${r.chain.head_id} ${r.chain.head_hash}` : '';
  intOut.className = `adm-integrity-out ${r.ok ? 'is-ok' : 'is-bad'}`;
  intOut.innerHTML = `
    <h3>${r.ok ? 'Tudo íntegro' : 'Problemas encontrados'}</h3>
    ${bad.length ? `<ul>${bad.join('')}</ul>` : ''}
    <p>${esc(r.orders?.checked ?? 0)} pedido(s) pago(s) conferido(s) · ${esc(r.chain?.entries ?? 0)} registro(s) no histórico${cp?.ok ? ' · código guardado confere' : ''} · ${esc(when(r.checked_at))}</p>
    ${head ? `<p>Código do histórico agora:</p>
    <code class="adm-hash">${esc(head)}</code>
    <p><button class="adm-copy" type="button" data-copy="${esc(head)}">Copiar código</button></p>
    <p>Guarde este código fora do sistema (por exemplo, mande para o seu próprio e-mail, com a data). Para provar depois que o histórico até aqui não foi reescrito, cole o código no campo acima e verifique de novo.</p>` : ''}`;
}

intForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = intForm.checkpoint.value.trim();
  const m = /#?\s*(\d+)\D+([0-9a-f]{64})/i.exec(raw);
  if (raw && !m) { intMessage('Código guardado inválido. Cole no formato "#número hash", como foi copiado.'); return; }
  const btn = $('button[type=submit]', intForm);
  btn.disabled = true;
  intMessage('Verificando...', '');
  try {
    const body = m ? { checkpoint_id: Number(m[1]), checkpoint_hash: m[2].toLowerCase() } : {};
    const { data, error } = await (await supa()).functions.invoke('verificar', { body });
    if (error) {
      const status = error.context?.status;
      intMessage(status === 401 || status === 403
        ? 'Sem permissão. Saia e entre de novo com o código do app autenticador.'
        : 'Não deu para verificar agora. Tente de novo.');
      return;
    }
    renderIntegrity(data);
  } catch {
    intMessage('Sem conexão com o servidor.');
  } finally {
    btn.disabled = false;
  }
});

function renderAffiliates() {
  const box = $('[data-aff-list]');
  if (!affiliates.length) { box.innerHTML = '<p class="adm-muted">Nenhum afiliado cadastrado.</p>'; return; }
  box.innerHTML = `<div class="adm-table-wrap"><table class="adm-table">
    <thead><tr><th>Afiliado</th><th>Pedidos</th><th>Vendas pagas</th><th>Liberada (a pagar)</th><th>Retida (${HOLD_DAYS} dias)</th><th>Prevista</th><th>Ativo</th></tr></thead>
    <tbody>${affiliates.map((a) => `<tr class="${a.active ? '' : 'is-off'}">
      <td data-th="Afiliado"><b>${esc(a.code)}</b> · ${esc(a.name)}<br><span class="adm-muted">${esc(a.email || 'conta removida')} · ${pct(a.commission_pct)}</span>
        <br><button class="adm-copy" type="button" data-copy="https://riccortez.com/?ref=${esc(encodeURIComponent(a.code))}">Copiar link</button>
        <button class="adm-copy" type="button" data-aff-edit="${esc(a.code)}">Editar</button></td>
      <td data-th="Pedidos"><span>${Number(a.orders_count)} <span class="adm-muted">(${Number(a.paid_count)} pagos)</span></span></td>
      <td data-th="Vendas pagas">${money(a.paid_sales)}</td>
      <td data-th="Liberada (a pagar)"><b class="is-wait">${money(a.commission_released)}</b></td>
      <td data-th="Retida"><span title="Pedidos pagos há menos de ${HOLD_DAYS} dias; cancelada se o pedido for cancelado ou devolvido nesse prazo">${money(a.commission_held)}</span></td>
      <td data-th="Prevista"><span class="adm-muted" title="Projeção com a taxa atual; o valor fica fixo quando o pedido é pago">${money(a.commission_pending)}</span></td>
      <td data-th="Ativo"><label class="adm-switch"><input type="checkbox" data-aff-active="${esc(a.code)}"${a.active ? ' checked' : ''}><span></span><em>${a.active ? 'Ativo' : 'Inativo'}</em></label></td>
    </tr>`).join('')}</tbody></table></div>
    <p class="adm-muted adm-aff-note">Comissão sobre o valor dos produtos (sem frete), gravada em cada pedido no momento do pagamento (não muda se a taxa mudar depois). Ela fica retida por ${HOLD_DAYS} dias após o pagamento e só então é liberada para pagar ao afiliado; se o pedido for cancelado ou devolvido nesse prazo, a comissão é cancelada. "Prevista" é só uma projeção dos pedidos que aguardam pagamento, com a taxa atual.</p>`;
}

async function loadAffiliates() {
  const { data, error } = await (await supa()).rpc('admin_affiliates_report');
  if (error) { $('[data-aff-list]').innerHTML = '<p class="adm-msg">Não conseguimos carregar os afiliados. Recarregue a página.</p>'; return; }
  affiliates = data || [];
  renderAffiliates();
}

function affError(err) {
  const m = String(err?.message || '');
  if (/user not found/i.test(m)) return 'Não existe conta com esse e-mail. A pessoa precisa criar a conta em conta.html e confirmar o e-mail.';
  if (/code in use|duplicate|unique/i.test(m)) return 'Esse código já é de outro afiliado.';
  if (/invalid code/i.test(m)) return 'Código inválido: use de 2 a 40 letras, números, _ ou -.';
  if (/has paid orders and cannot change/i.test(m)) return 'Esse afiliado já tem pedidos pagos com o código atual, então o código não pode mudar.';
  if (/not allowed/i.test(m)) return 'Sem permissão. Saia e entre de novo com o código do app autenticador.';
  return 'Não salvou. Tente de novo.';
}

affForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  affMsg.classList.remove('is-ok');
  const code = affForm.code.value.trim().toUpperCase();
  affForm.code.value = code;
  if (!affForm.checkValidity()) { affMsg.textContent = 'Preencha e-mail, código (2 a 40 letras, números, _ ou -) e nome.'; return; }
  const btn = $('button[type=submit]', affForm);
  btn.disabled = true;
  const { error } = await (await supa()).rpc('admin_upsert_affiliate', {
    p_email: affForm.email.value.trim(), p_code: code, p_name: affForm.name.value.trim(),
  });
  btn.disabled = false;
  if (error) { affMsg.textContent = affError(error); return; }
  affMsg.classList.add('is-ok');
  affMsg.textContent = `Afiliado ${code} salvo. Link: https://riccortez.com/?ref=${code}`;
  affForm.reset();
  loadAffiliates();
});

document.addEventListener('change', async (e) => {
  const box = e.target.closest('[data-aff-active]');
  if (!box) return;
  box.disabled = true;
  const { error } = await (await supa()).rpc('admin_set_affiliate_active', { p_code: box.dataset.affActive, p_active: box.checked });
  if (error) { box.checked = !box.checked; box.disabled = false; toast('Não salvou. Tente de novo.'); return; }
  toast(box.checked ? `${box.dataset.affActive} ativado` : `${box.dataset.affActive} desativado`);
  loadAffiliates();
});

// ---------- auth ----------

const loginForm = $('[data-login]');
const loginMsg = $('[data-login-msg]');

function showLogin(message = '') {
  loginForm.hidden = false;
  mfaForm.hidden = true;
  $('[data-panel]').hidden = true;
  $('[data-signout]').hidden = true;
  $('[data-user]').textContent = '';
  loginMsg.textContent = message;
  if (channel) { supa().then((s) => s.removeChannel(channel)); channel = null; }
}

// ---------- MFA (TOTP) ----------
// is_admin() needs an aal2 session, so after the password the admin types a code from an
// authenticator app. Without a verified TOTP factor the form first enrolls one (QR code).

const mfaForm = $('[data-mfa]');
const mfaMsg = $('[data-mfa-msg]');
let mfaFactor = null;

async function showMfa() {
  const s = await supa();
  loginForm.hidden = true;
  $('[data-panel]').hidden = true;
  $('[data-signout]').hidden = true;
  mfaForm.hidden = false;
  mfaForm.reset();
  mfaMsg.textContent = '';
  mfaFactor = null;
  const { data, error } = await s.auth.mfa.listFactors();
  if (error) { mfaMsg.textContent = 'Não deu para carregar a verificação. Recarregue a página.'; return; }
  const verified = (data.totp ?? []).find((f) => f.status === 'verified');
  $('[data-mfa-enroll]').hidden = !!verified;
  $('[data-mfa-ask]').hidden = !verified;
  if (verified) { mfaFactor = verified.id; mfaForm.code.focus(); return; }
  // Drop half-finished enrollments (page reloaded before the code was confirmed).
  for (const f of (data.all ?? []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
    await s.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
  }
  const { data: en, error: enErr } = await s.auth.mfa.enroll({
    factorType: 'totp', friendlyName: `Painel ${new Date().toISOString().slice(0, 16)}`,
  });
  if (enErr) { mfaMsg.textContent = 'Não deu para gerar o QR code. Recarregue a página.'; return; }
  mfaFactor = en.id;
  $('[data-mfa-qr]').src = en.totp.qr_code;   // data: URI from Supabase, set as a property
  $('[data-mfa-secret]').textContent = en.totp.secret;
  mfaForm.code.focus();
}

mfaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = mfaForm.code.value.replace(/\D/g, '');
  if (code.length !== 6 || !mfaFactor) { mfaMsg.textContent = 'Digite os 6 dígitos do app.'; return; }
  const btn = $('button[type=submit]', mfaForm);
  btn.disabled = true;
  mfaMsg.textContent = '';
  try {
    const s = await supa();
    const { error } = await s.auth.mfa.challengeAndVerify({ factorId: mfaFactor, code });
    if (error) { mfaMsg.textContent = 'Código incorreto ou expirado. Confira o relógio do celular e tente o próximo código.'; return; }
    const { data } = await s.auth.getUser();
    await enter(data.user);
  } catch {
    mfaMsg.textContent = 'Sem conexão com o servidor.';
  } finally {
    btn.disabled = false;
  }
});

$('[data-mfa-cancel]').addEventListener('click', async () => {
  await (await supa()).auth.signOut().catch(() => {});
  showLogin();
});

async function enter(user) {
  if (user?.app_metadata?.role !== 'admin') {
    await (await supa()).auth.signOut().catch(() => {});
    showLogin('Esta conta não tem acesso ao painel.');
    return;
  }
  const { data: aal, error } = await (await supa()).auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) { showLogin('Não deu para conferir a verificação em duas etapas. Recarregue a página.'); return; }
  if (aal.currentLevel !== 'aal2') { await showMfa(); return; }
  loginForm.hidden = true;
  mfaForm.hidden = true;
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
