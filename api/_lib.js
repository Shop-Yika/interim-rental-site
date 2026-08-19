// Shared helpers for the Yíká booking API (Vercel serverless).
// Files starting with "_" are NOT exposed as routes by Vercel — import-only.

const AT_BASE  = process.env.AIRTABLE_BASE_ID;
const AT_TOKEN = process.env.AIRTABLE_TOKEN;
const BUFFER_DAYS = parseInt(process.env.BUFFER_DAYS || '2', 10);

// Pricing — single source of truth, mirrors the storefront + admin tool.
const PRICING = {
  priceCoeff: 0.115, priceExp: 0.402, maxPricePct: 50,
  durations: [4, 7, 14, 30],
  hstPct: 13, dpfPct: 11,
  shipStandard: 12, shipExpress: 20, shipPickup: 0
};

async function at(path, opts = {}) {
  const r = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${AT_TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (!r.ok) throw new Error(`Airtable ${r.status}: ${await r.text()}`);
  return r.json();
}

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

function rentalFee(rrp, adjustPct, days) {
  const base = PRICING.priceCoeff * (Number(rrp) || 0) * Math.pow(Math.max(days, 1), PRICING.priceExp);
  const adj  = base * (1 + (Number(adjustPct) || 0) / 100);
  return round2(Math.min(adj, (Number(rrp) || 0) * PRICING.maxPricePct / 100));
}
function quote(rrp, adjustPct, days, method) {
  const rental   = rentalFee(rrp, adjustPct, days);
  const shipping = method === 'Express' ? PRICING.shipExpress : method === 'Local Pickup' ? PRICING.shipPickup : PRICING.shipStandard;
  const subtotal = round2(rental + shipping);
  const hst      = round2(subtotal * PRICING.hstPct / 100);
  const dpf      = round2(rental * PRICING.dpfPct / 100);
  const total    = round2(subtotal + hst + dpf);
  return { rental, shipping, hst, dpf, total };
}

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

// Build the ordered image list for an item (uploads first, then link field)
function itemImages(f) {
  let images = [];
  const att = f.Image;
  if (Array.isArray(att)) images = att.map(a => a && a.url).filter(Boolean);
  else if (typeof att === 'string' && att.trim()) images = [att.trim()];
  const linkRaw = f.ImageURL || f['Image URL'] || f.ImageLink || '';
  if (linkRaw) String(linkRaw).split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    .forEach(u => { if (!images.includes(u)) images.push(u); });
  return images;
}

function addDays(s, n) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
const overlaps = (s1, e1, s2, e2) => s1 <= e2 && s2 <= e1;

async function slack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); } catch (e) {}
}

module.exports = { at, PRICING, BUFFER_DAYS, round2, rentalFee, quote, addDays, overlaps, slack, slugify, itemImages };
