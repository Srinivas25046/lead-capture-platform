# Build Log

Written honestly, as the project was actually built — including the mistakes, not just the finished result.

## Where AI (Claude) helped

- Generated the initial project structure, data model, and API surface sketch in Phase 1, based on the capstone's own requirements.
- Wrote the first drafts of the auth middleware, CORS middleware, rate limiter, geo fallback chain, and background job worker.
- Walked through debugging a Docker networking failure (`EAI_AGAIN` resolving the `db` hostname) that turned out, after extensive diagnosis, to actually be a completely different problem: `todo-api-api-1`, a container from an unrelated earlier project, had been running continuously for 6 days and was holding port 3000, silently preventing this project's `api` container from ever fully starting or joining its network. The DNS error was a confusing downstream symptom, not the real cause.
- Caught and fixed a non-idempotent `schema.sql` (missing `IF NOT EXISTS` on several `CREATE TABLE`/`CREATE INDEX` statements), which failed the second time the migration script was run.

## Where AI was wrong, or I had to fix something it suggested

- **The widget script's DOM insertion was broken.** The first version used `document.currentScript.parentNode` inside an async callback — but `document.currentScript` is only valid during a script's initial synchronous execution and had already reset to `null` by the time the `fetch().then()` callback ran. Fixed by capturing the script reference in a variable (`script`) at the top of the file, before any async code, and using that instead.
- **The CORS middleware didn't handle preflight requests correctly.** The route was only registered for `POST /submissions`, so the browser's `OPTIONS` preflight (a separate HTTP method) matched no route at all, received no CORS headers, and the browser blocked the real request before it was ever sent. This wasn't obvious from the error message alone ("No 'Access-Control-Allow-Origin' header is present") — it required actually understanding that preflight requests carry no body, so the original per-widget origin lookup couldn't run on them anyway, and needed its own explicit route (`router.options('/submissions', widgetCors)`).
- **Several files were written but never actually wired into `server.js`.** `routes/tenants.js`, `routes/widgets.js`, and `routes/public.js` were each created correctly but needed an explicit `app.use(require(...))` line added separately — more than once, a route returned `404 Cannot POST /x` simply because that line was missing, not because the route logic itself was wrong.
- **Route ordering caused a real bug**, not just a missing-wiring one: `routes/widgets.js` applies `router.use(requireAuth)` to everything under `/widgets`, including `/widgets/:id/config`. When `widgets.js` was registered before `public.js` in `server.js`, the auth check intercepted the public config route and returned `401` before CORS logic ever ran. Fixed by registering `public.js` before `widgets.js`.

## What I changed from what was first suggested

- Added `GEO_PROVIDER_A_DISABLED` and `GEO_PROVIDER_B_DISABLED` environment variable toggles to `geoLookup.js`, specifically so the fallback chain could be proven on command rather than relying on a real free API happening to be down during testing or review.
- During actual testing, `ipapi.co`'s free tier was genuinely rate-limited (confirmed independently with a direct `curl` outside the app, which returned the identical `429 RateLimited` error). Rather than treating this as a blocker, I used it as stronger, unplanned evidence for the "both providers unreachable" resilience case — and documented in `EVIDENCE.md` that the "provider A fails, B succeeds" case is logically proven by the code path even though it couldn't be captured live that day.
- The honeypot check stores flagged submissions (`spam_flag = true`) rather than silently dropping them, trading slightly more storage for the ability to manually review false positives later.
