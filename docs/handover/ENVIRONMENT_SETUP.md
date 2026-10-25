# Environment setup

Checkout https://github.com/menogt/wanderroute and inspect actual branch/status first. Existing Windows checkout is `G:/Menaka/App Creating/Travel plan app`. Use Node22.6+ for native TypeScript node:test support (current session used installed Node26 runtime); install from the lockfile on a new machine only when dependencies are absent. No extra test dependencies were added for browser verification.

Commands from the repository:
```
npm test
npx tsc --noEmit -p tsconfig.json
npm run build
git diff --check
npm run dev -- --host 127.0.0.1 --port 4318
```
There is no lint script. `npx --offline tsc` uses the already installed compiler when registry access is unnecessary. Vite dev alone does not implement Netlify functions. Port5173 was restricted on this Windows host;4318 worked. Preserve CRLF for edited existing sources.

Client configuration: existing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are public Supabase connection settings with RLS/column grants still essential. Server runtime configuration includes GROQ_API_KEY and existing service-specific/quote settings. Read existing config names without printing values. Never remove unrelated environment variables, upload env files or put a secret in Vite/browser code. No VITE_ENABLE_PLANNING_V2 is required or should be reintroduced.

For local browser QA, launch a separate dev process with an isolated localhost Supabase URL and dummy public key, intercept /rest/v1 requests and local /api generation responses. Classic generation may otherwise call saveTrip and write production trips. Never submit a real quote, booking, payment or notification as a test. Mocked AI failure demonstrates fallback only; it does not verify real AI success.

Already installed alternative on this host: Playwright1.62.1 under `C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`, installed Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Launch an ephemeral browser context, never the user's profile or guessed debugging port. The native computer-use helper failed because its pipe was unavailable. Existing alternative avoids new dependencies. Paths are machine-specific; discover on migration rather than assuming.

Evidence outside repo: `C:/Users/USER/Documents/ChatGPT/Wanderroute/implementation/` contains verification logs, browser harness/results/screenshots, PDF fixture scripts/PDFs/renders and progress.md. Transfer if needed; handover must remain intelligible without these files. Bundled Python has pypdf/pdfplumber; Poppler provides independent PDF extraction/rendering. No production SQL or config changes are required by this verification milestone.
