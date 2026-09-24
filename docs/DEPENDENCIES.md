# Dependency Authorisation Manifest

Rule (AGENTS.md §1.1): **no package is installed or upgraded without the
owner's explicit authorisation, recorded here first.** Status values:
`authorised` · `proposed` · `rejected` · `removed`.

Runtime dependency policy: integrations use plain `fetch` / WebCrypto; the
dependency surface is intentionally near-zero (ADR-0003/0004/0005).

## Framework / toolchain (authorise at Phase 1 scaffold)

| Package | Purpose | Status | Authorised | Notes |
|---|---|---|---|---|
| `svelte`, `@sveltejs/kit`, `vite` | App framework + build | authorised | (this session) | Svelte 5, TS strict |
| `@sveltejs/adapter-cloudflare` | Workers deployment | authorised | (this session) | Charter-compliant |
| `wrangler` (dev) | Local Workers/D1 runtime, deploy | authorised | (this session) | |
| `eslint`, `prettier`, `vitest`, `@playwright/test` | Quality tooling | authorised | (this session) | Dev-only |
| TypeScript + Svelte language tools | Type checking | authorised | (this session) | Dev-only |

## Runtime integrations — **zero npm dependencies by design**

| Integration | Mechanism | Status |
|---|---|---|
| Workers AI (Summariser) | OpenAI-compatible REST via plain `fetch` | authorised (ADR-0003) |
| Resend (Mailer) | REST via plain `fetch` | authorised (ADR-0004) |
| Google OAuth | HTTP flow via plain `fetch` + WebCrypto | authorised (ADR-0005) |
| Open-Meteo / Guardian / ABC | HTTP/RSS via plain `fetch` | authorised (DATA_SOURCES.md) |

## Proposed (not authorised — do not install)

| Package | Purpose | Status |
|---|---|---|
| `ai` (Vercel AI SDK) | Structured LLM output | proposed — reconsider **only if** OpenRouter/streaming adopted (ADR-0003) |
| `openai` SDK | OpenAI-compatible client | proposed — only if `fetch` client proves insufficient |
| `@auth/*` or `better-auth` | Auth framework | rejected for MVP — trigger to re-evaluate: second OAuth provider (ADR-0005) |

## Exit / review triggers

- Any Workers-incompatible must-have library → execute ADR-0001 exit plan
  (adapter-node on Railway/VPS) rather than workarounds.
- AI SDK adoption requires: owner authorisation + ADR-0003 amendment.
