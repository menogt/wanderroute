// Production web server for hosts without Netlify (e.g. DigitalOcean App Platform).
// Serves the Vite build in dist/ with an SPA fallback, and exposes the existing
// Netlify function handlers at the same /api/* paths netlify.toml rewrites, so the
// browser code and the functions run unchanged. No dependencies beyond Node.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY_BYTES = 1_000_000;

// Same mapping as the [[redirects]] in netlify.toml.
const FUNCTIONS = {
  "/api/foursquare": "foursquare.js",
  "/api/generate-itinerary": "generate-itinerary.js",
  "/api/generate-v2-itinerary": "generate-v2-itinerary.js",
  "/api/quote-request": "quote-request.js",
};
const handlers = new Map();
async function loadHandler(file) {
  if (!handlers.has(file)) {
    const module = await import(pathToFileURL(join(ROOT, "netlify", "functions", file)).href);
    handlers.set(file, module.handler);
  }
  return handlers.get(file);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error("Body too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks).toString("utf8") : null));
    req.on("error", reject);
  });
}

async function handleApi(req, res, url, file) {
  try {
    const handler = await loadHandler(file);
    const body = req.method === "GET" || req.method === "HEAD" ? null : await readBody(req);
    const result = await handler({
      httpMethod: req.method,
      body,
      rawQuery: url.search.replace(/^\?/, ""),
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: req.headers,
      path: url.pathname,
    });
    const status = result?.statusCode ?? 200;
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", ...(result?.headers ?? {}) };
    const payload = result?.body == null ? "" :
      result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body;
    res.writeHead(status, headers).end(payload);
  } catch (error) {
    const status = error?.status ?? 500;
    console.error(`[api] ${url.pathname} failed`, error?.message);
    res.writeHead(status, { "Content-Type": "application/json" })
      .end(JSON.stringify({ code: status === 413 ? "INVALID_INPUT" : "SERVER_ERROR", error: "Request failed." }));
  }
}

async function sendFile(res, path, method) {
  const type = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  // Vite emits content-hashed files under /assets; everything else may change per deploy.
  const cache = path.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache";
  const data = await readFile(path);
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
  res.end(method === "HEAD" ? undefined : data);
}

async function handleStatic(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  const target = normalize(join(DIST, pathname));
  if (target !== DIST && !target.startsWith(DIST + sep)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(target)).isFile()) return await sendFile(res, target, req.method);
  } catch { /* fall through to SPA fallback */ }
  // SPA fallback, like the final /* rewrite in netlify.toml. Missing assets stay 404.
  if (pathname.startsWith("/assets/") || extname(pathname)) { res.writeHead(404).end("Not found"); return; }
  await sendFile(res, join(DIST, "index.html"), req.method);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const file = FUNCTIONS[url.pathname.replace(/\/$/, "")];
  if (file) return handleApi(req, res, url, file);
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  try { await handleStatic(req, res, url); }
  catch (error) { console.error("[static]", error?.message); res.writeHead(500).end(); }
}).listen(PORT, () => console.log(`WanderRoute listening on port ${PORT}`));
