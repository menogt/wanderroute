# WanderRoute handover

Last audited: 25 October 2026 (Asia/Colombo). This folder is the durable project context for an account migration. Read this file, PRODUCT_VISION, CURRENT_STATUS and QA_BACKLOG before changing code. Read AGENTS.md and CLAUDE.md too, but note the stale claims listed below.

Repository: https://github.com/menogt/wanderroute
Production: https://wanderroute.netlify.app/
Actual checkout on this machine: `G:/Menaka/App Creating/Travel plan app`.
Research/artifact workspace: `C:/Users/USER/Documents/ChatGPT/Wanderroute`.

The application is a normal Sri Lanka travel product. Preserve existing work, environment files and the pre-existing untracked `.claude/`. Never reset, clean, stash, force-push, rewrite history or delete unrelated files to simplify a task.

Planning V2 is the primary experience with no visibility environment flag. Classic remains a secondary option and the minimum useful feature baseline. V2 can produce a clearly labeled limited draft when AI is unavailable. A preferred draft is not a quote submission or booking.

Read ARCHITECTURE for the actual code paths; CLAUDE.md incorrectly says browser-side Groq generation is still active. App.tsx now imports Classic generation from aiService.ts and V2 uses a Netlify endpoint. Never restore a browser Groq secret.

Read DESIGN_HANDOVER for the authoritative Explore/Classic map and approved PDF. Read ENVIRONMENT_SETUP for safe local testing. NEXT_STEPS defines unfinished work; do not infer completion from a historical milestone or test count. NEW_ACCOUNT_START_PROMPT is ready to paste into a new chat.
