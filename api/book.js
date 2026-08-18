// POST /api/book — create a PENDING booking (server recomputes price, re-checks availability)
const { at, quote, BUFFER_DAYS, addDays, overlaps, slack } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { itemId, start, end, fulfilment = 'Standard', renter = {} } = b;
    if (!itemId || !start || !end) return res.status(400).json({ error: 'itemId, start, end required' });
    if (!renter.name || !renter.email || !renter.phone) return res.status(400).json({ error: 'name, email, phone required' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(renter.email)) return res.status(400).json({ error: 'valid email required' });

    const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    if (days < 1) return res.status(400).json({ error: 'invalid date range' });

    // authoritative item + price (never trust client amounts)
    const item = await at(`Items/${itemId}`);
    const f = item.fields;

    // re-check availability with buffer
    const filter = encodeURIComponent("NOT(OR({Status}='Declined',{Status}='Cancelled'))");
    const existing = await at(`Bookings?pageSize=100&filterByFormula=${filter}`);
    const conflict = existing.records
      .filter(r => (r.fields.Item || []).includes(itemId))
      .some(r => overlaps(start, end, addDays(r.fields.Start, -BUFFER_DAYS), addDays(r.fields.End, BUFFER_DAYS)));
    if (conflict) return res.status(409).json({ error: 'Those dates are no longer available. Please pick another range.' });

    const q = quote(f.RRP, f.AdjustPct, days, fulfilment);
    const created = await at('Bookings', {
      method: 'POST',
      body: JSON.stringify({ typecast: true, records: [{ fields: {
        Item: [itemId], Start: start, End: end, Days: days, Fulfilment: fulfilment,
        Rental: q.rental, Shipping: q.shipping, HST: q.hst, DPF: q.dpf, Total: q.total,
        Name: renter.name, Email: renter.email, Phone: renter.phone,
        City: renter.city || '', Address: renter.address || '', Message: renter.message || '',
        Status: 'Pending'
      } }] })
    });
    const rec = created.records[0];
    const ref = rec.fields.Ref || rec.id;

    await slack(`:handbag: *New rental request* — ${f.Name || 'item'}\n` +
      `${renter.name} · ${start} → ${end} (${days}d) · Total CAD$ ${q.total}\n` +
      `Status: *Pending* — approve in Airtable to send the pay link.`);

    res.status(200).json({ ok: true, ref, total: q.total });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
