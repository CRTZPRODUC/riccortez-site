// Product page: gallery, sticky buy box, description, related items, SEO tags.
import { boot, productCard, reviewCard, stars, REVIEW_SOURCES, setNavActive, reveal, pricing, installmentText, freeShipText, money, esc, icon, $, $$ } from './app.js';
import { CONFIG } from './config.js';
import { getProduct, getProductReviews } from './data.js';

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    const [, key, name] = selector.match(/\[(\w+)="([^"]+)"\]/);
    el.setAttribute(key, name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function applySeo(p, cat) {
  const desc = (p.desc || p.name).slice(0, 155);
  const url = new URL(`produto.html?p=${encodeURIComponent(p.slug)}`, location.href).href;
  // Crawlers need absolute image URLs; catalog paths are relative to the site root.
  const abs = (src) => new URL(src, location.href).href;
  document.title = `${p.name} · Ric Cortez Pickups`;
  setMeta('meta[name="description"]', 'content', desc);
  setMeta('meta[property="og:title"]', 'content', p.name);
  setMeta('meta[property="og:description"]', 'content', desc);
  setMeta('meta[property="og:image"]', 'content', abs(p.img));
  setMeta('meta[property="og:url"]', 'content', url);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: String(p.id),
    image: [p.img, ...(p.imgs || [])].map(abs),
    description: p.desc || p.name,
    category: cat ? cat.name : p.cat,
    brand: { '@type': 'Brand', name: 'Ric Cortez' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BRL',
      price: Number(p.price).toFixed(2),
      availability: p.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(ld);
  document.head.appendChild(script);
}

function galleryHTML(p, pr) {
  const imgs = [p.img, ...(p.imgs || [])].filter((v, i, a) => v && a.indexOf(v) === i);
  const tags = [];
  if (p.isNew) tags.push('<span class="tag gold">Novo</span>');
  if (pr.onSale) tags.push(`<span class="tag red">-${pr.off}%</span>`);
  const thumbs = imgs.length > 1
    ? `<div class="thumbs" role="group" aria-label="Fotos do produto">${imgs.map((src, i) => `
        <button class="thumb" type="button" data-img="${esc(src)}" aria-label="Foto ${i + 1} de ${imgs.length}" aria-current="${i === 0}">
          <img src="${esc(src)}" alt="" loading="lazy" width="84" height="84">
        </button>`).join('')}</div>`
    : '';
  return `
    <div class="gallery${imgs.length > 1 ? '' : ' single'}">
      ${thumbs}
      <div class="main-img">
        <img src="${esc(imgs[0])}" alt="${esc(p.name)}" width="720" height="720" data-main-img>
        ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
      </div>
    </div>`;
}

function buyboxHTML(p, pr, cat) {
  const freeShip = money(CONFIG.FREE_SHIPPING_MIN);
  const madeToOrder = CONFIG.MADE_TO_ORDER.slugs.includes(p.slug);
  return `
    <div class="buybox">
      ${cat ? `<a class="pdp-cat" href="loja.html?cat=${cat.slug}">${esc(cat.name)}</a>` : ''}
      <h1 class="pdp-title">${esc(p.name)}</h1>
      <div class="pdp-sku">
        <span>Cód. ${p.id}</span>
        ${p.stock ? '<span class="stock-ok">Disponível</span>' : '<span class="stock-off">Indisponível no momento</span>'}
      </div>

      ${(p.slug.includes('jackcap') || CONFIG.WARRANTY_1Y_SLUGS.includes(p.slug)) ? `
      <div class="pdp-seal">
        <span class="pdp-seal-ico">${icon('shield', 24)}</span>
        <div><b>1 ano de garantia</b><span>Este modelo tem garantia de fábrica de 1 ano.</span></div>
      </div>` : ''}

      <div class="price-block">
        ${pr.onSale ? `<div class="price-top"><s class="was">${money(pr.regular)}</s><span class="pct">-${pr.off}%</span></div>` : ''}
        <strong class="now-big">${money(pr.price)}</strong>
        <p class="inst-line">${icon('card', 18)} <span>${pr.n > 1 ? `ou em até <b>${pr.n}x sem juros</b> de ${money(pr.inst)}` : `ou em até <b>${CONFIG.MAX_INSTALLMENTS}x no cartão</b>`}</span></p>
        ${pr.pix != null ? `<p class="pix-row">${icon('pix', 18)} ${money(pr.pix)} no Pix (${CONFIG.PIX_DISCOUNT_PERCENT}% de desconto)</p>` : ''}
      </div>

      ${p.stock ? (madeToOrder ? `
      <p class="pdp-notice">${icon('clock', 18)}<span><b>Feito sob demanda.</b> Produzimos este item sob encomenda para garantir o máximo de qualidade. O despacho é em até ${CONFIG.MADE_TO_ORDER.days} dias úteis.</span></p>` : `
      <p class="pdp-dispatch">${icon('truck', 16)} Despacho em até ${CONFIG.DISPATCH_BUSINESS_DAYS} dias úteis</p>`) : ''}

      ${p.stock ? `
      <div class="buy-row">
        <div class="qty" role="group" aria-label="Quantidade">
          <button type="button" data-step="-1" aria-label="Diminuir quantidade">${icon('minus', 18)}</button>
          <input type="number" inputmode="numeric" min="1" max="99" value="1" aria-label="Quantidade" data-qty-input>
          <button type="button" data-step="1" aria-label="Aumentar quantidade">${icon('plus', 18)}</button>
        </div>
        <button class="btn btn-primary" type="button" data-add="${p.id}" data-qty="1" data-main-add>${icon('bag', 19)} Adicionar ao carrinho</button>
      </div>
      <button class="btn btn-ghost btn-block" type="button" data-buy-now="${p.id}" data-qty="1">Comprar agora</button>`
      : `<button class="btn btn-primary btn-block btn-lg" type="button" disabled data-main-add>Indisponível</button>`}

      <form class="cep-check" data-cep>
        <label for="cep">${icon('truck', 18)} Calcular frete e prazo</label>
        <div class="cep-row">
          <input id="cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9">
          <button class="btn btn-ghost" type="submit">Calcular</button>
        </div>
        <p class="cep-msg" role="status" data-cep-msg></p>
      </form>

      <div class="trust-row">
        <div>${icon('card', 20)}<b>Até ${CONFIG.MAX_INSTALLMENTS}x</b>no cartão</div>
        <div>${icon('truck', 20)}<b>Frete grátis</b>acima de ${freeShip}</div>
        <div>${icon('refresh', 20)}<b>7 dias</b>para desistir</div>
      </div>
    </div>`;
}

function infoHTML(p, cat) {
  const paras = String(p.desc || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const c = CONFIG.CONTACT.whatsapp;
  return `
    <div class="pdp-info">
      <div class="pdp-desc">
        <h2>Descrição</h2>
        ${paras.length ? paras.map((t) => `<p>${esc(t)}</p>`).join('') : '<p>Descrição em breve.</p>'}
      </div>
      <aside class="info-side" aria-label="Detalhes do produto">
        <h3>Detalhes</h3>
        <dl class="spec-list">
          <div><dt>Categoria</dt><dd>${esc(cat ? cat.name : p.cat)}</dd></div>
          <div><dt>Código</dt><dd>${p.id}</dd></div>
          <div><dt>Disponibilidade</dt><dd>${p.stock ? 'Disponível' : 'Indisponível'}</dd></div>
          <div><dt>Pagamento</dt><dd>Pix ou até ${CONFIG.MAX_INSTALLMENTS}x</dd></div>
          <div><dt>Dúvidas</dt><dd>WhatsApp ${/^\[.*\]$/.test(c) ? `<span class="ph">${esc(c)}</span>` : esc(c)}</dd></div>
        </dl>
      </aside>
    </div>`;
}

// Real buyer reviews for this item, or for the pickup it is a variant of.
// `reviewed` is set when the reviews come from another listing of the same pickup.
function reviewsHTML(rv, reviewed) {
  if (!rv || !rv.items.length) return '';
  const avg = String(rv.average).replace('.', ',');
  return `
    <section class="pdp-reviews" aria-labelledby="reviews-title">
      <div class="section-head">
        <div><span class="eyebrow">Avaliações</span><h2 class="section-title" id="reviews-title">O que dizem os <em>compradores</em></h2></div>
        <div class="reviews-score">
          <strong>${avg}</strong>
          <div>${stars(rv.average)}<span>${rv.total.toLocaleString('pt-BR')} avaliações</span></div>
          <a class="link-arrow" href="${esc(rv.url)}" target="_blank" rel="noopener">Ver todas ${icon('arrow', 16)}</a>
        </div>
      </div>
      <p class="reviews-note">${reviewed ? `Avaliações do <a href="produto.html?p=${encodeURIComponent(reviewed.slug)}">${esc(reviewed.name)}</a>, o mesmo captador que vem neste produto, feitas por ${REVIEW_SOURCES}.` : `Avaliações de ${REVIEW_SOURCES}.`}</p>
      <div class="reviews-grid">${rv.items.map((r) => reviewCard(r)).join('')}</div>
    </section>`;
}

function notFound() {
  $('[data-pdp]').innerHTML = `
    <div class="not-found">
      <h1>Produto não encontrado</h1>
      <p>O link pode estar incompleto ou o produto saiu do catálogo.</p>
      <a class="btn btn-primary" href="loja.html">Ver todos os produtos</a>
    </div>`;
  document.title = 'Produto não encontrado · Ric Cortez Pickups';
}

(async function init() {
  const { products, categories } = await boot();
  const key = new URLSearchParams(location.search).get('p');
  const p = await getProduct(key).catch(() => null);
  if (!p) { notFound(); return; }
  // Reviews are optional: a failed load just hides the section.
  const reviews = await getProductReviews(p.slug).catch(() => null);
  const reviewed = reviews && reviews.of !== p.slug ? await getProduct(reviews.of) : null;

  const cat = categories.find((c) => c.slug === p.cat);
  // Highlight the product's category in the header, without aria-current (this page is the product).
  setNavActive(p.cat, { current: false });
  const pr = pricing(p);
  applySeo(p, cat);

  const sep = icon('chevronR', 14);
  const related = products.filter((x) => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  $('[data-pdp]').innerHTML = `
    <nav class="breadcrumb" aria-label="Você está em">
      <a href="index.html">Início</a>${sep}<a href="loja.html">Loja</a>${sep}
      ${cat ? `<a href="loja.html?cat=${cat.slug}">${esc(cat.name)}</a>${sep}` : ''}
      <span aria-current="page">${esc(p.name)}</span>
    </nav>
    <div class="pdp-grid">
      ${galleryHTML(p, pr)}
      ${buyboxHTML(p, pr, cat)}
    </div>
    ${infoHTML(p, cat)}
    ${reviewsHTML(reviews, reviewed)}
    ${related.length ? `
    <section class="related" aria-labelledby="related-title">
      <div class="section-head">
        <div><span class="eyebrow">Mesma categoria</span><h2 class="section-title" id="related-title">Você também pode <em>gostar</em></h2></div>
        ${cat ? `<a class="link-arrow" href="loja.html?cat=${cat.slug}">Ver ${esc(cat.name.toLowerCase())} ${icon('arrow', 16)}</a>` : ''}
      </div>
      <div class="products-grid">${related.map(productCard).join('')}</div>
    </section>` : ''}`;

  // Gallery thumbs.
  const main = $('[data-main-img]');
  $$('.thumb').forEach((b) => b.addEventListener('click', () => {
    main.src = b.dataset.img;
    $$('.thumb').forEach((t) => t.setAttribute('aria-current', String(t === b)));
  }));

  // Quantity stepper keeps every add/buy button in sync.
  const qtyInput = $('[data-qty-input]');
  const syncQty = () => {
    const v = Math.max(1, Math.min(99, Math.floor(Number(qtyInput.value) || 1)));
    qtyInput.value = v;
    $$('[data-add][data-qty], [data-buy-now]').forEach((b) => { if (b.dataset.add == p.id || b.dataset.buyNow == p.id) b.dataset.qty = v; });
  };
  if (qtyInput) {
    $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
      qtyInput.value = Number(qtyInput.value || 1) + Number(b.dataset.step);
      syncQty();
    }));
    qtyInput.addEventListener('change', syncQty);
  }

  // CEP: live quote from the `frete` function (SuperFrete) for this product and quantity.
  const cepInput = $('#cep');
  const cepMsg = $('[data-cep-msg]');
  const freeNote = `Compras acima de ${money(CONFIG.FREE_SHIPPING_MIN)} têm ${freeShipText()}: se o frete passar disso, você paga só a diferença.`;
  cepInput.addEventListener('input', () => {
    const d = cepInput.value.replace(/\D/g, '').slice(0, 8);
    cepInput.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  });
  $('[data-cep]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8) { cepMsg.textContent = 'Digite um CEP com 8 números.'; return; }
    if (!CONFIG.SHIPPING_API_URL || !p.stock) { cepMsg.textContent = freeNote; return; }
    cepMsg.textContent = 'Calculando…';
    const qty = Math.max(1, Math.floor(Number(qtyInput?.value) || 1));
    try {
      const res = await fetch(CONFIG.SHIPPING_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cep, items: [{ id: p.id, qty }] }),
      });
      const data = await res.json();
      if (!res.ok) {
        cepMsg.textContent = data.error === 'cep'
          ? 'CEP não encontrado. Confira os números.'
          : `Não conseguimos calcular agora. ${freeNote} Fale com a gente no WhatsApp ${CONFIG.CONTACT.whatsapp}.`;
        return;
      }
      if (!data.options.length) { cepMsg.textContent = 'Nenhuma transportadora atende este CEP.'; return; }
      // Delivery estimate = dispatch time + carrier time.
      const range = (o) => {
        const lo = o.days_min + o.dispatch_days;
        const hi = o.days_max + o.dispatch_days;
        return lo === hi ? `${hi}` : `${lo} a ${hi}`;
      };
      cepMsg.innerHTML = `<ul class="ship-quotes">${data.options.map((o) => `
        <li><span><b>${esc(o.name)}</b> · até ${range(o)} dias úteis</span>
        <strong${o.free ? ' class="ship-free"' : ''}>${o.price < o.original_price ? `<s>${money(o.original_price)}</s> ` : ''}${o.free ? 'Grátis' : money(o.price)}</strong></li>`).join('')}</ul>
        <span class="ship-note">O prazo inclui o despacho de até ${data.options[0].dispatch_days} dias úteis e conta a partir da confirmação do pagamento.${data.subtotal < data.free_min ? ` ${freeNote}` : ` O frete grátis cobre até ${money(data.free_subsidy)} e você paga só o que passar disso.`}</span>`;
    } catch {
      cepMsg.textContent = `Não conseguimos calcular agora. ${freeNote}`;
    }
  });

  // Mobile sticky bar appears once the main buy button scrolls out of view.
  const bar = $('[data-sticky-buy]');
  bar.innerHTML = `
    <div class="sb-price"><strong>${money(pr.price)}</strong><span>${installmentText(pr)}</span></div>
    ${p.stock
      ? `<button class="btn btn-primary" type="button" data-add="${p.id}" data-qty="1">${icon('bag', 18)} Adicionar</button>`
      : '<button class="btn btn-primary" type="button" disabled>Indisponível</button>'}`;
  document.body.classList.add('has-sticky-buy');
  const target = $('[data-main-add]');
  if (target) {
    let shown = false;
    const check = () => {
      const show = target.getBoundingClientRect().bottom < 0;
      if (show === shown) return;
      shown = show;
      bar.classList.toggle('show', show);
      bar.inert = !show;
      bar.setAttribute('aria-hidden', String(!show));
    };
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check, { passive: true });
    check();
  }

  reveal();
})();
