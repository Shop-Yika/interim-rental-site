// GET /api/pay?b=<Ref> — customer clicks the emailed link after you APPROVE.
// Creates a Stripe hosted Checkout session and redirects. No card data touches this site.
const { at } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const ref = req.query && req.query.b;
    if (!ref) return res.status(400).send('Missing booking reference.');

    const data = await at(`Bookings?filterByFormula=${encodeURIComponent(`{Ref}=${ref}`)}`);
    const rec = data.records[0];
    if (!rec) return res.status(404).send('Booking not found.');
    const f = rec.fields;

    if (f.Paid) return res.redirect(302, `${process.env.SITE_URL}/?already=1`);
    if (f.Status !== 'Approved') return res.status(403).send('This booking has not been approved for payment yet. Please wait for our confirmation email.');

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${process.env.SITE_URL}/?paid=${ref}`);
    params.append('cancel_url', `${process.env.SITE_URL}/?cancelled=${ref}`);
    params.append('client_reference_id', rec.id);
    if (f.Email) params.append('customer_email', f.Email);
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'cad');
    params.append('line_items[0][price_data][unit_amount]', String(Math.round((f.Total || 0) * 100)));
    params.append('line_items[0][price_data][product_data][name]', `Yíká rental — booking #${ref}`);

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const session = await r.json();
    if (!r.ok) return res.status(500).send('Payment setup error: ' + ((session.error && session.error.message) || 'unknown'));

    await at(`Bookings/${rec.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { 'Pay Link': session.url } }) });
    res.redirect(303, session.url);
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
};
