// GET /api/catalogue — active items + pricing (replaces catalogue.json)
const { at, PRICING } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const items = [];
    let offset;
    do {
      const q = new URLSearchParams({ pageSize: '100', filterByFormula: '{Active}=1' });
      if (offset) q.set('offset', offset);
      const data = await at(`Items?${q.toString()}`);
      offset = data.offset;
      for (const r of data.records) {
        const f = r.fields;
        // Images can come from an uploaded Attachment field (Image, supports multiple files)
        // AND/OR a link field (ImageURL / "Image URL" / ImageLink), which may hold several
        // links separated by commas or new lines. Uploads come first, then links.
        let images = [];
        const att = f.Image;
        if (Array.isArray(att)) images = att.map(a => a && a.url).filter(Boolean);
        else if (typeof att === 'string' && att.trim()) images = [att.trim()];
        const linkRaw = f.ImageURL || f['Image URL'] || f.ImageLink || '';
        if (linkRaw) {
          String(linkRaw).split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
            .forEach(u => { if (!images.includes(u)) images.push(u); });
        }
        items.push({
          id: r.id, name: f.Name || '', brand: f.Brand || '', category: f.Category || '',
          size: f.Size || '', color: f.Color || '', rrp: f.RRP || 0, adjustPct: f.AdjustPct || 0,
          image: images[0] || '', images
        });
      }
    } while (offset);
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    res.status(200).json({ pricing: PRICING, items });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
