# ADR-0002 — Cloudflare D1 Database

**Date:** 2026-09-24 · **Status:** Accepted · **Deciders:** Owner + Cline

## Context

Workers cannot open raw TCP to classic Postgres; realistic options were D1,
Turso (libSQL), or Supabase Postgres. Workload: few hundred rows growing
~1KB/day/user.

## Decision

**Cloudflare D1** — plain SQL schema in `migrations/` (git = source of truth),
migrations applied via wrangler, all access behind a repository layer,
APAC location hint for Australian users.

## Alternatives considered

- **Turso** — lower coupling (libSQL runs anywhere) but an extra vendor and
  dashboard for a tiny dataset.
- **Supabase** — Postgres + bundled Auth, but projects pause after ~1 week
  inactivity and the client library is vendor-coupled.

## Consequences

- Repository layer is mandatory (interface = future swap path).
- Exit: `wrangler d1 export` produces a portable SQLite/SQL dump (runbook).
- Free tier (5GB, 5M row-reads/day) exceeds MVP needs by orders of magnitude.
