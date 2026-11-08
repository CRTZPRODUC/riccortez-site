// Order status page. InfinitePay sends the customer back here with order_nsu, slug and
// transaction_nsu; the `pagamento` Edge Function confirms the payment with InfinitePay and
// answers with the order's public fields (no personal data).

import { CONFIG } from './config.js';
import { $, boot, cart, esc, money } from './app.js';

const box = $('[data-order]');
const q = new URLSearchParams(location.search);
let code = q.get('order_nsu') || q.get('pedido') || '';
if (!code) { try { code = sessionStorage.getItem('rc_last_order') || ''; } catch { /* private mode */ } }

const wa = (text) => `https://wa.me/${CONFIG.CONTACT.whatsappIntl}?text=${encodeURIComponent(text)}`;
const METHOD = { credit_card: 'Cartão de crédito', pix: 'Pix' };

function show(html) { box.innerHTML = html; }

async function load() {
  if (!/^RC\d{6}[A-Z0-9]{4}$/.test(code)) {
    show(`<h1 class="co-title">Pedido não encontrado</h1>
      <p>Não achamos o número do pedido neste link. Se você já pagou, fale com a gente no WhatsApp ${esc(CONFIG.CONTACT.whatsapp)}.</p>
      <a class="btn btn-primary" href="loja.html">Voltar à loja</a>`);
    return;
  }
  try {
    const res = await fetch(CONFIG.PAYMENT_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order_nsu: code, slug: q.get('slug') || '', transaction_nsu: q.get('transaction_nsu') || '' }),
    });
    const o = await res.json();
    if (!res.ok) throw new Error(o.error);
    render(o);
  } catch {
    show(`<h1 class="co-title">Pedido ${esc(code)}</h1>
      <p>Não conseguimos consultar o pedido agora. Recarregue a página em instantes.</p>
      <a class="btn btn-ghost" href="${wa(`Olá! Quero saber do pedido ${code}.`)}" target="_blank" rel="noopener">Falar no WhatsApp</a>`);
  }
}

function render(o) {
  const paid = o.status === 'paid';
  if (paid) { cart.items = []; cart.save(); }
  const items = o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}</li>`).join('');
  const how = paid && o.capture_method
    ? `<p>${esc(METHOD[o.capture_method] || o.capture_method)}${o.installments > 1 ? ` em ${o.installments}x` : ''}.</p>` : '';
  // Coupon: while pending it is Pix only (total is the card price); once paid by card its
  // discount is 0 and the line is not shown.
  const cDisc = Number(o.coupon_discount) || 0;
  const pendingCoupon = o.status === 'pending' && cDisc > 0;
  const coupon = o.coupon_code && cDisc > 0
    ? `<div class="sum-row coupon-row"><span>Cupom ${esc(o.coupon_code)}${pendingCoupon ? ' (no Pix)' : ''}</span><strong>− ${money(cDisc)}</strong></div>` : '';
  const pixPrice = Math.round(Math.round((o.total - cDisc) * 100) * (100 - (o.pix_discount_percent || 0)) / 100) / 100;
  const head = {
    paid: ['co-ok', 'Pagamento confirmado!', 'Recebemos seu pedido e você vai receber as atualizações por e-mail. O prazo de entrega conta a partir de agora.'],
    pending: ['co-wait', 'Aguardando pagamento', 'Ainda não recebemos a confirmação. Pix e cartão costumam confirmar em poucos minutos: recarregue esta página daqui a pouco.'],
    canceled: ['co-bad', 'Pedido cancelado', 'Este pedido foi cancelado. Se foi engano, faça um novo pedido ou fale com a gente.'],
    refunded: ['co-bad', 'Pedido reembolsado', 'O valor deste pedido foi devolvido.'],
  }[o.status] || ['co-wait', 'Pedido recebido', ''];
  show(`
    <div class="co-status ${head[0]}">
      <h1 class="co-title">${head[1]}</h1>
      <p class="co-code">Pedido <b>${esc(o.code)}</b></p>
      <p>${head[2]}</p>
    </div>
    <div class="co-box">
      <ul class="co-order-items">${items}</ul>
      ${o.shipping ? `<p class="muted">Entrega: ${esc(o.shipping)}</p>` : ''}
      ${coupon}
      <div class="sum-row co-total"><span>${o.paid_total != null ? 'Total pago' : (pendingCoupon ? 'Total no cartão' : 'Total')}</span><strong>${money(o.paid_total ?? o.total)}</strong></div>
      ${o.paid_total == null && o.status === 'pending' && (o.pix_discount_percent > 0 || pendingCoupon) ? `<p class="muted small">No Pix: ${money(pixPrice)} (${pendingCoupon ? `cupom ${esc(o.coupon_code)} + ` : ''}${o.pix_discount_percent}% de desconto${pendingCoupon ? '; no cartão o cupom não vale' : ''}).</p>` : ''}
      ${how}
      ${o.receipt_url ? `<p><a href="${esc(o.receipt_url)}" target="_blank" rel="noopener">Ver comprovante</a></p>` : ''}
    </div>
    <div class="co-actions">
      ${o.status === 'pending' ? '<button class="btn btn-primary" type="button" data-reload>Atualizar status</button>' : ''}
      <a class="btn btn-ghost" href="${wa(`Olá! Quero falar sobre o pedido ${o.code}.`)}" target="_blank" rel="noopener">Falar no WhatsApp</a>
      <a class="btn btn-ghost" href="loja.html">Continuar comprando</a>
    </div>`);
  $('[data-reload]')?.addEventListener('click', () => { show('<p class="muted">Consultando...</p>'); load(); });
}

boot().then(load);
