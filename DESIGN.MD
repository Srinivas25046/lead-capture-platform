# Design: Embeddable Widget and Lead-Capture Platform

## Problem

Let a customer (a tenant) create a form widget and install it on any website with one `<script>` tag. Submissions from that widget must be validated, protected from abuse, enriched with the visitor's location, stored safely, and shown back to the tenant in a dashboard. The requests come from browsers on origins we do not control, so the system has to be correct about cross-origin access, tolerant of flaky third parties, and strict about which tenant owns which data.

## Data model

Five tables (`db/schema.sql`):

| Table | Purpose | Notes |
|---|---|---|
| `tenants` | One row per customer | `api_key_hash` stores a SHA-256 hash; the raw key is shown once |
| `widgets` | Widget configuration | `fields` and `allowed_origins` are JSONB; `config_version` increments on update; indexed on `tenant_id` |
| `submissions` | One row per visitor submission | `tenant_id` is denormalised from the widget; stores geo fields, `geo_provider_used`, `spam_flag`; indexed on `widget_id`, `tenant_id`, `created_at` |
| `rate_limit_events` | One row per accepted submission attempt | Indexed on `(ip_address, created_at)` for the rolling-window count |
| `jobs` | Background job queue | `status`, `attempts`, `max_attempts`, `last_error`, `run_at`; indexed on `(status, run_at)` |

`tenant_id` lives on `submissions` so that every tenant-scoped read is a single-column filter, which keeps isolation easy to audit.

## API surface

Three request paths that deliberately share almost no code:

1. **Owner (authenticated, `X-API-Key`).** Widget create, read, update, delete, and the dashboard. Every query filters by the caller's `tenant_id`.
2. **Customer site (public, cacheable).** `GET /widget.js` (versioned, immutable) and `GET /widgets/:id/config` (short cache, origin-checked).
3. **Visitor (public, CORS-protected).** `POST /submissions`, with its `OPTIONS` preflight.

## Layer sketch

```
routes/    HTTP only: parse the request, call a service, shape the response
services/  business logic: auth, widgets, CORS decision, rate limit, spam check, geo lookup, job queue
db/        connection pool, schema, migration
worker.js  separate process that runs queued jobs
```

Routes never contain SQL. Services never touch `req` or `res`, with the CORS and auth middleware as the deliberate exceptions.

## Key decisions

- **Per-widget origin allow-list** instead of a global CORS policy, so a widget only works on the sites its owner listed.
- **Postgres job table** with `FOR UPDATE SKIP LOCKED` instead of Redis, to avoid new infrastructure while staying safe with multiple workers.
- **Geo enrichment is best-effort.** Provider A, then provider B, then store anyway. It can never fail a submission.
- **Side effects are queued.** The confirmation email is enqueued and never awaited, so its failure cannot affect the visitor's response.

## Non-goal

This project will not include a visual widget builder UI, a CDN or custom-domain deployment, or support for more than three widget types. The value here is in the backend's correctness and resilience, not frontend polish or scale.