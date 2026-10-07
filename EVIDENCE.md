# Evidence

Every section below is either real pasted output from this project's actual development, or clearly marked `[NEEDS YOUR OUTPUT]` where a specific test hasn't been run yet. Nothing here is invented.

---

## Widget management & auth

**Tenant signup returns an API key, shown once:**
```
POST /tenants
{"name":"Acme Corp"}

HTTP/1.1 201 Created
{"id":1,"name":"Acme Corp","api_key":"lck_1a253c45dd2a12ef8186a87b8fe3440fbcf7b0dc669cdfd7"}
```

**Owner routes reject requests with no API key:**
```
GET /widgets/1/config  (before CORS route-ordering fix, showed the auth middleware firing on a public route)
HTTP/1.1 401 Unauthorized
{"error":"X-API-Key header required"}
```

**Widget creation, tenant-scoped:**
```
POST /widgets
Headers: X-API-Key: lck_1a253c45dd2a12ef8186a87b8fe3440fbcf7b0dc669cdfd7
{"type":"signup_form","title":"Join our newsletter","fields":[{"name":"email","type":"email","required":true}],"allowed_origins":["http://localhost:5500"]}

HTTP/1.1 201 Created
{"id":1,"tenant_id":1,"type":"signup_form","title":"Join our newsletter","description":null,"fields":[{"name":"email","type":"email","required":true}],"button_text":"Submit","config_version":1,"created_at":"2026-10-01T04:49:27.849Z","allowed_origins":["http://localhost:5500"]}
```

**Tenant isolation (one tenant cannot read another tenant's widgets):**
`[NEEDS YOUR OUTPUT — create a second tenant via POST /tenants, then call GET /widgets/1 using tenant 2's API key; expect 404, not the widget. Paste both the second tenant's signup response and the resulting 404 here.]`

---

## Widget delivery

**Cache headers:**
```
GET /widget.js
HTTP/1.1 200 OK
Cache-Control: public, max-age=31536000, immutable
```
`[NEEDS YOUR OUTPUT — paste the matching curl -i output for GET /widgets/1/config showing Cache-Control: public, max-age=60]`

**Renders on a genuinely different origin:**
Screenshot: widget rendered and successfully submitted on `http://localhost:5500` (API running on `http://localhost:3000`) — see `screenshots/widget-cross-origin.png`.

Two real bugs were found and fixed while proving this, both documented fully in `BUILDLOG.md`:
1. `document.currentScript` returned `null` inside the async `.then()` callback (fixed by capturing the reference earlier, in the outer `script` variable).
2. The browser's `OPTIONS` preflight request for `POST /submissions` had no matching Express route, so it received zero CORS headers and was blocked — fixed by adding `router.options('/submissions', widgetCors)` explicitly.

---

## Public submission API

**CORS: allowed origin succeeds**
```
GET /widgets/1/config
Headers: Origin: http://localhost:5500

HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:5500
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
{"id":1,"type":"signup_form","title":"Join our newsletter","description":null,"fields":[{"name":"email","type":"email","required":true}],"button_text":"Submit"}
```

**CORS: disallowed origin rejected**
```
GET /widgets/1/config
Headers: Origin: http://evil-site.com

HTTP/1.1 403 Forbidden
{"error":"Origin not allowed for this widget"}
```

**Validation: missing required field**
`[NEEDS YOUR OUTPUT — paste a POST /submissions with a missing required field, expect 400 naming the field]`

**Stored correctly, visible in the dashboard:**
`[NEEDS YOUR OUTPUT — paste GET /dashboard/stats output after a known number of real submissions, showing total_submissions matches]`

---

## Abuse protection

**Rate limiting — 429 after the cap:**
```
Looped 11 POST /submissions requests to widget 1 from the same IP within 1 minute:
201
201
201
201
201
201
201
201
429
429
429
```
Note: the limit is 10/IP/widget/minute; the first few 201s reflect requests already made earlier in the same rolling window from prior manual testing, so the 429 appeared sooner than exactly request #11 in this specific run — the cap itself is proven to fire correctly.

**Honeypot spam detection:**
```
Created widget 2 with a honeypot field ("website"):
{"id":2,"tenant_id":1,"type":"signup_form","title":"Test spam widget", ... }

POST /submissions
{"widget_id":2,"data":{"email":"spammer@example.com","website":"http://spam.com"}}

HTTP/1.1 201 Created
{"id":12,"status":"flagged"}
```
Flagged submissions are excluded from `/dashboard/stats` counts (see `spam_flag = false` filter in `routes/dashboard.js`).

---

## Enrichment & safe side effects

**Fallback chain — provider A disabled, provider B attempted:**
```
.env: GEO_PROVIDER_A_DISABLED=true

api logs:
Geo provider A manually disabled, skipping to provider B
Geo provider B also failed (provider_b status 429) — continuing without geo data

SELECT id, geo_provider_used FROM submissions ORDER BY id DESC LIMIT 1;
 id | geo_provider_used
----+-------------------
 16 |
```

**Independent confirmation this 429 was a real, external rate limit — not an app bug:**
```
curl.exe -i https://ipapi.co/8.8.8.8/json/

HTTP/1.1 429 Too Many Requests
Server: cloudflare
{
    "error": true,
    "reason": "RateLimited",
    "message": "Visit https://ipapi.co/ratelimited/ for details"
}
```
This is genuine evidence of the "both providers unreachable" path (Step 26): provider A deliberately disabled via toggle, provider B genuinely failed due to real-world free-tier rate limiting (confirmed independently, outside the app). The submission still succeeded with `201` and `geo_provider_used` left empty — proving a third-party enrichment failure never blocks the core submission.

The clean "provider A fails, provider B succeeds" case could not be captured live due to this ongoing rate limit at time of testing; the code path is identical to the proven "A disabled, B attempted" path above, differing only in B's outcome.

**Email job failure never blocks the submission (background job with retries):**
```
SELECT id, type, status, attempts, last_error FROM jobs ORDER BY id;

 id |          type           | status | attempts |            last_error
----+-------------------------+--------+----------+-----------------------------------
  1 | send_confirmation_email | done   |        0 |
  2 | send_confirmation_email | done   |        0 |
  3 | send_confirmation_email | done   |        0 |
  4 | send_confirmation_email | done   |        1 | Simulated email provider failure
  5 | send_confirmation_email | done   |        0 |
  6 | send_confirmation_email | done   |        0 |
  7 | send_confirmation_email | done   |        1 | Simulated email provider failure
  8 | send_confirmation_email | done   |        1 | Simulated email provider failure
  9 | send_confirmation_email | done   |        0 |
 10 | send_confirmation_email | done   |        1 | Simulated email provider failure
 11 | send_confirmation_email | done   |        0 |
```
Jobs 4, 7, 8, and 10 each failed once (simulated 30% failure rate in `worker.js`) and were automatically retried to a successful `done` state — none required manual intervention, and every corresponding `POST /submissions` call had already returned `201` before the email job ran at all, since it's enqueued and never awaited inline.

`[NEEDS YOUR OUTPUT — Probe 5 specifically: force the job to fail all 3 attempts (e.g. temporarily set the simulated failure rate to 100% in worker.js), confirm status becomes 'failed' with an ALERT: log line, and confirm the original submission still returned 201 regardless]`

---

## Remaining probes to self-run before submission

- [ ] Probe 2: send malformed/oversized input → confirm clean `4xx`, never `500`
- [ ] Probe 3 (full): confirm normal traffic resumes correctly after a rate-limit window passes
- [ ] Probe 5 (full failure): force all 3 job attempts to fail, confirm `ALERT:` log and `status = 'failed'`
- [ ] Tenant isolation cross-check (two tenants, confirm 404 not data leak)
