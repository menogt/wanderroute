// Runs an existing Netlify function handler as a Vercel Function (Web Request/Response signature).
// Files starting with "_" in /api are not deployed as routes; the four route files import this.
const MAX_BODY_BYTES = 1_000_000;

export function netlifyRoute(loadHandler) {
  async function run(request) {
    const url = new URL(request.url);
    let body = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.text();
      if (body.length > MAX_BODY_BYTES) {
        return Response.json({ code: "INVALID_INPUT", error: "Request is too large." }, { status: 413 });
      }
    }
    try {
      const { handler } = await loadHandler();
      const result = await handler({
        httpMethod: request.method,
        body: body || null,
        rawQuery: url.search.replace(/^\?/, ""),
        queryStringParameters: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(request.headers),
        path: url.pathname,
      });
      const payload = result?.body == null ? null
        : result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body;
      return new Response(payload, { status: result?.statusCode ?? 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(result?.headers ?? {}) } });
    } catch (error) {
      console.error(`[api] ${url.pathname} failed`, error?.message);
      return Response.json({ code: "SERVER_ERROR", error: "Request failed." }, { status: 500 });
    }
  }
  return { GET: run, POST: run };
}
