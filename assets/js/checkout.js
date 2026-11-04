// Checkout page: customer and address form, live shipping options, order summary.
// Prices are shown from the local catalog for convenience; the `checkout` Edge Function
// recomputes everything and returns the InfinitePay payment page we redirect to.

import { CONFIG } from './config.js';
import { $, $$, boot, cart, esc, getRef, interestFree, money } from './app.js';

const form = $('[data-co-form]');
const digits = (s) => String(s || '').replace(/\D/g, '');

let byId = new Map();
let quote = null;          // last shipping answer for the current CEP and cart
let quotedFor = '';        // "cep|items" key of that answer
let selected = null;       // chosen service id

const lines = () => cart.items.map((i) => ({ p: byId.get(i.id), qty: i.qty })).filter((l) => l.p);
const subtotal = () => lines().reduce((s, l) => s + l.p.price * l.qty, 0);
const itemsBody = () => cart.items.map(({ id, qty }) => ({ id, qty }));
const cartKey = () => `${digits(form.cep.value)}|${JSON.stringify(itemsBody())}`;

/* ----------------------------------------------------------------- masks */

const masks = {
  phone: (d) => d.slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2'),
  cpf: (d) => d.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  cep: (d) => d.slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
};
for (const [name, fn] of Object.entries(masks)) {
  form[name].addEventListener('input', (e) => { e.target.value = fn(digits(e.target.value)); });
}
form.state.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^a-z]/gi, '').toUpperCase(); });

/* --------------------------------------------------------------- summary */

function renderSummary() {
  const ls = lines();
  const sub = subtotal();
  $('[data-co-lines]').innerHTML = ls.map(({ p, qty }) => `
    <li>
      <img src="${esc(p.img)}" alt="" width="56" height="56" loading="lazy">
      <span class="co-line-name">${esc(p.name)}<small>${qty} × ${money(p.price)}</small></span>
      <strong>${money(p.price * qty)}</strong>
    </li>`).join('');
  $('[data-co-subtotal]').textContent = money(sub);

  const opt = quote?.options.find((o) => o.id === selected);
  // Free shipping shows GRÁTIS; above the subsidy only the part the customer pays is shown.
  const shipEl = $('[data-co-ship]');
  $('[data-co-ship-label]').textContent = opt ? `Frete (${opt.name})` : 'Frete';
  shipEl.textContent = opt ? (opt.price > 0 ? money(opt.price) : 'Grátis') : 'Informe o CEP';
  shipEl.classList.toggle('co-ship-free', !!opt && opt.price === 0);
  shipEl.classList.toggle('muted', !opt);
  const total = sub + (opt ? opt.price : 0);
  $('[data-co-total]').textContent = money(total);
  // InfinitePay applies the Pix discount to the whole payment, shipping included.
  const pixPct = CONFIG.PIX_DISCOUNT_PERCENT;
  $('[data-co-pix-row]').hidden = !(pixPct > 0);
  if (pixPct > 0) {
    $('[data-co-pix-label]').textContent = `No Pix (${pixPct}% de desconto)`;
    $('[data-co-pix]').textContent = money(Math.round(total * (100 - pixPct)) / 100);
  }

  const n = interestFree(sub);
  const next = CONFIG.INTEREST_FREE_TIERS.find((t) => sub < t.min);
  $('[data-co-inst]').innerHTML = (n > 1
    ? `Parcele em até <b>${n}x sem juros</b> no cartão, ou em até ${CONFIG.MAX_INSTALLMENTS}x com juros.`
    : `Cartão em até ${CONFIG.MAX_INSTALLMENTS}x com juros, ou Pix à vista.`)
    + (next ? ` <span class="muted">A partir de ${money(next.min)} em produtos: ${next.n}x sem juros.</span>` : '')
    + ' <span class="muted">O frete não conta para as parcelas sem juros.</span>'
    + (CONFIG.PIX_DISCOUNT_PERCENT > 0 ? `<br>No Pix, ${CONFIG.PIX_DISCOUNT_PERCENT}% de desconto sobre o total, aplicado na página de pagamento.` : '');
}

/* -------------------------------------------------------------- shipping */

const shipBox = $('[data-ship-options]');

const range = (o) => {
  const lo = o.days_min + o.dispatch_days;
  const hi = o.days_max + o.dispatch_days;
  return lo === hi ? `${hi}` : `${lo} a ${hi}`;
};

function renderOptions() {
  if (!quote) return;
  if (!quote.options.length) {
    shipBox.innerHTML = `<p class="co-error">Nenhuma transportadora atende este CEP. Fale com a gente no WhatsApp ${esc(CONFIG.CONTACT.whatsapp)}.</p>`;
    return;
  }
  if (!quote.options.some((o) => o.id === selected)) selected = quote.options[0].id;
  const sub = quote.subtotal;
  shipBox.innerHTML = `<div class="co-ship" role="radiogroup" aria-label="Opções de frete">${quote.options.map((o) => `
    <label class="co-ship-opt">
      <input type="radio" name="service" value="${o.id}"${o.id === selected ? ' checked' : ''}>
      <span class="co-ship-name"><b>${esc(o.name)}</b><small>até ${range(o)} dias úteis</small></span>
      <strong${o.free ? ' class="ship-free"' : ''}>${o.price < o.original_price ? `<s>${money(o.original_price)}</s> ` : ''}${o.free ? 'Grátis' : money(o.price)}</strong>
    </label>`).join('')}</div>
    <p class="ship-note">${sub >= quote.free_min
      ? `Frete grátis de até ${money(quote.free_subsidy)}: se a opção custar mais, você paga só a diferença.`
      : `Faltam ${money(quote.free_min - sub)} em produtos para ganhar frete grátis de até ${money(quote.free_subsidy)}.`}
    O prazo conta a partir da confirmação do pagamento.</p>`;
}

shipBox.addEventListener('change', (e) => {
  if (e.target.name !== 'service') return;
  selected = Number(e.target.value);
  renderSummary();
});

let quoteSeq = 0;
async function loadQuote() {
  const cep = digits(form.cep.value);
  if (cep.length !== 8 || !cart.items.length) return;
  const key = cartKey();
  if (key === quotedFor && quote) return;
  const seq = ++quoteSeq;
  shipBox.innerHTML = '<p class="muted">Calculando frete...</p>';
  try {
    const res = await fetch(CONFIG.SHIPPING_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cep, items: itemsBody() }),
    });
    const data = await res.json();
    if (seq !== quoteSeq) return;
    if (!res.ok) {
      quote = null; quotedFor = '';
      shipBox.innerHTML = `<p class="co-error">${data.error === 'cep'
        ? 'CEP não encontrado. Confira os números.'
        : `Não conseguimos calcular o frete agora. Tente de novo em instantes ou fale com a gente no WhatsApp ${esc(CONFIG.CONTACT.whatsapp)}.`}</p>`;
    } else {
      quote = data; quotedFor = key;
      renderOptions();
    }
  } catch {
    if (seq !== quoteSeq) return;
    quote = null; quotedFor = '';
    shipBox.innerHTML = '<p class="co-error">Sem conexão para calcular o frete. Tente de novo.</p>';
  }
  renderSummary();
}

/* ------------------------------------------------------------ CEP lookup */

const cepHint = $('[data-cep-hint]');
let lastCep = '';
form.cep.addEventListener('input', async () => {
  const cep = digits(form.cep.value);
  if (cep.length !== 8) { cepHint.textContent = ''; return; }
  if (cep === lastCep) return;
  lastCep = cep;
  loadQuote();
  cepHint.textContent = 'Buscando endereço...';
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const a = await res.json();
    if (cep !== digits(form.cep.value)) return;
    if (a.erro) { cepHint.textContent = 'CEP não encontrado. Preencha o endereço.'; return; }
    const fill = (name, v) => { if (v && !form[name].value.trim()) form[name].value = v; };
    fill('street', a.logradouro);
    fill('neighborhood', a.bairro);
    fill('city', a.localidade);
    fill('state', a.uf);
    cepHint.textContent = [a.localidade, a.uf].filter(Boolean).join(' / ');
    (form.street.value ? form.number : form.street).focus();
  } catch {
    cepHint.textContent = '';
  }
});

/* ---------------------------------------------------------------- submit */

const errBox = $('[data-co-error]');
const submitBtn = $('[data-co-submit]');
const FIELD_NAMES = {
  name: 'nome completo', email: 'e-mail', phone: 'celular com DDD', cpf: 'CPF', cep: 'CEP',
  street: 'rua', number: 'número', neighborhood: 'bairro', city: 'cidade', state: 'UF',
};

function markInvalid(names) {
  $$('.field.invalid', form).forEach((f) => f.classList.remove('invalid'));
  names.forEach((n) => form[n]?.closest('.field')?.classList.add('invalid'));
  form[names[0]]?.focus();
  errBox.textContent = `Confira: ${names.map((n) => FIELD_NAMES[n] || n).join(', ')}.`;
}

// CPF with valid check digits (the carriers and the invoice reject anything else).
function validCpf(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(d[n])) return false;
  }
  return true;
}

function localCheck() {
  const bad = [];
  if (form.name.value.trim().split(/\s+/).length < 2) bad.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) bad.push('email');
  if (!/^\d{10,11}$/.test(digits(form.phone.value))) bad.push('phone');
  if (!validCpf(digits(form.cpf.value))) bad.push('cpf');
  if (digits(form.cep.value).length !== 8) bad.push('cep');
  for (const k of ['street', 'number', 'neighborhood', 'city']) if (!form[k].value.trim()) bad.push(k);
  if (!/^[A-Z]{2}$/.test(form.state.value)) bad.push('state');
  return bad;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox.textContent = '';
  const bad = localCheck();
  if (bad.length) { markInvalid(bad); return; }
  $$('.field.invalid', form).forEach((f) => f.classList.remove('invalid'));
  if (!quote || quotedFor !== cartKey() || !selected) {
    await loadQuote();
    if (!quote || !selected) { errBox.textContent = 'Escolha uma opção de frete.'; return; }
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Gerando pagamento...';
  try {
    const res = await fetch(CONFIG.CHECKOUT_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: itemsBody(),
        cep: digits(form.cep.value),
        service_id: selected,
        ref: getRef()?.code,
        customer: {
          name: form.name.value, email: form.email.value, phone: digits(form.phone.value), cpf: digits(form.cpf.value),
        },
        address: {
          street: form.street.value, number: form.number.value, complement: form.complement.value,
          neighborhood: form.neighborhood.value, city: form.city.value, state: form.state.value,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      try { sessionStorage.setItem('rc_last_order', data.code); } catch { /* private mode */ }
      location.href = data.url;
      return;
    }
    if (data.error === 'fields') markInvalid(data.fields || []);
    else if (data.error === 'shipping') {
      quote = { ...(quote || {}), options: data.options || [] };
      renderOptions();
      renderSummary();
      errBox.textContent = 'O valor do frete mudou. Confira a opção e tente de novo.';
    } else if (data.error === 'cep') markInvalid(['cep']);
    else if (data.error === 'product' || data.error === 'items') {
      errBox.textContent = 'Algum item do carrinho não está mais disponível. Revise o carrinho.';
    } else {
      errBox.textContent = `Não conseguimos gerar o pagamento agora. Tente de novo ou fale com a gente no WhatsApp ${CONFIG.CONTACT.whatsapp}.`;
    }
  } catch {
    errBox.textContent = 'Sem conexão. Tente de novo.';
  }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Ir para o pagamento';
});

/* ------------------------------------------------------------------ boot */

function render() {
  const empty = !lines().length;
  $('[data-co-empty]').hidden = !empty;
  form.hidden = empty;
  if (empty) return;
  renderSummary();
  if (quotedFor && quotedFor !== cartKey()) { quote = null; loadQuote(); }
}

boot().then(({ products }) => {
  byId = new Map(products.map((p) => [p.id, p]));
  render();
  cart.on(render);
  prefillFromAccount();
});

// A signed-in customer gets name and e-mail filled in (empty fields only). The Supabase client
// is loaded only when a stored session exists, so guests never download it.
function prefillFromAccount() {
  let stored = false;
  try { stored = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)); } catch { /* private mode */ }
  if (!stored) return;
  import('./auth.js').then(({ currentUser }) => currentUser()).then((user) => {
    if (!user) return;
    if (!form.name.value.trim() && user.user_metadata?.name) form.name.value = user.user_metadata.name;
    if (!form.email.value.trim() && user.email) form.email.value = user.email;
  }).catch(() => {});
}
