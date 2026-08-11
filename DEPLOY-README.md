# Yíká — Interim Site (Deploy Guide)

This is a temporary, public **browse-and-request** site to run while the full website is built.
Shoppers browse the collection and send a rental request. **No payment or card details are taken on the site** — you confirm availability and arrange payment through your internal admin tool, exactly as you do now.

## The files

| File | What it is |
|---|---|
| `index.html` | The public website. Self-contained (branding, fonts, logic). |
| `catalogue.json` | The items + prices shown on the site. Now contains your **real 25 pieces** from the backup. Re-publish from the admin tool to update. |
| `yika-rentals-internal.html` | Your internal admin tool (not uploaded — keep private). |

## One-time setup (2 minutes)

Open `index.html` in a text editor. Near the top of the `<script>` there are three lines:

```
const REQUEST_EMAIL = "hello@yika.inc";   // <- change to the email that should receive requests
const FORM_ENDPOINT = "";                 // <- optional (see below)
const DATA_URL      = "catalogue.json";   // leave as-is
```

1. Set `REQUEST_EMAIL` to the address that should receive rental requests.
2. (Optional but recommended) Set `FORM_ENDPOINT` — see "How requests reach you" below.

Save the file.

## How requests reach you

- **Default (no setup):** when a shopper submits, their email app opens with the request pre-filled, addressed to `REQUEST_EMAIL`. They hit send. Works everywhere, but relies on them having a mail app.
- **Recommended (Formspree, free):** create a free form at https://formspree.io, copy its endpoint (looks like `https://formspree.io/f/abcmyz`), and paste it into `FORM_ENDPOINT`. Now requests are delivered straight to your inbox in the background — no mail app needed. Formspree's free tier covers a low volume of submissions.

Either way, **you receive**: item, dates, rental period, estimated total, and the renter's name/email/phone/city/address/message. You then approve it and take payment through your admin tool.

## Publishing your real inventory

The site ships with a small **sample** `catalogue.json` so it previews out of the box. To show your real items:

1. Open the admin tool (`yika-rentals-internal.html`) → **Catalogue** → **Publish to website**.
2. It downloads a fresh `catalogue.json` (your items, images, and pricing).
3. Upload that file to your website folder, replacing the sample. Done — prices are recalculated from your live pricing formula.

Re-publish any time you add or change items.

## Event photos for the hero carousel

The homepage hero is a rotating carousel of your event photos. To add them:

1. Create a folder named `event` next to `index.html`.
2. Put your photos in it named `hero-1.jpg`, `hero-2.jpg`, `hero-3.jpg`, … (landscape/wide images work best — roughly 1600×1000).
3. If your filenames or count differ, open `index.html` and edit the `HERO_IMAGES` line near the top of the `<script>` to match, e.g.:

```
const HERO_IMAGES = ["event/opening-night.jpg","event/runway.jpg","event/guests.jpg"];
```

The carousel auto-rotates with arrows and dots. **Until you add photos, the hero shows a branded plum gradient** (no broken images) — so the site looks finished even before the photos are up. Any listed image that can't be found is simply skipped.

> Note: the display type is now **Newsreader** (loaded from Google Fonts) at a 60pt hero size, paired with Averia Libre for body text.

## Putting it online (your hosting)

Upload `index.html`, `catalogue.json`, and your `event/` photo folder to the same folder on your host (or point a subdomain such as `rent.yika.inc` / `second-season.yika.inc` at it). Any static host works — no server, database, or build step needed.

> Tip: open `index.html` by double-clicking to preview locally. Some browsers block the `catalogue.json` fetch from a `file://` path — that's fine, it falls back to the sample. Once it's on real hosting (an `https://` address), it loads your published `catalogue.json` normally.

## What this interim site intentionally does NOT do

- No online payments and **no card/bank data collected** (keeps you clear of Stripe/PCI/CPA obligations until the real site).
- No live availability calendar — availability is confirmed by you on each request. (The site can't see your admin tool's bookings, which live privately in your browser.)
- No shopper accounts.

These are the deliberate trade-offs of a fast, safe interim site. The full booking + payment experience is the job of the real website.
