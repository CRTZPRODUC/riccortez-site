// Home page: rotating hero (with the Black November slide), categories, showcase tabs, Gold Extreme Bass band,
// buyer reviews and FAQ accordion.
import { boot, productCard, reviewCard, stars, REVIEW_SOURCES, reveal, pricing, installmentText, money, esc, icon, $, $$ } from './app.js';
import { CONFIG } from './config.js';
import { getProduct, getReviews } from './data.js';

// Representative product photo per category (by id); falls back to the first in-stock item.
const CAT_COVER = { captadores: 1518, interfaces: 1919, acessorios: 1957 };

const TABS = {
  captadores: { filter: (p) => p.cat === 'captadores', more: 'loja.html?cat=captadores' },
  interfaces: { filter: (p) => p.cat === 'interfaces', more: 'loja.html?cat=interfaces' },
  novidades: { filter: (p) => p.isNew, more: 'loja.html?sort=new' },
  ofertas: { filter: (p) => Number(p.regular) > Number(p.price), more: 'loja.html?ofertas=1' },
};

/* -------------------------------------------------------- black november */

const BN_TICKER = ['Black November Gold Pro', 'Ofertas em todo o site', 'Novembro inteiro', 'Até 30 de novembro'];

// Black November Gold Pro: the first hero slide plus the gold ticker under the hero. Both are
// removed once CONFIG.BLACK_NOVEMBER.end has passed. Runs before initHero so the slide count
// is right. Prices come from the catalog, so nothing here shows a price or a percentage.
function initBlackNovember() {
  const slide = $('[data-bn]');
  const ticker = $('[data-bn-ticker]');
  const cfg = CONFIG.BLACK_NOVEMBER;
  const end = cfg ? new Date(cfg.end).getTime() : 0;
  if (!(end > Date.now())) {
    if (slide) slide.remove();
    if (ticker) ticker.remove();
    return;
  }

  if (slide) {
    const units = Object.fromEntries($$('[data-bn-unit]', slide).map((el) => [el.dataset.bnUnit, el]));
    const pad = (n) => String(n).padStart(2, '0');
    let timer;
    const tick = () => {
      const s = Math.floor(Math.max(0, end - Date.now()) / 1000);
      units.d.textContent = pad(Math.floor(s / 86400));
      units.h.textContent = pad(Math.floor(s / 3600) % 24);
      units.m.textContent = pad(Math.floor(s / 60) % 60);
      units.s.textContent = pad(s % 60);
      if (!s) clearInterval(timer);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  if (ticker) {
    // Repeat the phrases until one half of the track is wider than the widest screen, then
    // double it, so the -50% loop never runs out of text. Speed stays near 50 px/s.
    const track = $('[data-bn-track]', ticker);
    const group = BN_TICKER.map((t) => `<span>${esc(t)}</span>`).join('');
    track.innerHTML = group;
    ticker.hidden = false;
    const reps = Math.ceil(Math.max(window.innerWidth, window.screen.width) / track.scrollWidth) + 1;
    track.innerHTML = group.repeat(reps * 2);
    track.style.animationDuration = `${Math.round(track.scrollWidth / 2 / 50)}s`;
  }
}

/* ------------------------------------------------------------------ hero */

// Hero slides. The Black November slide and the first entry here (Gold Extreme Bass, the
// flagship line) live in index.html so the h1 and the LCP image never wait for JavaScript.
// The others are built from the catalog and are
// skipped when the product is missing or out of stock. Float labels only restate facts from each
// product's name/description; '{off}' becomes the real discount and is dropped when not on sale.
// `bg` names the backdrop photo in assets/img (<bg>-800.webp and <bg>-1600.webp).
const HERO_SLIDES = [
  { slug: 'gold-extreme-bass-duplo', bg: 'hero-captadores' },
  {
    slug: 'rt7-rastilho-gold-pro-p-violao-7-cordas-externo-p2', // newest launch (isNew)
    bg: 'hero-violao',
    eyebrow: 'Novo · Rastilho Gold Pro RT7',
    title: 'Rastilho para<br>o seu <em>7 cordas</em>.',
    cta: 'Conhecer o RT7 Externo',
    more: 'Ver todos os captadores',
    floats: [['guitar', 'Violão 7 cordas'], ['shield', '100% blindado'], ['cable', 'Cabo P2-P10 de 4 m']],
  },
  {
    slug: 'is7-extreme-active-interface-de-audio', // interfaces, biggest discount
    bg: 'hero-interfaces',
    eyebrow: 'Interfaces de áudio',
    title: 'Grave e faça<br><em>lives</em> pelo<br>celular.',
    cta: 'Conhecer a IS7 Extreme Active',
    more: 'Ver todas as interfaces',
    floats: [['interface', 'Interface ativa'], ['mic', 'Instrumento + microfone'], ['bolt', '{off}']],
  },
  {
    slug: 'kit-live-st2v-mesa-de-som', // kits, on sale
    bg: 'hero-microfones',
    eyebrow: 'Kits Gold Pro',
    title: 'Vários<br>instrumentos,<br>uma <em>live</em> só.',
    cta: 'Conhecer o Kit Live ST2/V',
    more: 'Ver todos os kits',
    floats: [['kit', 'Interface ST2/V'], ['interface', 'Mesa de som 4 canais'], ['bolt', '{off}']],
  },
];

const HERO_DELAY = 6000;

// Whole sentences of the description up to `max` characters (cut on a word if the first is longer).
function trimDesc(text, max = 170) {
  const sentences = String(text || '').match(/[^.!?]+[.!?]*/g) || [];
  let out = '';
  for (const part of sentences) {
    const next = (out + part).trim();
    if (next.length > max) break;
    out = `${next} `;
  }
  out = out.trim();
  return out || `${String(text).slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function heroSlideHTML(cfg, p, pos, total) {
  const pr = pricing(p);
  const url = `produto.html?p=${encodeURIComponent(p.slug)}`;
  const floats = cfg.floats
    .map(([ico, text]) => [ico, text === '{off}' ? (pr.onSale ? `-${pr.off}% no preço` : '') : text])
    .filter(([, text]) => text);
  const bg = cfg.bg && `assets/img/${cfg.bg}`;
  // Only the first slide carries the page h1; these are h2.
  return `
  <div class="hero-slide" role="group" aria-roledescription="slide" aria-label="${pos} de ${total}" data-slug="${esc(p.slug)}" aria-hidden="true" inert>
    ${bg ? `<div class="hero-bg" aria-hidden="true"><img data-src="${bg}-1600.webp" data-srcset="${bg}-800.webp 800w, ${bg}-1600.webp 1600w" sizes="100vw" alt="" width="1600" height="893" decoding="async"></div>` : ''}
    <div class="container hero-grid">
      <div class="hero-copy">
        <span class="hero-eyebrow"><span class="pulse" aria-hidden="true"></span>${esc(cfg.eyebrow)}</span>
        <h2 class="hero-title">${cfg.title}</h2>
        <p class="hero-sub">${esc(trimDesc(p.desc))}</p>
        <div class="hero-ctas">
          <a class="btn btn-primary btn-lg" href="${url}">${esc(cfg.cta)} ${icon('arrow', 18)}</a>
          <a class="btn btn-ghost btn-lg" href="loja.html?cat=${esc(p.cat)}">${esc(cfg.more)}</a>
        </div>
        <div class="hero-meta">
          <span>${icon('card', 16)} Pix ou até ${CONFIG.MAX_INSTALLMENTS}x no cartão</span>
          <span>${icon('truck', 16)} Envio para todo o Brasil</span>
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-frame">
          <img data-src="${esc(p.img)}" alt="${esc(p.name)}" width="440" height="440" decoding="async">
        </div>
        ${floats.map(([ico, text], i) => `<span class="hero-float float-${i + 1}">${icon(ico, 16)} ${esc(text)}</span>`).join('\n        ')}
        <a class="hero-price" href="${url}" aria-label="${esc(p.name)} por ${money(pr.price)}">
          <small>${pr.onSale ? `De <s>${money(pr.regular)}</s> por` : 'Por apenas'}</small><strong>${money(pr.price)}</strong>
        </a>
      </div>
    </div>
  </div>`;
}

const PLAY_SVG = '<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg>';
const PAUSE_SVG = '<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';

function initHero(products) {
  const root = $('[data-hero]');
  const stage = $('[data-hero-slides]');
  const controls = $('[data-hero-controls]');
  if (!root || !stage || !controls) return;
  const extra = HERO_SLIDES.slice(1)
    .map((cfg) => ({ cfg, p: products.find((x) => x.slug === cfg.slug) }))
    .filter(({ p }) => p && p.stock);
  const fixed = $$('.hero-slide', stage).length; // slides already in index.html
  const total = extra.length + fixed;
  stage.insertAdjacentHTML('beforeend',
    extra.map(({ cfg, p }, i) => heroSlideHTML(cfg, p, i + fixed + 1, total)).join(''));
  const slides = $$('.hero-slide', stage);
  slides.slice(0, fixed).forEach((el, i) => el.setAttribute('aria-label', `${i + 1} de ${total}`));
  if (total < 2) { controls.remove(); return; }

  const names = slides.map((el) => el.dataset.name || (products.find((x) => x.slug === el.dataset.slug) || {}).name || '');
  const dots = $('[data-hero-dots]', controls);
  dots.innerHTML = slides.map((_, i) =>
    `<button class="hero-dot" type="button" data-hero-dot="${i}" aria-label="Destaque ${i + 1} de ${total}: ${esc(names[i])}"></button>`).join('');
  const toggle = $('[data-hero-toggle]', controls);
  const status = $('[data-hero-status]');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let timer = 0;
  let stopped = reduce.matches; // play/pause button state; reduced motion starts paused
  let hovering = false;
  let focused = false;

  // Later slides' images (backdrop and product) load only when their slide (or the one before it) is shown.
  const loadImg = (slide) => {
    if (!slide) return;
    $$('img[data-src]', slide).forEach((img) => {
      if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); }
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  };

  function schedule() {
    clearTimeout(timer);
    const playing = !(stopped || hovering || focused || document.hidden);
    root.dataset.playing = String(playing);
    if (playing) timer = setTimeout(() => go(index + 1), HERO_DELAY);
  }

  function go(i, announce = false) {
    index = (i + total) % total;
    slides.forEach((el, k) => {
      const on = k === index;
      el.classList.toggle('is-active', on);
      el.inert = !on;
      if (on) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
    });
    $$('[data-hero-dot]', dots).forEach((d, k) => {
      if (k === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
    loadImg(slides[index]);
    loadImg(slides[(index + 1) % total]);
    root.dataset.active = String(index);
    // Announce only changes the visitor asked for; automatic rotation stays silent.
    if (announce) status.textContent = `Destaque ${index + 1} de ${total}: ${names[index]}`;
    schedule();
  }

  function setStopped(value) {
    stopped = value;
    toggle.setAttribute('aria-label', value ? 'Retomar rotação dos destaques' : 'Pausar rotação dos destaques');
    toggle.setAttribute('aria-pressed', String(value));
    toggle.innerHTML = value ? PLAY_SVG : PAUSE_SVG;
    schedule();
  }

  controls.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-hero-prev]')) go(index - 1, true);
    else if (b.matches('[data-hero-next]')) go(index + 1, true);
    else if (b.matches('[data-hero-dot]')) go(Number(b.dataset.heroDot), true);
    else if (b.matches('[data-hero-toggle]')) setStopped(!stopped);
  });
  // Arrow keys anywhere in the control bar move between slides.
  controls.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1, true); }
  });
  root.addEventListener('mouseenter', () => { hovering = true; schedule(); });
  root.addEventListener('mouseleave', () => { hovering = false; schedule(); });
  root.addEventListener('focusin', () => { focused = true; schedule(); });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) { focused = false; schedule(); }
  });
  document.addEventListener('visibilitychange', schedule);
  if (reduce.addEventListener) reduce.addEventListener('change', () => { if (reduce.matches) setStopped(true); });

  controls.classList.add('is-ready');
  toggle.innerHTML = stopped ? PLAY_SVG : PAUSE_SVG;
  toggle.setAttribute('aria-pressed', String(stopped));
  if (stopped) toggle.setAttribute('aria-label', 'Retomar rotação dos destaques');
  go(0);
}

function renderCategories(cats, products) {
  $('[data-cats]').innerHTML = cats.map((c, i) => {
    const inCat = products.filter((p) => p.cat === c.slug);
    const cover = inCat.find((p) => p.id === CAT_COVER[c.slug]) || inCat.find((p) => p.stock) || inCat[0];
    return `
    <a class="cat-card fade-up" href="loja.html?cat=${c.slug}">
      <div class="cat-media">
        ${cover ? `<img src="${esc(cover.img)}" alt="" loading="lazy" width="300" height="300">` : ''}
        <span class="cat-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      </div>
      <div class="cat-body">
        <span class="cat-meta">${c.count} ${c.count === 1 ? 'produto' : 'produtos'}</span>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.blurb || '')}</p>
        <span class="cat-cta">Ver categoria ${icon('arrow', 15)}</span>
      </div>
    </a>`;
  }).join('');
}

function renderTab(key, products) {
  const tab = TABS[key];
  const list = products.filter(tab.filter).slice(0, 8);
  const panel = $('[data-vitrine]');
  panel.innerHTML = list.map(productCard).join('');
  $('[data-vitrine-more]').href = tab.more;
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === key)));
  reveal(panel);
}

function wireTabs(products) {
  const tabs = $$('[data-tab]');
  // Hide tabs that would be empty with the current catalog.
  tabs.forEach((b) => { b.hidden = !products.some(TABS[b.dataset.tab].filter); });
  $('[data-tabs]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) renderTab(b.dataset.tab, products);
  });
  // Arrow-key navigation between tabs.
  $('[data-tabs]').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const visible = tabs.filter((b) => !b.hidden);
    const i = visible.indexOf(document.activeElement);
    if (i < 0) return;
    const next = visible[(i + (e.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length];
    next.focus();
    renderTab(next.dataset.tab, products);
  });
  renderTab('captadores', products);
}

async function renderBand() {
  const items = (await Promise.all(['gold-extreme-bass-individual', 'gold-extreme-bass-duplo'].map(getProduct))).filter(Boolean);
  $('[data-band]').innerHTML = items.map((p) => {
    const pr = pricing(p);
    return `
    <a class="band-prod" href="produto.html?p=${encodeURIComponent(p.slug)}">
      <div class="media"><img src="${esc(p.img)}" alt="" loading="lazy" width="260" height="260"></div>
      <div><strong>${esc(p.name)}</strong><span>${money(pr.price)}</span><small>${installmentText(pr)}</small></div>
    </a>`;
  }).join('');
  const individual = items.find((p) => p.slug === 'gold-extreme-bass-individual');
  const badge = $('[data-hero-price]');
  if (individual && badge) {
    $('strong', badge).textContent = money(individual.price);
    badge.setAttribute('aria-label', `Gold Extreme Bass a partir de ${money(individual.price)}`);
    badge.hidden = false;
  }
}

// Two reviews per reviewed product, interleaved, plus the combined score of those listings.
async function renderReviews(products) {
  const section = $('[data-reviews-section]');
  let all;
  try { all = await getReviews(); } catch { return; }
  const entries = Object.entries(all)
    .map(([slug, r]) => ({ r, p: products.find((x) => x.slug === slug) }))
    .filter((e) => e.p);
  if (!section || !entries.length) return;
  const picks = [0, 1].flatMap((i) => entries.filter((e) => e.r.items[i]).map((e) => reviewCard(e.r.items[i], e.p)));
  const total = entries.reduce((n, e) => n + e.r.total, 0);
  const avg = entries.reduce((n, e) => n + e.r.average * e.r.total, 0) / total;
  const avgText = avg.toFixed(1).replace('.', ',');
  $('[data-reviews]', section).innerHTML = picks.join('');
  $('[data-reviews-summary]', section).innerHTML =
    `${stars(Math.round(avg * 2) / 2)} <strong>${avgText}</strong> de média em ${total.toLocaleString('pt-BR')} avaliações de ${REVIEW_SOURCES}`;
  section.hidden = false;
}

function wireFaq() {
  $('[data-faq]').addEventListener('click', (e) => {
    const q = e.target.closest('.faq-q');
    if (!q) return;
    q.setAttribute('aria-expanded', String(q.getAttribute('aria-expanded') !== 'true'));
  });
}

(async function init() {
  const { products, categories } = await boot({ active: 'home' });
  const free = money(CONFIG.FREE_SHIPPING_MIN);
  $('[data-free-ship]').textContent = `acima de ${free}`;
  $('[data-free-ship-faq]').textContent = free;
  wireFaq();
  if (products.length) {
    initBlackNovember();
    initHero(products);
    renderCategories(categories, products);
    wireTabs(products);
    await renderBand();
    await renderReviews(products);
  }
  reveal();
})();
