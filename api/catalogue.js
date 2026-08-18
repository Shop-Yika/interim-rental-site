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
        // Image can come from an uploaded Attachment field (Image) OR a pasted link
        // field (ImageURL / "Image URL" / ImageLink). Prefer the upload, fall back to the link.
        let image = '';
        const att = f.Image;
        if (Array.isArray(att)) image = (att[0] && att[0].url) || '';
        else if (typeof att === 'string') image = att;
        if (!image) {
          const link = f.ImageURL || f['Image URL'] || f.ImageLink || '';
          if (link) image = String(link).trim();
        }
        items.push({
          id: r.id, name: f.Name || '', brand: f.Brand || '', category: f.Category || '',
          size: f.Size || '', color: f.Color || '', rrp: f.RRP || 0, adjustPct: f.AdjustPct || 0,
          image: image || ''
        });
      }
    } while (offset);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ pricing: PRICING, items });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
