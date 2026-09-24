# Dependency Authorisation Manifest

Rule (AGENTS.md §1.1): **no package is installed or upgraded without the
owner's explicit authorisation, recorded here first.** Status values:
`authorised` · `proposed` · `rejected` · `removed`.

Runtime dependency policy: integrations use plain `fetch` / WebCrypto; the
dependency surface is intentionally near-zero (ADR-0003/0004/0005).

## Framework / toolchain — AUTHORISED (Phase 1, Step 1 — owner tick 2026-09-24)

| Package                                                           | Purpose                                                    | Status     | Notes                                                                         |
| ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `svelte`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, `vite` | App framework + build                                      | authorised | Svelte 5, TS strict                                                           |
| `typescript`, `svelte-check`                                      | Type checking                                              | authorised | dev-only                                                                      |
| `@sveltejs/adapter-cloudflare`                                    | Workers deployment                                         | authorised | ADR-0001                                                                      |
| `wrangler`                                                        | Local Workers/D1 runtime + deploy                          | authorised | dev-only                                                                      |
| `eslint`, `eslint-plugin-svelte`                                  | Linting                                                    | authorised | dev-only                                                                      |
| `prettier`, `prettier-plugin-svelte`                              | Formatting                                                 | authorised | dev-only                                                                      |
| `vitest`                                                          | Unit testing                                               | authorised | dev-only                                                                      |
| `tailwindcss`, `@tailwindcss/vite`                                | Styling (Tailwind v4, Vite plugin — no config file needed) | authorised | owner chose Tailwind over plain CSS                                           |
| `typescript-eslint`, `globals`                                    | ESLint TS/Svelte parsing + environment globals             | authorised | Phase 1 Step 4, owner tick 2026-09-24; dev-only                               |
| `@types/node`                                                     | Type definitions for Node builtins (type-checks `tests/`)  | authorised | Phase 2 Step 2, owner tick 2026-09-24; dev-only types, zero runtime footprint |

Runtime dependency policy unchanged: integrations use plain `fetch` / WebCrypto;
the runtime (`dependencies`) surface remains **zero**. All packages above are
`devDependencies` from the app's perspective.

## Runtime integrations — **zero npm dependencies by design**

| Integration                 | Mechanism                                | Status                       |
| --------------------------- | ---------------------------------------- | ---------------------------- |
| Workers AI (Summariser)     | OpenAI-compatible REST via plain `fetch` | authorised (ADR-0003)        |
| Resend (Mailer)             | REST via plain `fetch`                   | authorised (ADR-0004)        |
| Google OAuth                | HTTP flow via plain `fetch` + WebCrypto  | authorised (ADR-0005)        |
| Open-Meteo / Guardian / ABC | HTTP/RSS via plain `fetch`               | authorised (DATA_SOURCES.md) |

## Proposed (not authorised — do not install)

| Package                    | Purpose                  | Status                                                                      |
| -------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `ai` (Vercel AI SDK)       | Structured LLM output    | proposed — reconsider **only if** OpenRouter/streaming adopted (ADR-0003)   |
| `openai` SDK               | OpenAI-compatible client | proposed — only if `fetch` client proves insufficient                       |
| `@auth/*` or `better-auth` | Auth framework           | rejected for MVP — trigger to re-evaluate: second OAuth provider (ADR-0005) |

## Exit / review triggers

- Any Workers-incompatible must-have library → execute ADR-0001 exit plan
  (adapter-node on Railway/VPS) rather than workarounds.
- AI SDK adoption requires: owner authorisation + ADR-0003 amendment.
