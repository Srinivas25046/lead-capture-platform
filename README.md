# Lead Capture Platform

Lets a customer create an embeddable form widget and install it on any website with one `<script>` tag. Submissions are validated, rate-limited, checked for spam via a honeypot field, enriched with geolocation (via a two-provider fallback chain), stored, and shown back to the widget owner in a dashboard.

## Architecture

```
Widget Owner (authenticated, X-API-Key header)
  -> POST /tenants        create an account, get an API key (shown once)
  -> POST /widgets        create a widget (tenant-scoped)
  -> GET  /widgets        list this tenant's widgets
  -> GET  /dashboard/stats  aggregated, tenant-scoped submission stats

Customer Website (any origin, embeds the widget)
  <script src="widget.js?id=123">
    -> GET /widgets/:id/config   (public, CORS, short-lived cache)
    -> renders a form client-side

Website Visitor
  -> POST /submissions  (public, CORS, per-widget allowed_origins check)
     | OPTIONS preflight handled explicitly (no body on preflight)
     | rate limit check (10 submissions / IP / widget / minute) -> 429 if exceeded
     | required-field validation -> 400 if missing
     | honeypot check -> flagged, not silently dropped, but excluded from dashboard counts
     | geo enrichment: provider A (ip-api.com) -> fail -> provider B (ipapi.co) -> fail -> store anyway, geo fields null
     | store submission (tenant_id denormalized for one-column isolation)
     | enqueue confirmation-email background job (never awaited inline)

Background Worker (separate process, services/jobs.js + worker.js)
  -> polls the jobs table (FOR UPDATE SKIP LOCKED, safe for multiple workers)
  -> retries failed jobs with backoff (1s, 5s, 15s), up to 3 attempts
  -> logs "ALERT:" on permanent failure after 3 attempts
```

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/lead-capture-platform.git
cd lead-capture-platform
cp .env.example .env
docker compose up --build
```

Seed demo data (in a second terminal):
```bash
docker compose exec api node seed.js
```
This prints a tenant API key and a widget id — use both in the examples below.

## Try it live

In a separate, sibling folder (not inside this repo):
```bash
mkdir customer-site && cd customer-site
```
Create `index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>A customer's website</title></head>
<body>
  <h1>Welcome to Acme Corp's homepage</h1>
  <script src="http://localhost:3000/widget.js?id=1"></script>
</body>
</html>
```
Serve it on a different port than the API:
```bash
npx serve -p 5500
```
Open `http://localhost:5500` — the widget renders and accepts a real submission, from a genuinely different origin than the API.

## API reference

| Method | Path | Auth | Request body | Response |
|---|---|---|---|---|
| POST | `/tenants` | None | `{ "name": string }` | `201` `{ id, name, api_key }` — key shown once |
| POST | `/widgets` | `X-API-Key` | `{ type, title, fields, allowed_origins }` | `201` widget object |
| GET | `/widgets` | `X-API-Key` | — | `200` array of this tenant's widgets |
| GET | `/widgets/:id` | `X-API-Key` | — | `200` widget, or `404` if not owned by this tenant |
| GET | `/widgets/:id/config` | None (CORS) | — | `200` public widget config |
| POST | `/submissions` | None (CORS) | `{ widget_id, data: {...} }` | `201` `{ id, status }`, `400`/`403`/`429` on failure |
| GET | `/dashboard/stats` | `X-API-Key` | — | `200` `{ total_submissions, per_widget, by_country }` |
| GET | `/widget.js` | None | — | the embeddable script, 1-year immutable cache |
| GET | `/health` | None | — | `200` `{ status: "ok" }` |

## Design decisions worth knowing

- **API key auth, not OAuth/Supabase**: the hard parts of this capstone are CORS, rate limiting, and resilience — not auth architecture, so a simple hashed-API-key-per-tenant scheme keeps the surface area focused on what's actually being graded.
- **`tenant_id` is denormalized onto `submissions`** even though it's reachable via a join through `widgets`. Every tenant-scoped query can filter with one `WHERE tenant_id = $1`, rather than depending on a correct join every time.
- **Background jobs use a Postgres table + `FOR UPDATE SKIP LOCKED`**, not Redis/Bull. This is a deliberate choice to avoid new infrastructure, since Postgres was already required — and it genuinely supports multiple concurrent workers safely.
- **OPTIONS preflight is routed explicitly**, separate from the POST handler. Express treats `OPTIONS /submissions` and `POST /submissions` as entirely different routes; without an explicit `router.options(...)` entry, the preflight gets no matching route at all and the browser blocks the real request before it's ever sent. This cost real debugging time and is documented in `BUILDLOG.md`.
- **Geo providers are given independent on/off toggles** (`GEO_PROVIDER_A_DISABLED`, `GEO_PROVIDER_B_DISABLED`) specifically so the fallback chain can be proven deterministically, rather than hoping a free API happens to be down during review.

## Limitations

- The honeypot check stores flagged submissions (`spam_flag = true`) rather than silently dropping them entirely — this keeps a record for manual review, at the cost of slightly more storage than a pure "drop" approach. Flagged submissions are excluded from all dashboard counts.
- Geo providers are free-tier (ip-api.com, ipapi.co) with real rate limits — during development, `ipapi.co`'s free tier was genuinely exhausted by repeated testing, which is itself documented as live evidence of the fallback chain surviving a real (not simulated) third-party failure. See `EVIDENCE.md`.
- Email sending is a console-log stub (`worker.js`), not a real provider integration — swapping in a real provider (SendGrid, SES) would only require changing the body of `sendConfirmationEmail`, not the job queue or retry logic around it.
- No visual widget-builder UI, CDN deployment, or support for more than three widget types — explicitly out of scope per the design doc's non-goal.

## What I'd fix with another day

[Fill in honestly once the project is fully done — e.g. a cleaner admin UI for the dashboard instead of raw JSON, or capturing more geo providers to reduce dependence on free-tier rate limits.]
