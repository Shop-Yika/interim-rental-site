// GET /category/:slug and /brand/:slug (rewritten to /api/collection?type=&value=)
// Serves the real site (SPA) with the matching filter pre-applied, and injects
// per-page SEO meta + CollectionPage structured data so the page is crawlable.
const { at, rentalFee, slugify, itemImages, PRICING } = require('./_lib');

const SITE = (process.env.SITE_URL || 'https://rent.shopyika.com').replace(/\/$/, '');
const AREA = 'the Greater Toronto Area';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    const type = String((req.query && req.query.type) || '').toLowerCase();
    const value = String((req.query && req.query.value) || '').toLowerCase();
    if (!['category', 'brand'].includes(type) || !value) return home();

    const recs = await activeItems();
    const fieldName = type === 'category' ? 'Category' : 'Brand';
    const matches = recs.filter(r => slugify(r.fields[fieldName] || '') === value);
    const label = matches.length ? (matches[0].fields[fieldName] || value) : value.replace(/-/g, ' ');
    const canonical = `${SITE}/${type}/${value}`;
    const firstImg = matches.map(r => itemImages(r.fields)[0]).find(Boolean);
    const image = firstImg || `${SITE}/og-share.png`;

    const title = `Rent ${label} in the Greater Toronto Area | Yíká`;
    const desc = matches.length
      ? `Rent ${label}${type === 'brand' ? ' pieces' : ''} in ${AREA} from Yíká — ${matches.length} piece${matches.length === 1 ? '' : 's'} available. Pick your dates and request to rent; no payment needed to reserve.`
      : `Rent ${label} in ${AREA} from Yíká. Browse the full collection of designer and everyday fashion to rent.`;

    const jsonld = {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: title, description: desc, url: canonical,
      isPartOf: { '@type': 'WebSite', name: 'Yíká', url: SITE + '/' },
      mainEntity: {
        '@type': 'ItemList', numberOfItems: matches.length,
        itemListElement: matches.slice(0, 50).map((r, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${SITE}/rent/${slugify(r.fields.Name || '')}`, name: r.fields.Name || 'Piece'
        }))
      }
    };

    let html = await getSPA();
    if (!html || !html.includes('</head>')) { return home(); }
    html = inject(html, { title, desc, canonical, image, jsonld, filter: { type, value } });
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
  rep(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(m.title)}">`);
  rep(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(m.desc)}">`);
  rep(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${m.canonical}">`);
  rep(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(m.title)}">`);
  rep(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(m.desc)}">`);
  if (m.image && !m.image.includes('og-share')) {
    rep(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(m.image)}">`);
    rep(/\s*<meta property="og:image:width" content="[^"]*">/, '');
    rep(/\s*<meta property="og:image:height" content="[^"]*">/, '');
    rep(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(m.image)}">`);
  }
  const add = `<script>window.__RENT_FILTER__=${JSON.stringify(m.filter)};</script><script type="application/ld+json">${JSON.stringify(m.jsonld)}</script></head>`;
  return html.replace('</head>', add);
}
