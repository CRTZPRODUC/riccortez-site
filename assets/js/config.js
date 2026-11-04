// Store-wide settings for the Ric Cortez storefront model.
// Values marked "confirmar" or written as [placeholders] must be checked by the owner
// before going live. Nothing here is fetched from a server.

export const CONFIG = {
  STORE_NAME: 'Ric Cortez',

  // Brand logo "Ric Cortez Gold Pro Captadores" (white and gold artwork on a transparent
  // background, 776x322). LOGO_LIGHT_URL is the same artwork with the white parts turned
  // near-black, shown in the header and drawer on the light theme.
  // An empty LOGO_URL falls back to the text wordmark.
  LOGO_URL: 'assets/img/logo-gold-pro.webp',
  LOGO_LIGHT_URL: 'assets/img/logo-gold-pro-light.webp',
  LOGO_WIDTH: 776,
  LOGO_HEIGHT: 322,
  // riccortez.com publishes no favicon (no <link rel="icon">, /favicon.ico returns 404),
  // so the pages keep their inline "R" icon. Put a square PNG/SVG URL here to replace it.
  FAVICON_URL: '',

  // Pix discount in percent (owner, 2026-11-04: 5%). It applies on top of the promo price
  // (R$100 with 20% off is R$80, and R$76 on Pix). At checkout InfinitePay applies it to the
  // whole payment, shipping included. Keep in sync with PIX_DISCOUNT in supabase/functions/_shared/store.ts.
  // 0 hides every Pix price line.
  PIX_DISCOUNT_PERCENT: 5,

  // Credit card installments (InfinitePay). Up to 12x; the store absorbs the fees ("sem juros")
  // up to the tier below for the order value, and the customer pays the interest beyond it.
  MAX_INSTALLMENTS: 12,
  // Interest-free installments by order value in BRL (owner, 2026-11-04).
  // Below the first tier the card payment has no interest-free installments (1x).
  // Sent to InfinitePay as options.assured_installments.
  INTEREST_FREE_TIERS: [
    { min: 150, n: 2 },
    { min: 250, n: 3 },
    { min: 350, n: 4 },
    { min: 450, n: 5 },
    { min: 550, n: 6 },
    { min: 1550, n: 8 },
  ],
  // InfiniteTag of the store's InfinitePay account, without the "$". The API key belongs to
  // "cortezproduction" (no final s): that is the tag in the payment links it creates.
  INFINITEPAY_HANDLE: 'cortezproduction',
  // Smallest installment value allowed, in BRL. Lower prices get fewer installments.
  MIN_INSTALLMENT: 10,

  // Free shipping threshold in BRL (confirmed by the owner).
  FREE_SHIPPING_MIN: 135,
  // Most the store pays toward shipping on a free-shipping order, in BRL; the customer pays
  // the rest (owner, 2026-11-04). Keep in sync with supabase/functions/_shared/store.ts.
  FREE_SHIPPING_SUBSIDY: 35,

  // Shipping quote endpoint (Supabase Edge Function `frete`, SuperFrete behind it).
  // Empty hides the live quote and shows only the free-shipping note.
  // Local test: http://localhost:8000 (see supabase/functions/frete/README.md).
  SHIPPING_API_URL: 'https://grkodpfitwkvkukcerzm.supabase.co/functions/v1/frete',
  // Checkout (creates the order and the InfinitePay link) and payment confirmation endpoints.
  CHECKOUT_API_URL: 'https://grkodpfitwkvkukcerzm.supabase.co/functions/v1/checkout',
  PAYMENT_API_URL: 'https://grkodpfitwkvkukcerzm.supabase.co/functions/v1/pagamento',

  // Supabase project for customer accounts (Supabase Auth). The publishable key is public by
  // design: row level security decides what each visitor can read.
  SUPABASE_URL: 'https://grkodpfitwkvkukcerzm.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Jz_reV79ToyruSbIZlr0NA_1JpIdZcE',

  // Dispatch time in business days for items kept in stock.
  DISPATCH_BUSINESS_DAYS: 2,
  // Items made on demand (to keep the quality up): the product page shows a notice and the
  // longer dispatch time. Matched by product slug.
  MADE_TO_ORDER: {
    days: 4,
    slugs: [
      'rt6-gold-pro-p-violao-6-cordas',
      'rt6-gold-pro-p-violao-6-cordas-interno-p10',
      'rt6-gold-pro-p-violao-6-cordas-externo-p2',
      'rt7-rastilho-gold-pro-p-violao-7-cordas-interno-p10',
      'rt7-rastilho-gold-pro-p-violao-7-cordas-externo-p2',
      'pocket-guitar-violao',
      'pocket-guitar-cavaco',
      'pocket-guitar-guitarra',
    ],
  },

  // Every product has the 90-day legal warranty. These models (Jackcap 1, 2 and 3 with their
  // variants, and Gold Extreme Bass) carry a 1-year warranty, shown as a seal on the product page.
  // Every product whose slug contains "jackcap" gets it too, so new Jackcap items need no entry here (owner, 2026-11-04).
  WARRANTY_LEGAL_DAYS: 90,
  WARRANTY_1Y_SLUGS: [
    'jackcap-1-up', 'jackcap-1-up-com-cabo-p10', 'kit-5-captadores-jackcap-1-up', 'jackcap-1-ex',
    'jackcap-2-up', 'jackcap-2-up-com-cabo-p10', 'jackcap-2-up-com-suporte-de-queixeira',
    'jackcap-2-up-com-suporte-de-queixeira-e-cabo-p10', 'jackcap-2-up-com-suporte-de-queixeira-e-transmissor',
    'jackcap-3-up', 'jackcap-3-up-com-cabo-p10', 'jackcap-3-up-com-suporte-de-queixeira',
    'jackcap-3-up-com-suporte-de-queixeira-e-cabo-p10', 'jackcap-3-up-com-transmissor',
    'gold-extreme-bass-individual', 'gold-extreme-bass-duplo',
  ],

  // How long a referral code (?ref= / ?cupom=) stays attached to the visitor, in days.
  REF_DAYS: 30,

  // Black November Gold Pro: the first home hero slide and the gold ticker under the hero.
  // Both disappear after `end`. The offers cover the whole store.
  BLACK_NOVEMBER: {
    end: '2026-11-30T23:59:59-03:00',
  },

  // Contact and legal data shown in the footer and on the institutional pages.
  // whatsappIntl is the wa.me number (country code + DDD + number, digits only).
  CONTACT: {
    whatsapp: '(11) 94687-9965',
    whatsappIntl: '5511946879965',
    phone: '(11) 98611-6544',
    phoneIntl: '+5511986116544',
    email: 'contato@riccortez.com',
    hours: 'Seg. a sex., 9h às 20h · Sáb., 12h às 16h',
  },
  // No street address is published on purpose (owner's choice).
  LEGAL: {
    company: 'CORTEZ PRODUCTIONS LTDA',
    cnpj: '35.810.742/0001-67',
  },
  // Social profile URLs. Empty strings render as non-clickable placeholders.
  SOCIAL: {
    instagram: '',
    youtube: '',
  },
};
