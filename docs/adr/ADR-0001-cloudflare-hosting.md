# ADR-0001 — Cloudflare Hosting with a Portability Charter

**Date:** 2026-09-24 · **Status:** Accepted · **Deciders:** Owner (Dora) + Cline

## Context

Zero→deployment choice of platform for a SvelteKit app with daily scheduled
jobs, email, AI calls, and a small DB. Candidates: Cloudflare, Railway,
self-hosted VPS, Vercel.

## Decision

Cloudflare Workers + D1 + Cron Triggers, deployed via
`@sveltejs/adapter-cloudflare`, **subject to a portability charter**:

1. No Cloudflare Workflows, KV, Queues, R2, or Durable Objects in MVP.
2. No native bindings (`env.AI` etc.) — external services via plain HTTP.
3. All D1 access behind a repository layer.
4. Brief engine = portable step functions + plain orchestrator, not a
   platform-specific workflow product.
5. Documented exit runbook: `wrangler d1 export`, `adapter-node` swap.

Owner rationale: generous free tier covers projected usage; explicit concern
about ecosystem coupling, resolved via the charter (leaving costs days, not
weeks). Railway documented as fallback (~US$5/mo, Node runtime, Docker-
portable; owner notes a Railway config could run on own VPS via Docker, at
the price of owning TLS/backups/patching/uptime).

## Key technical clarifications recorded

- Workers **10ms is CPU time, not wall-clock** — awaiting external APIs is
  free. Projected brief run: ~5–13s wall-clock, ~4–10ms CPU. Free Cron
  Triggers allow minutes of wall-clock; 50 subrequests/invocation vs our ~5.
- Escalation path if CPU ever exceeded: Workers Paid US$5/mo (30s CPU).
- Workflows explicitly **deferred**; step boundaries are designed so adopting
  them later is mechanical if durability demands it.

## Alternatives considered

- **Railway** — zero runtime friction, but paid from day one for unused headroom.
- **VPS** — full control; owner inherits TLS, backups, patching, uptime.
- **Vercel** — good SvelteKit host, but weaker fit for D1-shaped simplicity.

## Consequences / triggers to revisit

- Trigger to exit: a must-have library incompatible with Workers (see
  DEPENDENCIES.md exit policy) → Railway/VPS via `adapter-node`.
- Server-side rendering only (no static prerender for personalised pages).
