# WanderRoute Travel Plan App

React + Vite travel planner for Sri Lanka itineraries. The app uses Netlify
Functions for server-side API calls that need private credentials.

## Install Dependencies

```bash
npm install
```

## Environment Variables

Create a local `.env` file from `.env.example` and fill in your own values:

```bash
GROQ_API_KEY=
VITE_FOURSQUARE_API_KEY=
VITE_GOOGLE_MAPS_API_KEY=
```

`VITE_*` variables are public in Vite and can be included in the browser bundle.
Do not put the Groq API key in any `VITE_*` variable. Use `GROQ_API_KEY` only.

## Run Locally With Netlify Functions

Install and use the Netlify CLI so `/api/generate-itinerary` and
`/api/foursquare` are routed through local functions:

```bash
npm install
netlify dev
```

The app will be available at the local URL printed by Netlify CLI.

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
