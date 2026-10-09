# Lead Capture Platform

A backend for an embeddable lead-capture widget. A customer (tenant) creates a form widget, pastes one `<script>` tag into any website, and visitors' submissions flow back to a hardened API: validated, rate-limited, spam-checked, enriched with geolocation through a two-provider fallback chain, stored per tenant, and summarised in a dashboard.

The requests come from browsers on origins this service does not control, so most of the engineering is in CORS, abuse protection, tenant isolation and graceful degradation.

## Architecture

```
Widget owner (authenticated with X-API-Key)
  POST   /tenants               create an account, receive an API key (shown once)
  POST   /widgets               create a widget, receive its embed snippet
  GET    /widgets, /widgets/:id read widgets (this tenant only)
  PUT    /widgets/:id           update a widget
  DELETE /widgets/:id           delete a widget
  GET    /dashboard/stats       tenant-scoped submission stats

Customer website (any origin)
  <script src=".../widget.js?id=1&v=2">
    GET /widget.js                public, versioned, 1-year immutable cache
    GET /widgets/:id/config       public, CORS-checked, 60-second cache
    renders the form in the page

Visitor
  POST /submissions  (public)
    1. OPTIONS preflight answered by an explicit OPTIONS route
    2. origin checked against this widget's allowed_origins   -> 403 if not listed
    3. per-IP, per-widget rate limit (10 per minute)           -> 429 if exceeded
    4. payload validated (size, JSON, required fields)         -> 400 / 413
    5. honeypot field checked                                  -> stored with spam_flag = true
    6. geo enrichment: provider A -> provider B -> store anyway with null geo
    7. submission stored (tenant_id denormalised for isolation)
    8. confirmation email queued as a background job, never awaited

Background worker (separate container)
  polls the jobs table with FOR UPDATE SKIP LOCKED
  retries failures with backoff (1s, 5s, 15s), 3 attempts
  logs "ALERT:" and marks the job failed after the third failure
```

Stack: Node.js 22, Express 5, PostgreSQL 16, Docker Compose.

## Setup

```bash
git clone https://github.com/Srinivas25046/lead-capture-platform.git
cd lead-capture-platform
cp .env.example .env
docker compose up --build
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

In a second terminal, create the tables and seed demo data:

```bash
docker compose exec api node db/migrate.js
docker compose exec api node seed.js
```

`seed.js` prints a tenant API key and a widget id. Keep both. The migration is idempotent, so running it twice is safe.

## Try the widget on a second origin

```bash
cd customer-site
npx serve -p 5500
```

Open `http://localhost:5500`. The page is served from port 5500 while the API runs on port 3000, so the widget loads and submits across origins. The seed script allows `http://localhost:5500` as an origin for the demo widget.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Compose sets it for the containers. |
| `PUBLIC_BASE_URL` | Base URL used when generating embed snippets |
| `GEO_PROVIDER_A_DISABLED` | `true` forces provider A to be skipped (for proving the fallback) |
| `GEO_PROVIDER_B_DISABLED` | `true` forces provider B to be skipped |
| `GEO_MOCK` | `true` replaces both live geo APIs with deterministic mock answers |

## API reference

| Method | Path | Auth | Success | Failure responses |
|---|---|---|---|---|
| POST | `/tenants` | none | `201` `{ id, name, api_key }` | `400` |
| POST | `/widgets` | `X-API-Key` | `201` widget plus `embed_snippet` | `400`, `401` |
| GET | `/widgets` | `X-API-Key` | `200` array | `401` |
| GET | `/widgets/:id` | `X-API-Key` | `200` widget | `401`, `404` (also for another tenant's widget) |
| PUT | `/widgets/:id` | `X-API-Key` | `200` widget | `400`, `401`, `404` |
| DELETE | `/widgets/:id` | `X-API-Key` | `204` | `401`, `404` |
| GET | `/widgets/:id/config` | none, CORS | `200` public config | `403`, `404` |
| POST | `/submissions` | none, CORS | `201` `{ id, status }` | `400`, `403`, `404`, `413`, `429` |
| GET | `/dashboard/stats` | `X-API-Key` | `200` `{ total_submissions, per_widget, by_country }` | `401` |
| GET | `/widget.js` | none | `200` script | n/a |
| GET | `/health` | none | `200` | n/a |

Errors are always JSON, including malformed bodies (`400`) and oversized bodies (`413`, limit 10kb).

## Design decisions

- **Simple API-key auth.** Tenants get a random key shown once and stored as a SHA-256 hash. The hard parts of this system are CORS, abuse protection and resilience, so the auth scheme stays small.
- **`tenant_id` on `submissions`.** It is duplicated from the widget on purpose, so every tenant query can filter with a single `WHERE tenant_id = $1` rather than depending on a correct join.
- **Preflight needs its own route.** Express treats `OPTIONS /submissions` and `POST /submissions` as different routes, and a preflight carries no body, so the widget cannot be looked up from it. The middleware answers preflights first and does the strict per-widget origin check on the real request.
- **Postgres-backed job queue.** `FOR UPDATE SKIP LOCKED` lets several workers pull jobs safely with no extra infrastructure.
- **Two cache lifetimes.** `widget.js` is immutable for a year and versioned by a query parameter. The config can change at any time, so it caches for 60 seconds.
- **Identical visitor response for spam.** A bot that fills the honeypot gets the same success message as a person, so it learns nothing.

## Limitations

- Flagged (honeypot) submissions are stored with `spam_flag = true` and excluded from dashboard counts, rather than being dropped entirely. This keeps a record for review at the cost of some storage.
- The two geo providers are free tiers (ip-api.com and ipapi.co). During testing ipapi.co returned `429 RateLimited` for a long stretch, which is why a deterministic mock mode exists.
- Confirmation email is a console-log stub in `worker.js`. It simulates a 30% failure rate so the retry path can be exercised.
- Rate limiting counts rows in Postgres. That is correct but would not scale to very high traffic without a faster store.
- No visual widget builder, CDN or custom domains. These are out of scope, as stated in `DESIGN.md`.

## Repository documents

- `DESIGN.md` – the one-page design (problem, data model, API surface, layers, non-goal)
- `EVIDENCE.md` – one proof per requirement
- `BUILDLOG.md` – where AI helped, where it was wrong, what changed
- `capstone.yaml` – run and seed commands and endpoints for review