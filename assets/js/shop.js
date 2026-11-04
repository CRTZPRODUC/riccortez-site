// Shop page: category / search / sort filters kept in the URL (?cat=a,b&q=...&sort=...&ofertas=1).
// ?ofertas=1 (header "Ofertas" link) lists products with regular > price; the older ?sale=1 still works.
import { boot, productCard, reveal, showPanel, closeAll, setNavActive, esc, icon, $, $$ } from './app.js';

const SORTS = {
  rel: null, // catalog order, or match score when searching
  asc: (a, b) => a.price - b.price,
  desc: (a, b) => b.price - a.price,
  new: (a, b) => Number(!!b.isNew) - Number(!!a.isNew),
};

// Accent- and case-insensitive text for search.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function readState() {
  const sp = new URLSearchParams(location.search);
  return {
    cats: (sp.get('cat') || '').split(',').map((s) => s.trim()).filter(Boolean),
    q: (sp.get('q') || '').trim(),
    sort: SORTS[sp.get('sort')] !== undefined ? sp.get('sort') : 'rel',
    stock: sp.get('stock') === '1',
    sale: sp.get('ofertas') === '1' || sp.get('sale') === '1',
  };
}

function writeState(s) {
  const sp = new URLSearchParams();
  if (s.cats.length) sp.set('cat', s.cats.join(','));
  if (s.q) sp.set('q', s.q);
  if (s.sort !== 'rel') sp.set('sort', s.sort);
  if (s.stock) sp.set('stock', '1');
  if (s.sale) sp.set('ofertas', '1');
  const qs = sp.toString();
  history.replaceState(history.state, '', location.pathname + (qs ? `?${qs.replace(/%2C/g, ',')}` : ''));
}

function score(p, terms, catName) {
  const name = norm(p.name);
  const hay = `${name} ${norm(p.desc)} ${norm(catName)}`;
  let total = 0;
  for (const t of terms) {
    if (!hay.includes(t)) return -1;
    total += name.includes(t) ? 3 : 1;
  }
  return total;
}

// Header nav item for the current filters: one category, the offers list, or "Ver tudo".
function navKey(s) {
  if (s.cats.length === 1) return s.cats[0];
  if (s.sale && !s.cats.length && !s.q) return 'ofertas';
  return s.cats.length || s.q || s.stock ? '' : 'loja';
}

(async function init() {
  const state = readState();
  const { products, categories } = await boot({ active: navKey(state) });
  const catBy = Object.fromEntries(categories.map((c) => [c.slug, c]));
  state.cats = state.cats.filter((c) => catBy[c]);

  const grid = $('[data-grid]');
  const filtersEl = $('#filters');
  const qInput = $('#shop-q');
  const sortSel = $('[data-sort]');
  qInput.value = state.q;
  sortSel.value = state.sort;
  $('[data-opt="stock"]').checked = state.stock;
  $('[data-opt="sale"]').checked = state.sale;

  function renderFilters() {
    const row = (slug, label, count, pressed, ico) => `
      <button class="filter-row" type="button" data-cat="${slug}" aria-pressed="${pressed}">
        <span class="box" aria-hidden="true"></span>${ico ? icon(ico, 17) : ''}${esc(label)}<span class="count">${count}</span>
      </button>`;
    $('[data-cat-filters]').innerHTML =
      row('', 'Todas', products.length, state.cats.length === 0, '') +
      categories.map((c) => row(c.slug, c.name, c.count, state.cats.includes(c.slug), c.icon)).join('');
  }

  function renderHead() {
    const crumbs = $('[data-crumbs]');
    const sep = icon('chevronR', 14);
    const offers = state.sale && !state.cats.length && !state.q;
    $('.page-hero').classList.toggle('page-hero--offers', offers);
    if (state.cats.length === 1) {
      const c = catBy[state.cats[0]];
      $('[data-title]').textContent = c.name;
      $('[data-sub]').textContent = c.blurb || '';
      crumbs.innerHTML = `<a href="index.html">Início</a>${sep}<a href="loja.html">Loja</a>${sep}<span aria-current="page">${esc(c.name)}</span>`;
      document.title = `${c.name} · Ric Cortez Pickups`;
    } else if (offers) {
      $('[data-title]').textContent = 'Ofertas';
      $('[data-sub]').textContent = 'Captadores, interfaces, microfones e kits com preço promocional.';
      crumbs.innerHTML = `<a href="index.html">Início</a>${sep}<a href="loja.html">Loja</a>${sep}<span aria-current="page">Ofertas</span>`;
      document.title = 'Ofertas · Ric Cortez Pickups';
    } else {
      $('[data-title]').textContent = state.q ? `Busca: “${state.q}”` : 'Loja';
      $('[data-sub]').textContent = state.cats.length
        ? state.cats.map((s) => catBy[s].name).join(', ')
        : 'Captadores, interfaces de áudio, microfones, kits e acessórios.';
      crumbs.innerHTML = `<a href="index.html">Início</a>${sep}<span aria-current="page">Loja</span>`;
      document.title = 'Loja · Ric Cortez Pickups';
    }
  }

  function renderChips() {
    const chips = [];
    state.cats.forEach((s) => chips.push(`<button class="chip" type="button" data-chip-cat="${s}" aria-label="Remover filtro ${esc(catBy[s].name)}">${esc(catBy[s].name)} ${icon('x', 14)}</button>`));
    if (state.q) chips.push(`<button class="chip" type="button" data-chip-q aria-label="Limpar busca">“${esc(state.q)}” ${icon('x', 14)}</button>`);
    if (state.stock) chips.push(`<button class="chip" type="button" data-chip-opt="stock">Disponíveis ${icon('x', 14)}</button>`);
    if (state.sale) chips.push(`<button class="chip" type="button" data-chip-opt="sale">Em oferta ${icon('x', 14)}</button>`);
    $('[data-chips]').innerHTML = chips.join('');
  }

  function renderGrid() {
    const terms = norm(state.q).split(/\s+/).filter(Boolean);
    let list = products
      .filter((p) => !state.cats.length || state.cats.includes(p.cat))
      .filter((p) => !state.stock || p.stock)
      .filter((p) => !state.sale || Number(p.regular) > Number(p.price))
      .map((p, i) => ({ p, i, s: terms.length ? score(p, terms, catBy[p.cat]?.name) : 0 }))
      .filter((x) => x.s >= 0);

    const cmp = SORTS[state.sort];
    list.sort((a, b) => (cmp ? cmp(a.p, b.p) : 0) || (terms.length && state.sort === 'rel' ? b.s - a.s : 0) || a.i - b.i);
    list = list.map((x) => x.p);

    const n = list.length;
    $('[data-count]').innerHTML = `<b>${n}</b> ${n === 1 ? 'produto' : 'produtos'}`;
    grid.innerHTML = n
      ? list.map(productCard).join('')
      : `<div class="empty-state" style="grid-column:1/-1">
           <h2>Nenhum produto encontrado</h2>
           <p>Tente outra palavra ou limpe os filtros.</p>
           <button class="btn btn-primary" type="button" data-clear>Limpar filtros</button>
         </div>`;
    reveal(grid);
  }

  function update() {
    writeState(state);
    setNavActive(navKey(state));
    renderFilters();
    renderHead();
    renderChips();
    renderGrid();
  }

  function clearAll() {
    state.cats = []; state.q = ''; state.stock = false; state.sale = false; state.sort = 'rel';
    qInput.value = ''; sortSel.value = 'rel';
    $$('[data-opt]').forEach((el) => { el.checked = false; });
    update();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.matches('[data-cat]')) {
      const slug = t.dataset.cat;
      if (!slug) state.cats = [];
      else state.cats = state.cats.includes(slug) ? state.cats.filter((c) => c !== slug) : [...state.cats, slug];
      update();
    } else if (t.matches('[data-chip-cat]')) {
      state.cats = state.cats.filter((c) => c !== t.dataset.chipCat); update();
    } else if (t.matches('[data-chip-q]')) {
      state.q = ''; qInput.value = ''; update();
    } else if (t.matches('[data-chip-opt]')) {
      state[t.dataset.chipOpt] = false; $(`[data-opt="${t.dataset.chipOpt}"]`).checked = false; update();
    } else if (t.matches('[data-clear]')) {
      clearAll();
    } else if (t.matches('[data-open-filters]')) {
      showPanel(filtersEl);
    }
  });

  $$('[data-opt]').forEach((el) => el.addEventListener('change', () => { state[el.dataset.opt] = el.checked; update(); }));
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; update(); });

  let timer;
  qInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = qInput.value.trim(); update(); }, 200);
  });
  $('[data-shop-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(timer);
    state.q = qInput.value.trim();
    update();
    if (filtersEl.classList.contains('open')) closeAll();
  });

  // The filters panel is an off-canvas drawer below 1024px; make sure it is usable again on wide screens.
  const wide = matchMedia('(min-width: 1025px)');
  const resetPanel = () => {
    if (!wide.matches) return;
    if (filtersEl.classList.contains('open')) closeAll();
    filtersEl.inert = false;
    filtersEl.removeAttribute('aria-hidden');
  };
  wide.addEventListener('change', resetPanel);

  update();
})();
