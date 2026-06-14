// Netlify Function — server-side proxy for the Foursquare Places API.
//
// The browser cannot call Foursquare directly: an authenticated request triggers
// a CORS preflight that Foursquare rejects. This function runs server-side, adds
// the Bearer key (which therefore never reaches the client bundle), and returns
// the JSON to the browser. The client calls it via /api/foursquare?... — mapped
// to this function in netlify.toml.
//
// Set VITE_FOURSQUARE_API_KEY (or FOURSQUARE_API_KEY) in:
//   Netlify → Site settings → Environment variables

export const handler = async (event) => {
  const key =
    process.env.VITE_FOURSQUARE_API_KEY || process.env.FOURSQUARE_API_KEY || "";

  if (!key) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Foursquare API key not configured" }),
    };
  }

  // Forward the incoming query string verbatim (query, ll, radius, limit, ...).
  const qs = event.rawQuery || "";
  const url = `https://places-api.foursquare.com/places/search?${qs}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    });

    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: {
        "Content-Type": "application/json",
        // Cache at the edge for a day — coordinates don't move.
        "Cache-Control": "public, max-age=86400",
      },
      body,
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: `Foursquare proxy failed: ${String(error)}` }),
    };
  }
};
