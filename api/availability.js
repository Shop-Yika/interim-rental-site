// GET /api/availability?item=recXXXX — booked/pending date ranges for one item
const { at, BUFFER_DAYS } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const itemId = req.query && req.query.item;
    if (!itemId) return res.status(400).json({ error: 'item required' });
    const filter = encodeURIComponent("NOT(OR({Status}='Declined',{Status}='Cancelled'))");
    const data = await at(`Bookings?pageSize=100&filterByFormula=${filter}`);
    const ranges = data.records
      .filter(r => (r.fields.Item || []).includes(itemId))
      .map(r => ({ start: r.fields.Start, end: r.fields.End, status: r.fields.Status }))
      .filter(r => r.start && r.end);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ bufferDays: BUFFER_DAYS, ranges });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
