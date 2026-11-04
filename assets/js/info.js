// Institutional pages: shared boot, FAQ accordion and small enhancements.
// The page content and the side menu are static HTML (better for SEO).
import { boot, money, $, $$ } from './app.js';
import { CONFIG } from './config.js';

boot();

// FAQ accordion: one delegated listener per list, state lives in aria-expanded.
$$('[data-faq]').forEach((list) => {
  list.addEventListener('click', (e) => {
    const q = e.target.closest('.faq-q');
    if (!q) return;
    q.setAttribute('aria-expanded', String(q.getAttribute('aria-expanded') !== 'true'));
  });
});

// Open the answer that a #hash points at (e.g. perguntas-frequentes.html#faq-q3).
const target = location.hash && document.getElementById(location.hash.slice(1));
if (target && target.classList.contains('faq-q')) target.setAttribute('aria-expanded', 'true');

// Keep the free-shipping value in sync with config.js when a page marks it.
$$('[data-free-ship]').forEach((el) => { el.textContent = money(CONFIG.FREE_SHIPPING_MIN); });

// On mobile the side menu is a scrollable chip row: bring the current page into view horizontally.
const current = $('.info-nav a[aria-current="page"]');
const row = current && current.closest('ul');
if (row && row.scrollWidth > row.clientWidth) {
  row.scrollLeft = current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2;
}
