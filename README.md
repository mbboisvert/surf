# Surfing

A public surf forecast. No accounts.

Open the world map and click anywhere. The five nearest named breaks are listed by distance, including inland. A break shows swell, wind, and tide for the current hour and the next 48 hours, in feet and knots, with a 1–10 score and one line on why.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

```bash
npm test
npm run build
npm start
```

## Forecast

Swell and wind come from [Open-Meteo](https://open-meteo.com/). Tide comes from a NOAA reference station when one is within 120 km. Everywhere else uses a global harmonic model (M2, S2, N2, K1, O1) with regional amplitudes. That model is approximate, especially the time of high water, and it is labeled as such.

The score uses swell height, period, and wind. Light wind and a longer period raise it. When a break has an ocean-facing direction, offshore wind helps and onshore wind hurts.

## Breaks

`public/breaks.json` ships with the site, about 4,700 named breaks. It is OpenStreetMap surf spots plus named ocean beaches where that list is thin, with a few well-known breaks added so the coasts stay covered. © OpenStreetMap contributors, [Open Database License](https://www.openstreetmap.org/copyright).

Regenerate it with `npm run data`.

A camera link shows up only when a break already has its own https camera URL.

## News

The Inertia, Surfer, and Stab. The Inertia’s RSS URL currently returns an empty file, so that source is read from their Atom feed.

## Shop

Tee, hat, and wax are placeholders. Checkout is Shopify’s, not a cart in this app. Copy `.env.example` to `.env.local` and set:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- `SHOPIFY_VARIANT_TEE`
- `SHOPIFY_VARIANT_HAT`
- `SHOPIFY_VARIANT_WAX`

Variant values are ProductVariant gids, or the numeric id. Until those are set, checkout explains that and does not charge.
