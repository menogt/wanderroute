# WanderRoute Travel Plan App

React + Vite travel planner for Sri Lanka itineraries. The app uses Netlify
Functions for server-side API calls that need private credentials.

## Install Dependencies

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your own values:

```bash
# Server-side only - never exposed to the browser
GROQ_API_KEY=
VITE_FOURSQUARE_API_KEY=

# Public by design (Supabase anon key is safe client-side; RLS is the boundary)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Optional affiliate tracking
VITE_BOOKING_AFFILIATE_ID=
VITE_AGODA_CID=
```

`VITE_*` variables are inlined into the browser bundle at build time and are
therefore public. Never put the Groq key in a `VITE_*` variable — use
`GROQ_API_KEY`, which only `netlify/functions/generate-itinerary.js` reads.

> `VITE_FOURSQUARE_API_KEY` keeps its `VITE_` prefix for backwards
> compatibility, but it is only ever read server-side (the Vite dev proxy in
> `vite.config.ts` and the Netlify function). It is not sent to the browser.

## Local Development: use `netlify dev`, not `npm run dev`

AI itinerary generation goes through `/api/generate-itinerary`, which only
exists as a Netlify Function. Plain `npm run dev` does not serve that route, so
the app silently falls back to the built-in static itinerary. For the full
experience run:

```bash
npm install -g netlify-cli
netlify dev
```

`npm run dev` is still fine for pure UI work — maps, Foursquare and Supabase all
work, only AI generation falls back.

## Configure Groq In Netlify

In Netlify, open your site and go to:

`Site configuration` -> `Environment variables`

Add:

```bash
GROQ_API_KEY=your-groq-api-key
```

Deploy after saving the variable so the `generate-itinerary` function can read
it from `process.env.GROQ_API_KEY`.

## Production Build

```bash
npm run build
```

Netlify uses the build settings in `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
```
