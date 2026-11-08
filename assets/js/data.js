// Data access layer. Every page reads products and reviews through these functions,
// so swapping the static JSON for Supabase later only touches this file.

const DATA_URL = new URL('../../data/products.json', import.meta.url);

let cache = null;

async function load() {
  if (!cache) {
    cache = fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`products.json: HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        cache = null; // allow a retry on the next call
        throw err;
      });
  }
  return cache;
}

// `hidden: true` products (e.g. a temporary payment test item) never show up in a list: shop,
// search, categories, home, related items. They open only through their direct link
// (produto.html?p=<slug>) and still work in the cart and checkout.
const visible = (p) => !p.hidden;

/** Listed products, in catalog order (hidden ones left out). */
export async function getProducts() {
  const data = await load();
  return data.products.filter(visible);
}

/** Every product, hidden ones included: for the cart and checkout lookups only. */
export async function getAllProducts() {
  const data = await load();
  return data.products;
}

/** One product by slug or numeric id, or null when not found. A hidden product only by slug. */
export async function getProduct(slugOrId) {
  if (slugOrId == null || slugOrId === '') return null;
  const key = String(slugOrId);
  const products = await getAllProducts();
  return products.find((p) => p.slug === key || (visible(p) && String(p.id) === key)) || null;
}

const REVIEWS_URL = new URL('../../data/reviews.json', import.meta.url);
let reviewsCache = null;

/** Real buyer reviews keyed by product slug: { url, average, total, items: [{ rating, text }] }. */
export async function getReviews() {
  if (!reviewsCache) {
    reviewsCache = fetch(REVIEWS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`reviews.json: HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => d.products)
      .catch((err) => {
        reviewsCache = null;
        throw err;
      });
  }
  return reviewsCache;
}

/**
 * Reviews for one product page: its own listing's, or those of the pickup it is a variant of
 * (same pickup sold with a cable, transmitter or as a kit). `of` names the reviewed slug; null when none.
 */
export async function getProductReviews(slug) {
  const all = await getReviews();
  if (all[slug]) return { ...all[slug], of: slug };
  const base = Object.keys(all).find((k) => (all[k].variants || []).includes(slug));
  return base ? { ...all[base], of: base } : null;
}

/** Categories with the number of products in each one. */
export async function getCategories() {
  const data = await load();
  return data.categories.map((c) => ({
    ...c,
    count: data.products.filter((p) => visible(p) && p.cat === c.slug).length,
  }));
}
