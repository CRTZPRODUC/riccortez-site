// Shared runtime for every page: header, mobile nav, footer, cart drawer,
// referral capture, theme toggle, reveal-on-scroll and small helpers.
import { CONFIG } from './config.js';
import { getProducts, getCategories } from './data.js';

/* ------------------------------------------------------------------ helpers */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (n) => BRL.format(Number(n) || 0);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// localStorage can throw (private mode, blocked storage), so every access is guarded.
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

/* -------------------------------------------------------------------- icons */

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bag: '<path d="M5 7h14l-1.2 13.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chevronR: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  pix: '<path d="m12 3 3.5 3.5L12 10 8.5 6.5 12 3ZM12 14l3.5 3.5L12 21l-3.5-3.5L12 14ZM3 12l3.5-3.5L10 12l-3.5 3.5L3 12ZM14 12l3.5-3.5L21 12l-3.5 3.5L14 12Z"/>',
  whats: '<path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
  guitar: '<circle cx="9" cy="15" r="5"/><circle cx="9" cy="15" r="1.4"/><path d="m12.5 11.5 7-7M17.5 2.5l4 4"/>',
  interface: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  kit: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V5h8v3M3 13h18"/>',
  cable: '<path d="M7 3v4M17 3v4M5 7h4v4a2 2 0 0 1-4 0V7ZM15 7h4v4a2 2 0 0 1-4 0V7ZM7 13v2a5 5 0 0 0 10 0v-2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  support: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1"/><rect x="17" y="14" width="4" height="6" rx="1"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

export function icon(name, size = 20) {
  const body = P[name] || P.info;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ------------------------------------------------------------------ pricing */

export function pricing(p) {
  const price = Number(p.price) || 0;
  const regular = Number(p.regular) || price;
  const onSale = regular > price;
  const off = onSale ? Math.round((1 - price / regular) * 100) : 0;
  const n = interestFree(price);
  const pix = CONFIG.PIX_DISCOUNT_PERCENT > 0 ? price * (1 - CONFIG.PIX_DISCOUNT_PERCENT / 100) : null;
  return { price, regular, onSale, off, n, inst: n > 1 ? price / n : price, pix };
}

// Interest-free installments for a product subtotal (shipping does not count). 0 below the
// first tier: the card still takes up to MAX_INSTALLMENTS, with the interest paid by the customer.
export const interestFree = (subtotal) =>
  [...CONFIG.INTEREST_FREE_TIERS].reverse().find((t) => subtotal >= t.min)?.n ?? 0;

export const installmentText = (pr) =>
  pr.n > 1 ? `em até ${pr.n}x sem juros` : `em até ${CONFIG.MAX_INSTALLMENTS}x no cartão`;

// Free-shipping wording with the subsidy cap, e.g. "frete grátis de até R$ 35,00".
export const freeShipText = () => `frete grátis de até ${money(CONFIG.FREE_SHIPPING_SUBSIDY)}`;

/* --------------------------------------------------------------------- cart */

const CART_KEY = 'rc_cart';
const listeners = new Set();

function readCart() {
  const raw = store.get(CART_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i) => ({ id: Number(i.id), qty: Math.max(1, Math.min(99, Math.floor(Number(i.qty) || 1))) }))
    .filter((i) => Number.isFinite(i.id));
}

export const cart = {
  items: readCart(),
  save() {
    store.set(CART_KEY, this.items);
    listeners.forEach((fn) => fn(this.items));
  },
  add(id, qty = 1) {
    id = Number(id);
    const line = this.items.find((i) => i.id === id);
    if (line) line.qty = Math.min(99, line.qty + qty);
    else this.items.push({ id, qty: Math.min(99, qty) });
    this.save();
  },
  setQty(id, qty) {
    id = Number(id);
    if (qty <= 0) this.items = this.items.filter((i) => i.id !== id);
    else {
      const line = this.items.find((i) => i.id === id);
      if (line) line.qty = Math.min(99, qty);
    }
    this.save();
  },
  remove(id) { this.setQty(id, 0); },
  count() { return this.items.reduce((s, i) => s + i.qty, 0); },
  on(fn) { listeners.add(fn); },
};

// Keep several open tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== CART_KEY) return;
  cart.items = readCart();
  listeners.forEach((fn) => fn(cart.items));
});

/* ----------------------------------------------------------------- referral */

const REF_KEY = 'rc_ref';
const REF_RE = /^[A-Za-z0-9_-]{2,40}$/;

// Reads ?ref= or ?cupom=, keeps it for REF_DAYS, then removes it from the address bar.
function captureRefFromUrl() {
  const url = new URL(location.href);
  let found = false;
  for (const source of ['ref', 'cupom']) {
    const code = (url.searchParams.get(source) || '').trim();
    if (url.searchParams.has(source)) found = true;
    if (code && REF_RE.test(code)) {
      store.set(REF_KEY, {
        code: code.toUpperCase(),
        source,
        exp: Date.now() + CONFIG.REF_DAYS * 864e5,
      });
    }
    url.searchParams.delete(source);
  }
  if (found) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

export function getRef() {
  const ref = store.get(REF_KEY);
  if (!ref || !ref.code || !ref.exp) return null;
  if (Date.now() > ref.exp) { store.del(REF_KEY); return null; }
  return ref;
}

/* -------------------------------------------------------------- page chrome */

// The main nav is the catalog itself. The desktop bar shows the best-selling categories,
// a highlighted "Ofertas" link and a "Ver tudo" dropdown with every category plus quick
// links to the help pages. The mobile drawer lists every category. The logo links home.
// Seed list so the header renders at once; it is rebuilt from getCategories() on load.
const NAV_SEED = [
  { slug: 'captadores', name: 'Captadores', icon: 'guitar' },
  { slug: 'interfaces', name: 'Interfaces', icon: 'interface' },
  { slug: 'microfones', name: 'Microfones', icon: 'mic' },
  { slug: 'kits', name: 'Kits Gold Pro', icon: 'kit' },
  { slug: 'acessorios', name: 'Acessórios', icon: 'cable' },
];

// Keyword-rich link titles (SEO and hover hint). Unknown categories fall back to a generic title.
const NAV_TITLES = {
  captadores: 'Captadores para violão, instrumentos de corda e percussão',
  interfaces: 'Interfaces de áudio para gravar e fazer lives no celular',
  microfones: 'Microfones condensador e de lapela para voz, lives e vídeos',
  kits: 'Kits Gold Pro: interface e microfone para lives e gravações',
  acessorios: 'Acessórios de áudio: cabos, adaptadores, mesas de som e suportes',
  ofertas: 'Ofertas Ric Cortez: captadores, interfaces e microfones com desconto',
  loja: 'Ver todos os produtos da loja Ric Cortez',
};

// Categories that get their own slot in the desktop bar; the rest live in "Ver tudo".
const NAV_PRIMARY = ['captadores', 'interfaces', 'microfones'];

// Help and institutional pages, shown under the divider of the "Ver tudo" dropdown,
// in the mobile drawer and in the footer.
const QUICK_LINKS = [
  { href: 'conta.html', label: 'Minha conta', icon: 'user' },
  { href: 'contato.html', label: 'Contato e atendimento', icon: 'support' },
  { href: 'perguntas-frequentes.html', label: 'Perguntas frequentes', icon: 'info' },
  { href: 'frete-e-entrega.html', label: 'Frete e entrega', icon: 'truck' },
  { href: 'trocas-e-devolucoes.html', label: 'Trocas e devoluções', icon: 'refresh' },
  { href: 'sobre.html', label: 'Sobre a Ric Cortez', icon: 'guitar' },
];

function navItems(cats) {
  return [
    ...cats.map((c) => ({
      key: c.slug, label: c.name, icon: c.icon, count: c.count,
      href: `loja.html?cat=${c.slug}`, title: NAV_TITLES[c.slug] || `${c.name} Ric Cortez`,
    })),
    { key: 'ofertas', label: 'Ofertas', icon: 'bolt', href: 'loja.html?ofertas=1', title: NAV_TITLES.ofertas, cls: 'nav-offers' },
    { key: 'loja', label: 'Ver tudo', href: 'loja.html', title: NAV_TITLES.loja, cls: 'nav-all' },
  ];
}

let navActive = { key: '', current: true };

const activeAttrs = (n, extra = '') => {
  const on = n.key === navActive.key;
  const cls = [n.cls, extra, on ? 'active' : ''].filter(Boolean).join(' ');
  return `${cls ? ` class="${cls}"` : ''}${on && navActive.current ? ' aria-current="page"' : ''}`;
};

function navLinksHTML(cats) {
  const items = navItems(cats);
  const link = (n) => `<a href="${n.href}" title="${esc(n.title)}" data-key="${n.key}"${activeAttrs(n)}>${esc(n.label)}</a>`;
  const primary = items.filter((n) => NAV_PRIMARY.includes(n.key) || n.key === 'ofertas');
  const all = items.find((n) => n.key === 'loja');
  const catLinks = items.filter((n) => n.key !== 'ofertas' && n.key !== 'loja');
  // "Ver tudo" stays a real link to the full catalog; the panel opens on hover and on
  // keyboard focus (:focus-within), and the chevron button toggles it on touch screens.
  return `${primary.map(link).join('')}
    <div class="nav-more" data-nav-more>
      <a href="${all.href}" title="${esc(all.title)}" data-key="${all.key}"${activeAttrs(all)}>${esc(all.label)}</a>
      <button class="nav-more-btn" type="button" data-nav-more-btn aria-expanded="false" aria-controls="nav-more-panel" aria-label="Abrir todas as categorias e links rápidos">${icon('chevron', 16)}</button>
      <div class="nav-more-panel" id="nav-more-panel">
        <p class="nav-more-h">Categorias</p>
        <ul class="nav-more-list">
          ${catLinks.map((n) => `<li><a href="${n.href}" title="${esc(n.title)}" data-key="${n.key}"${activeAttrs(n)}>${n.icon ? icon(n.icon, 18) : ''}<span>${esc(n.label)}</span>${n.count != null ? `<small>${n.count}</small>` : ''}</a></li>`).join('')}
          <li><a href="${all.href}" class="nav-more-all">${icon('arrow', 18)}<span>Todos os produtos</span></a></li>
        </ul>
        <hr class="nav-more-sep">
        <p class="nav-more-h">Acesso rápido</p>
        <ul class="nav-more-list nav-more-quick">
          ${QUICK_LINKS.map((q) => `<li><a href="${q.href}">${icon(q.icon, 17)}<span>${esc(q.label)}</span></a></li>`).join('')}
        </ul>
      </div>
    </div>`;
}

function mobileLinksHTML(cats) {
  return navItems(cats).map((n) => `<a href="${n.href}" title="${esc(n.title)}" data-key="${n.key}"${activeAttrs(n)}>
    ${n.icon ? icon(n.icon, 18) : ''}<span>${esc(n.label)}</span>${n.count != null ? `<span class="muted">${n.count}</span>` : ''}${icon('chevronR', 18)}</a>`).join('');
}

/**
 * Highlights a nav item after boot (shop filters change, product page knows its category).
 * @param {string} key  category slug, "ofertas" or "loja"
 * @param {{current?: boolean}} opts  current=false marks it without aria-current (e.g. on a product page)
 */
export function setNavActive(key, { current = true } = {}) {
  navActive = { key, current };
  $$('.nav-links a[data-key], .mnav-links a').forEach((a) => {
    const on = a.dataset.key === key;
    a.classList.toggle('active', on);
    if (on && current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function renderNav(cats) {
  const nav = $('.nav-links');
  const mnav = $('.mnav-links');
  if (nav) nav.innerHTML = navLinksHTML(cats);
  if (mnav) mnav.innerHTML = mobileLinksHTML(cats);
}

const ph = (text) => `<span class="ph" title="Preencher antes de publicar">${esc(text)}</span>`;
const isPh = (v) => !v || /^\[.*\]$/.test(v);

function wordmarkHTML() {
  return '<span class="ric">Ric Cortez</span><span class="pickups">Pickups</span>';
}

function brandHTML() {
  if (!CONFIG.LOGO_URL) return `<a class="brand" href="index.html" aria-label="Ric Cortez, página inicial">${wordmarkHTML()}</a>`;
  // width/height carry the real aspect ratio so the logo reserves its space before it loads.
  return `<a class="brand" href="index.html" title="Ric Cortez · página inicial">
    <img class="brand-logo" src="${esc(CONFIG.LOGO_URL)}" alt="Ric Cortez" width="${CONFIG.LOGO_WIDTH}" height="${CONFIG.LOGO_HEIGHT}" decoding="async">${CONFIG.LOGO_LIGHT_URL ? `
    <img class="brand-logo brand-logo-light" src="${esc(CONFIG.LOGO_LIGHT_URL)}" alt="" aria-hidden="true" width="${CONFIG.LOGO_WIDTH}" height="${CONFIG.LOGO_HEIGHT}" decoding="async">` : ''}
  </a>`;
}

// If the hotlinked logo fails to load, show the text wordmark instead of a broken image.
function guardLogos(root = document) {
  $$('.brand-logo', root).forEach((img) => {
    const fallback = () => {
      const a = img.closest('.brand');
      if (!a) return;
      a.setAttribute('aria-label', 'Ric Cortez, página inicial');
      a.innerHTML = wordmarkHTML();
    };
    if (img.complete && img.naturalWidth === 0 && img.src) fallback();
    else img.addEventListener('error', fallback, { once: true });
  });
}

function headerHTML() {
  return `
  <a class="skip-link" href="#main">Pular para o conteúdo</a>
  <div class="topbar"><div class="container topbar-inner">
    <span>${icon('truck', 15)} Frete grátis acima de <b>${money(CONFIG.FREE_SHIPPING_MIN)}</b></span>
    <span class="topbar-sep" aria-hidden="true">·</span>
    <span class="topbar-2">${icon('card', 15)} Pix ou até <b>${CONFIG.MAX_INSTALLMENTS}x no cartão</b></span>
    <span class="topbar-sep topbar-sep-3" aria-hidden="true">·</span>
    <span class="topbar-3">${icon('refresh', 15)} <b>Devolução grátis</b></span>
    <span class="topbar-sep" aria-hidden="true">·</span>
    <a class="topbar-link" href="contato.html" title="Atendimento Ric Cortez: WhatsApp, telefone e e-mail">${icon('support', 15)} Contato</a>
  </div></div>
  <header class="site-header">
    <div class="container header-inner">
      <button class="icon-btn menu-btn" type="button" data-open-nav aria-label="Abrir menu" aria-controls="mobile-nav" aria-expanded="false">${icon('menu', 22)}</button>
      ${brandHTML()}
      <nav class="nav-links" aria-label="Categorias da loja">${navLinksHTML(NAV_SEED)}</nav>
      <form class="search-pill" action="loja.html" role="search">
        <label class="sr-only" for="hdr-q">Buscar produtos</label>
        <input id="hdr-q" name="q" type="search" placeholder="Buscar captador, interface..." autocomplete="off">
        <button type="submit" aria-label="Buscar">${icon('search', 18)}</button>
      </form>
      <div class="header-actions">
        <button class="icon-btn search-btn" type="button" data-open-nav data-focus-search aria-label="Buscar">${icon('search', 20)}</button>
        <a class="icon-btn" href="conta.html" aria-label="Minha conta"${navActive.key === 'conta' ? ' aria-current="page"' : ''}>${icon('user', 20)}</a>
        <button class="icon-btn cart-btn" type="button" data-open-cart aria-label="Abrir carrinho" aria-controls="cart-drawer">
          ${icon('bag', 21)}<span class="cart-count" data-cart-count hidden>0</span>
        </button>
      </div>
    </div>
  </header>`;
}

function mobileNavHTML() {
  return `
  <aside class="drawer drawer-left" id="mobile-nav" aria-label="Menu" aria-hidden="true" inert>
    <div class="drawer-head">
      ${brandHTML()}
      <button class="icon-btn" type="button" data-close aria-label="Fechar menu">${icon('x', 22)}</button>
    </div>
    <div class="drawer-body">
      <form class="search-pill search-block" action="loja.html" role="search">
        <label class="sr-only" for="nav-q">Buscar produtos</label>
        <input id="nav-q" name="q" type="search" placeholder="Buscar produtos" autocomplete="off">
        <button type="submit" aria-label="Buscar">${icon('search', 18)}</button>
      </form>
      <p class="eyebrow mnav-eyebrow">Categorias</p>
      <nav class="mnav-links" aria-label="Categorias da loja">${mobileLinksHTML(NAV_SEED)}</nav>
      <p class="eyebrow mnav-eyebrow">Acesso rápido</p>
      <div class="mnav-extra">
        ${QUICK_LINKS.filter((q) => q.href !== 'conta.html').map((q) => `<a href="${q.href}">${icon(q.icon, 18)} ${esc(q.label)}</a>`).join('')}
      </div>
      <a class="btn btn-ghost btn-block" href="conta.html">${icon('user', 18)} Entrar ou criar conta</a>
    </div>
  </aside>`;
}

function cartDrawerHTML() {
  return `
  <aside class="drawer drawer-right" id="cart-drawer" aria-label="Carrinho" aria-hidden="true" inert>
    <div class="drawer-head">
      <h2 class="drawer-title">Seu carrinho <span class="muted" data-cart-count-label></span></h2>
      <button class="icon-btn" type="button" data-close aria-label="Fechar carrinho">${icon('x', 22)}</button>
    </div>
    <div class="ship-progress" data-ship></div>
    <div class="drawer-body cart-lines" data-cart-lines></div>
    <div class="drawer-foot" data-cart-foot></div>
  </aside>
  <div class="overlay" data-overlay hidden></div>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden data-modal>
    <div class="modal-card">
      <button class="icon-btn modal-x" type="button" data-close aria-label="Fechar">${icon('x', 20)}</button>
      <div data-modal-body></div>
    </div>
  </div>
  <div class="toast" role="status" aria-live="polite" data-toast></div>
  <button class="theme-toggle" type="button" data-theme-toggle aria-label="Alternar tema claro ou escuro"></button>`;
}

function footerHTML(categories) {
  const c = CONFIG.CONTACT;
  const l = CONFIG.LEGAL;
  const social = (key, label) => {
    const url = CONFIG.SOCIAL[key];
    return url
      ? `<a class="icon-btn social" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${label}">${icon(key, 19)}</a>`
      : `<span class="icon-btn social is-ph" title="Link do ${label} a preencher" aria-label="${label} (link a preencher)">${icon(key, 19)}</span>`;
  };
  const val = (v) => (isPh(v) ? ph(v || '[a preencher]') : esc(v));
  const cats = categories.map((k) => `<li><a href="loja.html?cat=${k.slug}" title="${esc(NAV_TITLES[k.slug] || k.name)}">${esc(k.name)}</a></li>`).join('');
  return `
  <footer class="site-footer" id="contato">
    <div class="container footer-grid">
      <div class="footer-brand">
        ${brandHTML()}
        <p>Captadores, interfaces de áudio, microfones e acessórios para quem toca instrumento acústico.</p>
        <div class="social-row">${social('instagram', 'Instagram')}${social('youtube', 'YouTube')}</div>
      </div>
      <div>
        <h3 class="footer-h">Loja</h3>
        <ul class="footer-list"><li><a href="loja.html">Todos os produtos</a></li>${cats}<li><a href="loja.html?ofertas=1" title="${esc(NAV_TITLES.ofertas)}">Ofertas</a></li></ul>
      </div>
      <div>
        <h3 class="footer-h">Ajuda</h3>
        <ul class="footer-list">
          ${QUICK_LINKS.map((q) => `<li><a href="${q.href}">${esc(q.label)}</a></li>`).join('')}
          <li><a href="politica-de-privacidade.html">Política de privacidade</a></li>
          <li><a href="termos-de-uso.html">Termos de uso</a></li>
        </ul>
      </div>
      <div>
        <h3 class="footer-h">Atendimento</h3>
        <ul class="footer-list footer-contact">
          <li><a href="https://wa.me/${esc(c.whatsappIntl)}" target="_blank" rel="noopener" title="Falar no WhatsApp">${icon('whats', 17)} WhatsApp: ${val(c.whatsapp)}</a></li>
          <li><a href="tel:${esc(c.phoneIntl)}">${icon('support', 17)} Telefone: ${val(c.phone)}</a></li>
          <li><a href="mailto:${esc(c.email)}">${icon('info', 17)} ${val(c.email)}</a></li>
          <li>${icon('check', 17)} ${val(c.hours)}</li>
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">
      <div class="pay-row" aria-label="Formas de pagamento">
        <span class="pay-chip">${icon('pix', 15)} Pix</span>
        <span class="pay-chip">${icon('card', 15)} Cartão em até ${CONFIG.MAX_INSTALLMENTS}x</span>
        <span class="pay-chip">${icon('lock', 15)} Compra segura</span>
      </div>
      <p class="legal">© ${new Date().getFullYear()} ${val(l.company)} · CNPJ ${val(l.cnpj)}</p>
    </div>
  </footer>`;
}

/* ---------------------------------------------------------- product card */

let catNames = {};

export function productCard(p) {
  const pr = pricing(p);
  const url = `produto.html?p=${encodeURIComponent(p.slug)}`;
  const tags = [];
  if (p.isNew) tags.push('<span class="tag gold">Novo</span>');
  if (pr.onSale) tags.push(`<span class="tag red">-${pr.off}%</span>`);
  if (!p.stock) tags.push('<span class="tag dark">Esgotado</span>');
  return `
  <article class="card fade-up">
    <div class="card-media">
      <img src="${esc(p.img)}" alt="" loading="lazy" decoding="async" width="400" height="400">
      ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(catNames[p.cat] || p.cat)}</span>
      <h3 class="card-name"><a href="${url}">${esc(p.name)}</a></h3>
      <div class="card-price">
        ${pr.onSale ? `<s class="was">${money(pr.regular)}</s>` : ''}
        <span class="now">${money(pr.price)}</span>
      </div>
      <div class="card-inst">${installmentText(pr)}</div>
      ${pr.pix != null ? `<div class="card-pix">${icon('pix', 13)} ${money(pr.pix)} no Pix</div>` : ''}
    </div>
    ${p.stock
      ? `<button class="card-buy" type="button" data-add="${p.id}" aria-label="Adicionar ${esc(p.name)} ao carrinho">${icon('bag', 17)} Comprar</button>`
      : `<span class="card-buy is-off">Indisponível</span>`}
  </article>`;
}

/* ------------------------------------------------------------ drawers etc. */

let products = [];
let lastFocus = null;
let openPanel = null;

function setOpen(panel) {
  const overlay = $('[data-overlay]');
  if (openPanel && openPanel !== panel) {
    openPanel.classList.remove('open');
    openPanel.setAttribute('aria-hidden', 'true');
    openPanel.inert = true;
    if (openPanel.matches('[data-modal]')) openPanel.hidden = true;
  }
  if (!panel) {
    overlay.classList.remove('show');
    setTimeout(() => { if (!openPanel) overlay.hidden = true; }, 250);
    document.documentElement.classList.remove('no-scroll');
    $('[data-open-nav]')?.setAttribute('aria-expanded', 'false');
    openPanel = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    return;
  }
  lastFocus = document.activeElement;
  openPanel = panel;
  overlay.hidden = false;
  if (panel.matches('[data-modal]')) panel.hidden = false;
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  void panel.offsetWidth; // flush styles so the slide-in transition runs
  overlay.classList.add('show');
  panel.classList.add('open');
  document.documentElement.classList.add('no-scroll');
  setTimeout(() => {
    const target = panel.dataset.focusTarget ? $(panel.dataset.focusTarget, panel) : $('[data-close]', panel);
    delete panel.dataset.focusTarget;
    target?.focus();
  }, 60);
}

export const showPanel = (el) => setOpen(el);
export const openCart = () => setOpen($('#cart-drawer'));
export const closeAll = () => setOpen(null);

export function openModal(html) {
  $('[data-modal-body]').innerHTML = html;
  setOpen($('[data-modal]'));
}

let toastTimer;
export function toast(msg) {
  const el = $('[data-toast]');
  el.innerHTML = `${icon('check', 18)} ${esc(msg)}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function renderCart() {
  const count = cart.count();
  $$('[data-cart-count]').forEach((el) => {
    el.textContent = count > 99 ? '99+' : String(count);
    el.hidden = count === 0;
  });
  const btn = $('.cart-btn');
  if (btn) btn.setAttribute('aria-label', `Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`);
  const label = $('[data-cart-count-label]');
  if (label) label.textContent = count ? `(${count})` : '';

  const lines = cart.items
    .map((i) => ({ ...i, p: products.find((p) => p.id === i.id) }))
    .filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);

  const ship = $('[data-ship]');
  const min = CONFIG.FREE_SHIPPING_MIN;
  if (!lines.length) {
    ship.hidden = true;
  } else {
    ship.hidden = false;
    const pct = Math.min(100, (subtotal / min) * 100);
    ship.innerHTML = `
      <p>${icon('truck', 17)} ${subtotal >= min
        ? `<b>Você ganhou ${freeShipText()}!</b>`
        : `Faltam <b>${money(min - subtotal)}</b> para frete grátis`}</p>
      <div class="bar" role="progressbar" aria-label="Progresso para frete grátis" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct}%"></span></div>`;
  }

  const box = $('[data-cart-lines]');
  if (!lines.length) {
    box.innerHTML = `
      <div class="cart-empty">
        <span class="cart-empty-ico">${icon('bag', 34)}</span>
        <p>Seu carrinho está vazio.</p>
        <a class="btn btn-primary" href="loja.html">Ver produtos</a>
      </div>`;
  } else {
    box.innerHTML = lines.map(({ p, qty }) => `
      <div class="cart-line">
        <a class="cart-thumb" href="produto.html?p=${encodeURIComponent(p.slug)}"><img src="${esc(p.img)}" alt="" loading="lazy"></a>
        <div class="cart-info">
          <a class="cart-name" href="produto.html?p=${encodeURIComponent(p.slug)}">${esc(p.name)}</a>
          <span class="cart-unit">${money(p.price)} cada</span>
          <div class="cart-row">
            <div class="qty qty-sm" role="group" aria-label="Quantidade de ${esc(p.name)}">
              <button type="button" data-q="${p.id}" data-d="-1" aria-label="Diminuir">${icon('minus', 16)}</button>
              <span aria-live="polite">${qty}</span>
              <button type="button" data-q="${p.id}" data-d="1" aria-label="Aumentar">${icon('plus', 16)}</button>
            </div>
            <strong>${money(p.price * qty)}</strong>
          </div>
        </div>
        <button class="icon-btn cart-rm" type="button" data-rm="${p.id}" aria-label="Remover ${esc(p.name)}">${icon('trash', 18)}</button>
      </div>`).join('');
  }

  const foot = $('[data-cart-foot]');
  if (!lines.length) { foot.innerHTML = ''; return; }
  const n = interestFree(subtotal);
  const ref = getRef();
  foot.innerHTML = `
    ${ref ? `<p class="ref-note">${icon('check', 16)} Código <b>${esc(ref.code)}</b> será validado no checkout.</p>` : ''}
    <div class="sum-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <p class="muted small">${n > 1 ? `ou em até ${n}x sem juros` : `ou em até ${CONFIG.MAX_INSTALLMENTS}x no cartão`}${CONFIG.PIX_DISCOUNT_PERCENT > 0 ? ` · ${money(subtotal * (1 - CONFIG.PIX_DISCOUNT_PERCENT / 100))} no Pix` : ''}. Frete calculado no checkout.</p>
    <a class="btn btn-primary btn-block" href="checkout.html">${icon('lock', 18)} Finalizar compra</a>
    <button class="btn btn-link btn-block" type="button" data-close>Continuar comprando</button>`;
}

/* ------------------------------------------------------------- theme */

function applyThemeIcon() {
  const btn = $('[data-theme-toggle]');
  const light = document.documentElement.dataset.theme === 'light';
  btn.innerHTML = icon(light ? 'moon' : 'sun', 20);
  btn.setAttribute('aria-label', light ? 'Usar tema escuro' : 'Usar tema claro');
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('rc-theme', next); } catch { /* ignore */ }
  applyThemeIcon();
}

/* ------------------------------------------------------------- reveal */

let io = null;
export function reveal(root = document) {
  const els = $$('.fade-up:not(.in)', root);
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  }
  const vh = window.innerHeight;
  els.forEach((el) => {
    // Content already on screen shows at once; the rest fades in on scroll.
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) el.classList.add('in');
    else io.observe(el);
  });
  watchScrollFallback();
}

// Some embedded/background browsers throttle IntersectionObserver, which would
// leave content invisible. A cheap scroll check guarantees it still appears.
let fallbackOn = false;
function watchScrollFallback() {
  if (fallbackOn) return;
  fallbackOn = true;
  let queued = false;
  const check = () => {
    queued = false;
    const vh = window.innerHeight;
    $$('.fade-up:not(.in)').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) { el.classList.add('in'); io && io.unobserve(el); }
    });
  };
  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(check); }
  }, { passive: true });
  // rAF can also be paused in a hidden tab; a timer catches that case.
  window.addEventListener('scroll', () => setTimeout(check, 300), { passive: true });
}

/* ------------------------------------------------------------- boot */

// The "Ver tudo" panel opens on hover/focus via CSS; this class keeps it open after a tap.
function setNavMore(open) {
  const box = $('[data-nav-more]');
  if (!box) return;
  box.classList.toggle('open', open);
  $('[data-nav-more-btn]', box)?.setAttribute('aria-expanded', String(open));
}

function onClick(e) {
  if (!e.target.closest('[data-nav-more]')) setNavMore(false);
  const t = e.target.closest('button, a, [data-overlay]');
  if (!t) return;

  if (t.matches('[data-nav-more-btn]')) {
    setNavMore(t.getAttribute('aria-expanded') !== 'true');
  } else if (t.matches('[data-add]')) {
    const qty = Number(t.dataset.qty || 1);
    cart.add(t.dataset.add, qty);
    toast('Adicionado ao carrinho');
    openCart();
  } else if (t.matches('[data-buy-now]')) {
    cart.add(t.dataset.buyNow, Number(t.dataset.qty || 1));
    location.href = 'checkout.html';
  } else if (t.matches('[data-open-cart]')) {
    openCart();
  } else if (t.matches('[data-open-nav]')) {
    const nav = $('#mobile-nav');
    if (t.matches('[data-focus-search]')) nav.dataset.focusTarget = '#nav-q';
    setOpen(nav);
    $('.menu-btn')?.setAttribute('aria-expanded', 'true');
  } else if (t.matches('[data-close], [data-overlay]')) {
    closeAll();
  } else if (t.matches('[data-q]')) {
    const line = cart.items.find((i) => i.id === Number(t.dataset.q));
    if (line) cart.setQty(line.id, line.qty + Number(t.dataset.d));
  } else if (t.matches('[data-rm]')) {
    cart.remove(t.dataset.rm);
  } else if (t.matches('[data-theme-toggle]')) {
    toggleTheme();
  } else if (t.matches('#mobile-nav a[href^="#"], #mobile-nav a[href*="#"]')) {
    closeAll();
  }
}

/**
 * Injects the shared chrome and wires global behaviour.
 * @param {{active?: string}} opts  key of the active nav item (category slug, "ofertas" or "loja")
 */
export async function boot({ active = '' } = {}) {
  captureRefFromUrl();

  const header = $('[data-header]');
  const footer = $('[data-footer]');
  navActive = { key: active, current: true };
  header.outerHTML = headerHTML() + mobileNavHTML();
  guardLogos();
  if (CONFIG.FAVICON_URL) $$('link[rel~="icon"]').forEach((l) => { l.href = CONFIG.FAVICON_URL; });
  document.body.insertAdjacentHTML('beforeend', cartDrawerHTML());
  applyThemeIcon();

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openPanel) closeAll();
    else if ($('[data-nav-more].open, [data-nav-more]:focus-within')) {
      setNavMore(false);
      document.activeElement?.blur();
    }
  });

  // Header shadow once the page scrolls.
  const hdr = $('.site-header');
  const onScroll = () => hdr.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  try {
    const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
    products = prods;
    catNames = Object.fromEntries(cats.map((c) => [c.slug, c.name]));
    footer.outerHTML = footerHTML(cats);
    guardLogos($('.site-footer'));
    renderNav(cats);
    // Drop cart lines whose product no longer exists.
    const known = new Set(prods.map((p) => p.id));
    if (cart.items.some((i) => !known.has(i.id))) {
      cart.items = cart.items.filter((i) => known.has(i.id));
      store.set(CART_KEY, cart.items);
    }
    cart.on(renderCart);
    renderCart();
    return { products: prods, categories: cats };
  } catch (err) {
    console.warn('Catálogo indisponível', err);
    footer.outerHTML = footerHTML([]);
    guardLogos($('.site-footer'));
    cart.on(renderCart);
    renderCart();
    return { products: [], categories: [] };
  }
}

/** Five stars filled up to `rating` (halves allowed), read out as "Nota X de 5". */
export function stars(rating) {
  const pct = Math.max(0, Math.min(5, Number(rating) || 0)) * 20;
  const label = String(rating).replace('.', ',');
  return `<span class="stars" role="img" aria-label="Nota ${label} de 5"><span class="stars-fill" style="width:${pct}%">★★★★★</span>★★★★★</span>`;
}

/** Where the reviewed items are sold; shown once per review section instead of on every card. */
export const REVIEW_SOURCES = 'compradores de vários marketplaces, como Mercado Livre, Shopee, Magalu e Amazon';

/** One real buyer review. `product` adds a link to the reviewed item (home page list). */
export function reviewCard(r, product) {
  return `
    <figure class="review-card">
      ${stars(r.rating)}
      <blockquote><p>${esc(r.text)}</p></blockquote>
      ${product ? `<figcaption><a href="produto.html?p=${encodeURIComponent(product.slug)}">${esc(product.name)}</a></figcaption>` : ''}
    </figure>`;
}
