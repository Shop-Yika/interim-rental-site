// GET /sitemap.xml (rewritten to /api/sitemap) — home + every active product URL
const { at, slugify } = require('./_lib');
const SITE = (process.env.SITE_URL || 'https://rent.shopyika.com').replace(/\/$/, '');

module.exports = async (req, res) => {
  try {
    const products = []; const cats = new Set(); const brands = new Set();
    let offset;
    do {
      const q = new URLSearchParams({ pageSize: '100', filterByFormula: '{Active}=1' });
      if (offset) q.set('offset', offset);
      const data = await at(`Items?${q.toString()}`);
      offset = data.offset;
      for (const r of data.records) {
        const s = slugify(r.fields.Name || '');
        if (s) products.push(`${SITE}/rent/${s}`);
        if (r.fields.Category) cats.add(slugify(r.fields.Category));
        if (r.fields.Brand) brands.add(slugify(r.fields.Brand));
      }
    } while (offset);

    const urls = [`${SITE}/`,
      ...[...cats].filter(Boolean).map(s => `${SITE}/category/${s}`),
      ...[...brands].filter(Boolean).map(s => `${SITE}/brand/${s}`),
      ...products];

    const today = new Date().toISOString().slice(0, 10);
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>${i === 0 ? 'daily' : 'weekly'}</changefreq><priority>${i === 0 ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.end(body);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/</loc></url></urlset>`);
  }
};
