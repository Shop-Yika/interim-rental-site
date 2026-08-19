// GET /rent/:slug  (rewritten to /api/product?slug=:slug)
// Serves the real site (SPA) with the product auto-opened, and injects per-product
// SEO/meta + Product structured data so the page is crawlable and shareable.
const { at, PRICING, rentalFee, slugify, itemImages } = require('./_lib');

const SITE = (process.env.SITE_URL || 'https://rent.shopyika.com').replace(/\/$/, '');
const AREA = 'the Greater Toronto Area';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'CAD$ ' + (Number(n) || 0).toFixed(2);

let _spa = { html: '', at: 0 };
async function getSPA() {
  const now = Date.now();
  if (_spa.html && now - _spa.at < 120000) return _spa.html;
  const r = await fetch(SITE + '/', { headers: { 'x-ssr-fetch': '1' } });
  const html = await r.text();
  if (html && html.includes('</head>')) _spa = { html, at: now };
  return html;
}

let _items = { list: [], at: 0 };
async function activeItems() {
  const now = Date.now();
  if (_items.list.length && now - _items.at < 60000) return _items.list;
  const out = []; let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100', filterByFormula: '{Active}=1' });
    if (offset) q.set('offset', offset);
    const data = await at(`Items?${q.toString()}`);
    offset = data.offset;
    out.push(...data.records);
  } while (offset);
  _items = { list: out, at: now };
  return out;
}

module.exports = async (req, res) => {
  const home = () => { res.statusCode = 302; res.setHeader('Location', SITE + '/'); res.end(); };
  try {
    const slug = String((req.query && req.query.slug) || '').toLowerCase();
    if (!slug) return home();

    const recs = await activeItems();
    const rec = recs.find(r => slugify(r.fields.Name || '') === slug);
    if (!rec) return home();

    const f = rec.fields;
    const name = f.Name || 'Rental piece';
    const brand = f.Brand || '';
    const images = itemImages(f);
    const image = images[0] || `${SITE}/og-share.png`;
    const bp = rentalFee(f.RRP, f.AdjustPct, PRICING.durations[0]);
    const canonical = `${SITE}/rent/${slug}`;
    const metaBits = [f.Category, f.Size && ('size ' + f.Size), f.Color].filter(Boolean).join(', ');
    const title = `Rent ${name}${brand ? ` by ${brand}` : ''} in the Greater Toronto Area | Yíká`;
    const desc = `Rent the ${name}${brand ? ` by ${brand}` : ''}${f.Size ? `, size ${f.Size}` : ''} from Yíká — designer fashion rental in ${AREA} from ${money(bp)}/4 days. Pick your dates and request to rent; no payment needed to reserve.`;

    const jsonld = {
      '@context': 'https://schema.org', '@type': 'Product',
      name, image: images.length ? images : [image],
      description: `${name}${brand ? ` by ${brand}` : ''}${metaBits ? ` — ${metaBits}.` : '.'} Available to rent from Yíká in ${AREA}.`,
      ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
      ...(f.Category ? { category: f.Category } : {}),
      ...(f.Color ? { color: f.Color } : {}),
      offers: {
        '@type': 'Offer', priceCurrency: 'CAD', price: bp.toFixed(2),
        availability: 'https://schema.org/InStock', url: canonical,
        businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
        seller: { '@type': 'Organization', name: 'Yíká' }
      }
    };

    let html = await getSPA();
    if (!html || !html.includes('</head>')) {
      res.statusCode = 200; res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(fallback({ title, desc, canonical, image, name, brand, id: rec.id }));
    }
    html = inject(html, { title, desc, canonical, image, jsonld, itemId: rec.id });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.end(html);
  } catch (e) {
    home();
  }
};

function inject(html, m) {
  const rep = (re, s) => { html = html.replace(re, s); };
  rep(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`);
  rep(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(m.desc)}">`);
  rep(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${m.canonical}">`);
  rep(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="product">`);
  rep(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(m.title)}">`);
  rep(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(m.desc)}">`);
  rep(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${m.canonical}">`);
  rep(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(m.image)}">`);
  rep(/\s*<meta property="og:image:width" content="[^"]*">/, '');
  rep(/\s*<meta property="og:image:height" content="[^"]*">/, '');
  rep(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(m.title)}">`);
  rep(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(m.desc)}">`);
  rep(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(m.image)}">`);
  const add = `<script>window.__RENT_ITEM__=${JSON.stringify(m.itemId)};</script><script type="application/ld+json">${JSON.stringify(m.jsonld)}</script></head>`;
  return html.replace('</head>', add);
}

function fallback(m) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)}</title><meta name="description" content="${esc(m.desc)}"><link rel="canonical" href="${m.canonical}">
<meta property="og:title" content="${esc(m.title)}"><meta property="og:description" content="${esc(m.desc)}"><meta property="og:image" content="${esc(m.image)}"><meta property="og:url" content="${m.canonical}">
<meta http-equiv="refresh" content="0; url=${SITE}/?item=${m.id}"></head>
<body style="font-family:sans-serif;padding:40px"><h1>${esc(m.name)}</h1><p>Opening Yíká… <a href="${SITE}/?item=${m.id}">Continue</a></p></body></html>`;
}
