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

/** All products, in catalog order. */
export async function getProducts() {
  const data = await load();
  return data.products;
}

/** One product by slug or numeric id, or null when not found. */
export async function getProduct(slugOrId) {
  if (slugOrId == null || slugOrId === '') return null;
  const key = String(slugOrId);
  const products = await getProducts();
  return products.find((p) => p.slug === key || String(p.id) === key) || null;
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
    count: data.products.filter((p) => p.cat === c.slug).length,
  }));
}
