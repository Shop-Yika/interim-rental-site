# Yíká Interim Booking System — Setup Runbook

This upgrades the interim site from a "request by email" page into a real booking system:
customers see **live availability**, pick a **date range**, and book. You get **Email + Slack**
notifications, **approve** each booking, and the customer pays via **Stripe**. Dates lock automatically.

Nothing here exposes secret keys in the website. All keys live in **Vercel Environment Variables**
(server-side only). You provision the accounts; I provide the code.

---

## The pieces

| Piece | What it does | Who sets it up |
|---|---|---|
| **Airtable base** | Stores your items + all bookings; it's also your new admin | You (I give the schema) |
| **Vercel Functions** (`/api/*`) | Read availability, create bookings, create Stripe checkout | Me (deploys with your site) |
| **Stripe** | Hosted checkout — takes payment, no card data on your site | You (keys) + Me (code) |
| **Slack incoming webhook** | Posts a message when a booking arrives | You (webhook URL) |
| **Airtable automations** | Emails you + emails the customer their pay link | You (2 clicks each, I give the recipe) |

## The flow

```
Customer picks item + dates (live availability)
      │  POST /api/book
      ▼
Airtable "Bookings" row = PENDING  (dates soft-held)
      │  Airtable automation
      ▼
You get EMAIL + SLACK  → review in Airtable
      │  you set Status = APPROVED
      ▼
Airtable automation emails customer a pay link → /api/pay
      │  Stripe hosted Checkout
      ▼
Customer pays → Stripe webhook → Status = CONFIRMED (dates locked)
      (Reject instead → Status = DECLINED, dates freed)
```

---

## Step 1 — Create the Airtable base

Create a base called **Yíká Rentals** with two tables.

### Table: `Items`  (your rental catalogue)
| Field | Type | Notes |
|---|---|---|
| Name | Single line text | required |
| Brand | Single line text | |
| Category | Single line text | |
| Size | Single line text | |
| Color | Single line text | |
| RRP | Currency | retail price (drives rental price) |
| AdjustPct | Number | -20..20, default 0 |
| Image | URL **or** Attachment | photo |
| Active | Checkbox | tick = shown on site |

> You can bulk-import your 25 items from `catalogue.json` (CSV export from your admin tool also works).

### Table: `Bookings`
| Field | Type | Notes / options |
|---|---|---|
| Ref | Autonumber | booking number |
| Item | Link to `Items` | which piece |
| Start | Date | first rental day |
| End | Date | last rental day |
| Days | Number | |
| Fulfilment | Single select | Standard, Express, Local Pickup |
| Rental | Currency | |
| Shipping | Currency | |
| HST | Currency | |
| DPF | Currency | Damage Protection Fee |
| Total | Currency | |
| Name | Single line text | renter |
| Email | Email | renter |
| Phone | Phone | renter |
| City | Single line text | |
| Address | Long text | |
| Message | Long text | |
| Status | Single select | **Pending, Approved, Confirmed, Declined, Cancelled, Returned** |
| Pay Link | URL | filled after approval |
| Paid | Checkbox | set by Stripe webhook |
| Created | Created time | auto |

Keep the single-select option names **exactly** as above — the code matches on them.

## Step 2 — Get your Airtable keys

1. Airtable → **Builder Hub → Personal access tokens → Create token**.
   Scopes: `data.records:read`, `data.records:write`, `schema.bases:read`. Add your base.
2. Copy the **token** (starts `pat…`).
3. Copy your **Base ID** (from the base's API page / URL, starts `app…`).

## Step 3 — Slack webhook (for notifications)

1. Slack → create an app at api.slack.com/apps → **Incoming Webhooks → Activate**.
2. **Add New Webhook to Workspace**, choose the channel (e.g. `#bookings`).
3. Copy the webhook URL (starts `https://hooks.slack.com/services/…`).

## Step 4 — Stripe

1. In your Stripe Dashboard, copy the **Secret key** (`sk_live_…` or `sk_test_…` while testing).
2. After the site is deployed you'll add a **webhook endpoint** pointing to
   `https://rent.shopyika.com/api/stripe-webhook` and copy its **signing secret** (`whsec_…`).
   (I'll tell you exactly when, in Step 6.)

## Step 5 — Add environment variables in Vercel

Vercel → your project → **Settings → Environment Variables**. Add (Production):

```
AIRTABLE_TOKEN      = pat…            (from Step 2)
AIRTABLE_BASE_ID    = app…            (from Step 2)
SLACK_WEBHOOK_URL   = https://hooks.slack.com/services/…   (Step 3)
STRIPE_SECRET_KEY   = sk_…            (Step 4)
STRIPE_WEBHOOK_SECRET = whsec_…       (added in Step 6)
NOTIFY_EMAIL        = admin@shopyika.com   (where booking alerts go)
SITE_URL            = https://rent.shopyika.com
BUFFER_DAYS         = 2
```

These are **server-side only** — never shipped to the browser.

## Step 6 — Deploy & connect Stripe webhook

1. Redeploy the site (it now includes the `/api` folder — Vercel runs those automatically).
2. In Stripe → **Developers → Webhooks → Add endpoint**:
   URL `https://rent.shopyika.com/api/stripe-webhook`, event `checkout.session.completed`.
3. Copy the endpoint's **Signing secret** into the `STRIPE_WEBHOOK_SECRET` env var, and redeploy.

## Step 7 — Airtable automations (notifications + pay link)

Two automations in the base (Airtable → **Automations**):

**A. New booking → notify you**
- Trigger: *When record created* in `Bookings`.
- Action 1: *Send email* to `NOTIFY_EMAIL` with the booking details.
- Action 2: *Send Slack message* (or rely on the function's Slack post — either works).

**B. Approved → email customer their pay link**
- Trigger: *When record matches conditions* → Status is `Approved`.
- Action: *Send email* to the record's `Email`, body includes the link:
  `https://rent.shopyika.com/api/pay?b={Ref}` (insert the `Ref` field).

That's the whole setup. Once Steps 1–5 are done, tell me and I'll confirm the field names match the
code; then we test a booking end-to-end in Stripe **test mode** before going live.

---

### What stays the same
- Your internal admin HTML tool still works offline if you want it, but Airtable now *is* your live admin.
- The branding, catalogue, and pricing formula are unchanged — prices are computed the same way.

### What I still need from you to finish
- Confirm the two table names/fields above (or tell me your tweaks).
- The Slack channel you want alerts in.
- Whether you want to test in Stripe **test mode** first (recommended) before live keys.
