// POST /api/stripe-webhook — Stripe calls this after successful payment.
// Verifies the signature, then marks the booking Paid + Confirmed (dates lock).
const crypto = require('crypto');
const { at, slack } = require('./_lib');

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let d = ''; req.on('data', c => (d += c)); req.on('end', () => resolve(d)); req.on('error', reject);
  });
}

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const raw = await readRaw(req);
  const sig = req.headers['stripe-signature'] || '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // verify Stripe signature (t=timestamp, v1=hmac)
  try {
    const parts = Object.fromEntries(sig.split(',').map(kv => kv.split('=')));
    const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(parts.v1 || '');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('bad sig');
  } catch (e) {
    return res.status(400).send('signature verification failed');
  }

  let event; try { event = JSON.parse(raw); } catch { return res.status(400).end(); }

  if (event.type === 'checkout.session.completed') {
    const recId = event.data.object.client_reference_id;
    try {
      await at(`Bookings/${recId}`, { method: 'PATCH', body: JSON.stringify({ fields: { Paid: true, Status: 'Confirmed' } }) });
      await slack(`:white_check_mark: *Payment received* — booking confirmed and dates locked.`);
    } catch (e) {}
  }
  res.status(200).json({ received: true });
};

// Stripe needs the raw body for signature verification
handler.config = { api: { bodyParser: false } };
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
