// GET /rent/:slug  (rewritten to /api/product?slug=:slug)
// Server-rendered, crawlable product page for SEO. Links into the SPA booking flow.
const { at, PRICING, rentalFee, slugify, itemImages } = require('./_lib');

const SITE = (process.env.SITE_URL || 'https://rent.shopyika.com').replace(/\/$/, '');
const AREA = 'the Greater Toronto Area';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'CAD$ ' + (Number(n) || 0).toFixed(2);

async function activeItems() {
  const out = []; let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100', filterByFormula: '{Active}=1' });
    if (offset) q.set('offset', offset);
    const data = await at(`Items?${q.toString()}`);
    offset = data.offset;
    out.push(...data.records);
  } while (offset);
  return out;
}

module.exports = async (req, res) => {
  try {
    const slug = String((req.query && req.query.slug) || '').toLowerCase();
    if (!slug) { res.statusCode = 302; res.setHeader('Location', SITE + '/'); return res.end(); }

    const recs = await activeItems();
    const rec = recs.find(r => slugify(r.fields.Name || '') === slug);
    if (!rec) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(shell('Piece not found — Yíká', `<div class="wrap pad"><h1>We couldn’t find that piece</h1><p>It may have been rented or removed. <a href="${SITE}/">Browse the full collection</a>.</p></div>`));
    }

    const f = rec.fields;
    const name = f.Name || 'Rental piece';
    const brand = f.Brand || '';
    const images = itemImages(f);
    const image = images[0] || `${SITE}/og-share.png`;
    const base = rentalFee(f.RRP, f.AdjustPct, PRICING.durations[0]);
    const canonical = `${SITE}/rent/${slug}`;
    const metaBits = [f.Category, f.Size && ('size ' + f.Size), f.Color].filter(Boolean).join(', ');

    const title = `Rent ${name}${brand ? ` by ${brand}` : ''} in the Greater Toronto Area | Yíká`;
    const desc = `Rent the ${name}${brand ? ` by ${brand}` : ''}${f.Size ? `, size ${f.Size}` : ''} from Yíká — designer fashion rental in ${AREA} from ${money(base)}/4 days. Pick your dates and request to rent; no payment needed to reserve.`;

    const priceRows = PRICING.durations.map(d => {
      const p = rentalFee(f.RRP, f.AdjustPct, d);
      return `<div class="prow"><span>${d} days</span><b>${money(p)}</b> <span class="pd">${money(p / d)}/day</span></div>`;
    }).join('');

    // internal links to a few other pieces (crawl depth)
    const others = recs.filter(r => r.id !== rec.id).slice(0, 6).map(r => {
      const nm = r.fields.Name || 'Piece';
      return `<a class="rel" href="${SITE}/rent/${slugify(nm)}">${esc(nm)}</a>`;
    }).join('');

    const jsonld = {
      '@context': 'https://schema.org', '@type': 'Product',
      name, image: images.length ? images : [image],
      description: `${name}${brand ? ` by ${brand}` : ''}${metaBits ? ` — ${metaBits}.` : '.'} Available to rent from Yíká in ${AREA}.`,
      ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
      ...(f.Category ? { category: f.Category } : {}),
      ...(f.Color ? { color: f.Color } : {}),
      offers: {
        '@type': 'Offer', priceCurrency: 'CAD', price: base.toFixed(2),
        availability: 'https://schema.org/InStock', url: canonical,
        businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
        seller: { '@type': 'Organization', name: 'Yíká' }
      }
    };

    const gallery = images.length
      ? `<div class="gimg"><img src="${esc(images[0])}" alt="${esc(name)}${brand ? ' by ' + esc(brand) : ''} — rent in the GTA"></div>
         ${images.length > 1 ? `<div class="thumbs">${images.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}`
      : `<div class="gimg ph">Yíká</div>`;

    const body = `
      <header class="hd"><div class="wrap row">
        <a href="${SITE}/" class="lg">Yíká</a>
        <nav><a href="${SITE}/#collection">Collection</a> <a href="${SITE}/#how">How it works</a></nav>
      </div></header>
      <main class="wrap grid2">
        <div>${gallery}</div>
        <div>
          <div class="brand">${brand ? `<a href="${SITE}/brand/${slugify(brand)}">${esc(brand)}</a>` : ''}</div>
          <h1>${esc(name)}</h1>
          <div class="meta">${esc(metaBits)}${f.RRP ? ` · Retail ${money(f.RRP)}` : ''}</div>
          <p class="lead">Rent the ${esc(name)}${brand ? ` by ${esc(brand)}` : ''} from Yíká — designer and everyday fashion rental serving ${AREA}. Choose your rental length, pick your dates, and request to rent. No payment is needed to reserve; we confirm availability and send a secure pay link.</p>
          <div class="prices"><div class="ptt">Rental prices</div>${priceRows}</div>
          <a class="btn" href="${SITE}/?item=${rec.id}">Rent this piece</a>
          <p class="fine">A non-refundable Damage Protection Fee applies. Delivery across ${AREA}, or local pickup.</p>
        </div>
      </main>
      <section class="wrap more">
        <h2>More to rent in the GTA</h2>
        <div class="rels">${others}</div>
        <p class="shopmore">${f.Category ? `<a href="${SITE}/category/${slugify(f.Category)}">All ${esc(f.Category)}</a>` : ''}${(f.Category && brand) ? ' · ' : ''}${brand ? `<a href="${SITE}/brand/${slugify(brand)}">More by ${esc(brand)}</a>` : ''}</p>
        <p><a href="${SITE}/">Browse the full Yíká collection →</a></p>
      </section>
      <footer class="ft"><div class="wrap row"><span>© Yíká — fashion rental in the Greater Toronto Area</span><span>admin@shopyika.com · (226) 507-9639</span></div></footer>
      <script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.end(shell(title, body, { desc, canonical, image, name, brand }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(shell('Yíká', `<div class="wrap pad"><h1>Something went wrong</h1><p><a href="${SITE}/">Back to Yíká</a></p></div>`));
  }
};

function shell(title, body, m = {}) {
  const desc = m.desc || 'Designer and everyday fashion rental in the Greater Toronto Area from Yíká.';
  const canonical = m.canonical || SITE + '/';
  const image = m.image || `${SITE}/og-share.png`;
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="product"><meta property="og:site_name" content="Yíká">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap" rel="stylesheet">
<style>
:root{--ink:#2a1f2b;--muted:#9a8b98;--bg:#FFFDF7;--brand:#662762;--line:#ecdde8;--soft:#F5DBEA}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;line-height:1.6}
h1,h2{font-family:'Newsreader',Georgia,serif;font-weight:600;margin:0}a{color:inherit;text-decoration:none}img{display:block;max-width:100%}
.wrap{max-width:1100px;margin:0 auto;padding:0 24px}.pad{padding:60px 24px}.row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.hd{border-bottom:1px solid var(--line);padding:16px 0}.lg{font-family:'Newsreader',serif;font-size:24px;color:var(--brand)}.hd nav a{font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin-left:18px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:40px;padding:34px 24px}
.gimg{aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:linear-gradient(160deg,var(--soft),#f3e6d9);display:flex;align-items:center;justify-content:center;color:var(--brand)}
.gimg img{width:100%;height:100%;object-fit:cover}.thumbs{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.thumbs img{width:64px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}
.brand{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}h1{font-size:32px;margin:6px 0 8px}.meta{color:#5c4f5c;font-size:14px;margin-bottom:14px}
.lead{font-size:15px;color:#4a3f4a}.prices{border:1px solid var(--line);border-radius:12px;padding:6px 16px;margin:18px 0}.ptt{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--brand);font-weight:700;margin:10px 0 6px}
.prow{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px solid #f6eef4;font-size:15px}.prow:last-child{border-bottom:0}.prow b{color:var(--brand)}.pd{color:var(--muted);font-size:12.5px}
.btn{display:inline-block;background:var(--brand);color:#fff;padding:14px 30px;border-radius:8px;font-weight:700;margin-top:4px}.fine{font-size:12.5px;color:var(--muted);margin-top:12px}
.more{padding:20px 24px 10px;border-top:1px solid var(--line)}.more h2{font-size:22px;margin-bottom:14px}.rels{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}.rel{border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-size:13px}
.ft{border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;padding:24px 0;margin-top:20px}
@media(max-width:760px){.grid2{grid-template-columns:1fr;gap:22px}.ft .row{flex-direction:column;gap:6px;align-items:flex-start}}
</style></head><body>${body}</body></html>`;
}
