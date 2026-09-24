# ADR-0003 — AI Provider: `Summariser` Interface over Workers AI

**Date:** 2026-09-24 · **Status:** Accepted · **Deciders:** Owner + Cline

## Context

Daily AI summaries of weather + news. Requirements: per-user structured brief
(lead + sections + source links), token budget, cost control, Workers
compatibility, and (charter) minimal coupling.

## Decision

1. All summarisation goes through a **`Summariser` interface**.
2. Primary implementation: **Cloudflare Workers AI**, consumed via its
   **OpenAI-compatible HTTP endpoint** (NOT the native `env.AI` binding —
   charter). Plain `fetch` client, no SDK.
3. Model selection via env (`AI_MODEL`); benchmark 2–3 candidates
   (`@cf/openai/gpt-oss-120b`, `llama-3.3-70b` class) at build time.
4. OpenRouter documented as a **config-only fallback/upgrade** (same
   OpenAI-compatible dialect) when frontier prose is wanted.

Owner notes: supports the interface as the decoupling method; prose quality
is not a current priority, hence Workers AI primary. Cost: free 10k
Neurons/day covers MVP workload; prepaid credit (OpenRouter) or Workers Paid
are the documented spend escalation paths.

## Alternatives considered

- **Vercel AI SDK + OpenRouter** — best flexibility/prose; rejected for now
  to keep zero runtime deps (`ai` package remains _proposed_ in
  DEPENDENCIES.md; re-authorise on adoption).
- **Direct single-vendor SDK** (Anthropic/OpenAI) — most coupled for least flexibility.
- **Native Workers AI binding** — charter violation (rejected).

## Consequences / triggers to revisit

- Bare `fetch` client owns JSON schema validation; upgrade to the `ai` SDK
  (owner authorisation required) if structured-output ergonomics demand it.
- OpenRouter adoption = env change + account, no code change (same dialect).
