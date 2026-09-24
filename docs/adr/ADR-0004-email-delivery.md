# ADR-0004 — Email Delivery via Resend

**Date:** 2026-09-24 · **Status:** Accepted · **Deciders:** Owner + Cline

## Context

Daily brief emails (MVP volume: handful/day). Cloudflare has no native
_sending_ (Email Workers receive/route only; MailChannels free path closed
2024). Must be callable from Workers via plain HTTP (charter).

## Decision

**Resend** behind a `Mailer` interface; implementation = REST API via plain
`fetch` (no npm dependency). Sending domain DKIM/SPF configured through
Cloudflare DNS. Free tier: 100/day, 3,000/mo (~20× MVP need).

## Alternatives considered

- **Postmark** — gold-standard deliverability; chosen swap target via
  `Mailer` if deliverability disappoints.
- **Amazon SES** — cheapest at scale (~$0.10/1k); clunkier setup; documented
  scale path.

## Consequences

- `Mailer` interface mandatory; new provider = new implementation + env.
- Resend account + API key required at Phase 5 (owner action).
