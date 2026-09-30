# Design Doc — Embeddable Widget & Lead-Capture Platform

## Problem
Let a customer (tenant) create an embeddable form widget and install it on
any website with one <script> tag. Submissions from that widget must be
validated, protected against abuse, enriched with geolocation, stored
safely, and shown back to the tenant in a dashboard — even though the
requests originate from browsers and origins we don't control.

## Data model
See db/schema.sql — four tables: tenants, widgets, submissions,
rate_limit_events. tenant_id is denormalized onto submissions so every
query can enforce isolation with one WHERE clause.

## API surface
Three separate request paths, kept deliberately separate in code:
- Owner (authenticated via X-API-Key header): full widget CRUD + dashboard
- Customer site (public, cached): the embed script + widget config
- Visitor (public, CORS-protected): the submission endpoint

## Layer sketch
routes/   -> HTTP layer only: parse request, call service, format response
services/ -> business logic: validation, rate limiting, enrichment, spam checks
db/       -> raw SQL queries, no business logic

## Non-goal
This capstone will NOT include a visual widget builder UI, a real CDN/domain
deployment, or support for more than two widget types. The grade lives in
the backend's correctness and resilience, not in frontend polish or scale.