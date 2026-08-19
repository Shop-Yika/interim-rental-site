// GET /category/:slug and /brand/:slug (rewritten to /api/collection?type=&value=)
// Server-rendered, crawlable listing pages for SEO (e.g. "Rent Dresses in the Greater Toronto Area").
const { at, rentalFee, slugify, itemImages, PRICING } = require('./_lib');

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
    const type = String((req.query && req.query.type) || '').toLowerCase();
    const value = String((req.query && req.query.value) || '').toLowerCase();
    if (!['category', 'brand'].includes(type) || !value) { res.statusCode = 302; res.setHeader('Location', SITE + '/'); return res.end(); }

    const recs = await activeItems();
    const field = type === 'category' ? 'Category' : 'Brand';
    const matches = recs.filter(r => slugify(r.fields[field] || '') === value);
    const label = matches.length ? (matches[0].fields[field] || value) : value.replace(/-/g, ' ');
    const canonical = `${SITE}/${type}/${value}`;
    const d0 = PRICING.durations[0];

    const title = `Rent ${label} in the Greater Toronto Area | Yíká`;
    const desc = matches.length
      ? `Rent ${label}${type === 'brand' ? ' pieces' : ''} in ${AREA} from Yíká — ${matches.length} piece${matches.length === 1 ? '' : 's'} available. Pick your dates and request to rent; no payment needed to reserve.`
      : `Rent ${label} in ${AREA} from Yíká. Browse the full collection of designer and everyday fashion to rent.`;

    const cards = matches.map(r => {
      const f = r.fields; const nm = f.Name || 'Piece'; const img = itemImages(f)[0] || '';
      const p = rentalFee(f.RRP, f.AdjustPct, d0);
      const ph = img ? `<img src="${esc(img)}" alt="${esc(nm)} — rent in the GTA" loading="lazy">` : `<div class="noimg">Yíká</div>`;
      return `<a class="card" href="${SITE}/rent/${slugify(nm)}"><div class="ph">${ph}</div><div class="b">
        <div class="cb">${esc(f.Brand || '')}</div><div class="cn">${esc(nm)}</div>
        <div class="cp">From <b>${money(p)}</b> / ${d0} days</div></div></a>`;
    }).join('');

    const cats = [...new Set(recs.map(r => r.fields.Category).filter(Boolean))].sort();
    const brands = [...new Set(recs.map(r => r.fields.Brand).filter(Boolean))].sort();
    const chip = (t, s, txt) => `<a class="chip" href="${SITE}/${t}/${s}">${esc(txt)}</a>`;
    const catChips = cats.map(c => chip('category', slugify(c), c)).join('');
    const brandChips = brands.slice(0, 24).map(b => chip('brand', slugify(b), b)).join('');

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

    const body = `
      <header class="hd"><div class="wrap row">
        <a href="${SITE}/" class="lg">Yíká</a>
        <nav><a href="${SITE}/#collection">Collection</a> <a href="${SITE}/#how">How it works</a></nav>
      </div></header>
      <main class="wrap">
        <nav class="crumb"><a href="${SITE}/">Home</a> / ${type === 'category' ? 'Category' : 'Brand'} / <span>${esc(label)}</span></nav>
        <h1>Rent ${esc(label)} in the Greater Toronto Area</h1>
        <p class="lead">${matches.length
          ? `Browse ${matches.length} ${esc(label)}${type === 'brand' ? ' piece' : ''}${matches.length === 1 ? '' : 's'} available to rent from Yíká across ${AREA}. Choose a piece, pick your dates, and request to rent — no payment needed to reserve.`
          : `We don’t have ${esc(label)} in stock right now. Browse the <a href="${SITE}/">full collection</a> to rent across ${AREA}.`}</p>
        <div class="grid">${cards}</div>
        <section class="cross">
          <h2>Shop by category</h2><div class="chips">${catChips}</div>
          <h2>Shop by brand</h2><div class="chips">${brandChips}</div>
        </section>
      </main>
      <footer class="ft"><div class="wrap row"><span>© Yíká — fashion rental in the Greater Toronto Area</span><span>admin@shopyika.com · (226) 507-9639</span></div></footer>
      <script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.end(shell(title, body, { desc, canonical }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(shell('Yíká', `<main class="wrap"><h1>Something went wrong</h1><p><a href="${SITE}/">Back to Yíká</a></p></main>`));
  }
};

function shell(title, body, m = {}) {
  const desc = m.desc || 'Designer and everyday fashion rental in the Greater Toronto Area from Yíká.';
  const canonical = m.canonical || SITE + '/';
  const image = `${SITE}/og-share.png`;
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website"><meta property="og:site_name" content="Yíká">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap" rel="stylesheet">
<style>
:root{--ink:#2a1f2b;--muted:#9a8b98;--bg:#FFFDF7;--brand:#662762;--line:#ecdde8;--soft:#F5DBEA}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;line-height:1.6}
h1,h2{font-family:'Newsreader',Georgia,serif;font-weight:600;margin:0}a{color:inherit;text-decoration:none}img{display:block;max-width:100%}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}.row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.hd{border-bottom:1px solid var(--line);padding:16px 0}.lg{font-family:'Newsreader',serif;font-size:24px;color:var(--brand)}.hd nav a{font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin-left:18px}
.crumb{font-size:12.5px;color:var(--muted);margin:22px 0 4px}.crumb a:hover{color:var(--brand)}
h1{font-size:clamp(26px,4vw,38px);margin:6px 0 10px}.lead{font-size:15px;color:#4a3f4a;max-width:70ch;margin:0 0 26px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.card{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;color:inherit}
.card .ph{aspect-ratio:3/4;background:linear-gradient(160deg,var(--soft),#f3e6d9);overflow:hidden;display:flex;align-items:center;justify-content:center}
.card .ph img{width:100%;height:100%;object-fit:cover}.noimg{color:var(--brand);opacity:.5;font-size:12px;letter-spacing:.1em}
.card .b{padding:11px 12px}.cb{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.cn{font-size:14px;font-weight:700;margin:3px 0 5px}.cp{font-size:13px;color:#5c4f5c}.cp b{color:var(--brand)}
.cross{margin:44px 0 10px}.cross h2{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:var(--brand);margin:22px 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:13px}.chip:hover{border-color:var(--brand);background:var(--soft)}
.ft{border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;padding:26px 0;margin-top:36px}
@media(max-width:560px){.ft .row{flex-direction:column;gap:6px;align-items:flex-start}}
</style></head><body>${body}</body></html>`;
}
