# Dependency Authorisation Manifest

Rule (AGENTS.md §1.1): **no package is installed or upgraded without the
owner's explicit authorisation, recorded here first.** Status values:
`authorised` · `proposed` · `rejected` · `removed`.

Runtime integrations use plain `fetch` / WebCrypto where provider interfaces are needed. Auth is an explicit exception to the zero-runtime-dependency policy: Better Auth + Drizzle are authorised in amended ADR-0005.

## Framework / toolchain — AUTHORISED (Phase 1, Step 1 — owner tick 2026-09-24)

| Package                                                           | Purpose                                                    | Status     | Notes                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | ----------------------------------------------- |
| `svelte`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, `vite` | App framework + build                                      | authorised | Svelte 5, TS strict                             |
| `typescript`, `svelte-check`                                      | Type checking                                              | authorised | dev-only                                        |
| `@sveltejs/adapter-cloudflare`                                    | Workers deployment                                         | authorised | ADR-0001                                        |
| `wrangler`                                                        | Local Workers/D1 runtime + deploy                          | authorised | dev-only                                        |
| `eslint`, `eslint-plugin-svelte`                                  | Linting                                                    | authorised | dev-only                                        |
| `prettier`, `prettier-plugin-svelte`                              | Formatting                                                 | authorised | dev-only                                        |
| `vitest`                                                          | Unit testing                                               | authorised | dev-only                                        |
| `tailwindcss`, `@tailwindcss/vite`                                | Styling (Tailwind v4, Vite plugin — no config file needed) | authorised | owner chose Tailwind over plain CSS             |
| `typescript-eslint`, `globals`                                    | ESLint TS/Svelte parsing + environment globals             | authorised | Phase 1 Step 4, owner tick 2026-09-24; dev-only |

Runtime integration policy: external providers use plain `fetch` / WebCrypto where practical. Better Auth/Drizzle are authorised runtime dependencies for auth; Drizzle Kit is dev-only.

## Runtime integrations

| Integration                 | Mechanism                                                                | Status                       |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| Better Auth                 | OAuth/sessions and email/password endpoints; PBKDF2 via custom callbacks | authorised (ADR-0005)        |
| Workers AI (Summariser)     | OpenAI-compatible REST via plain `fetch`                                 | authorised (ADR-0003)        |
| Resend (Mailer)             | REST via plain `fetch`                                                   | authorised (ADR-0004)        |
| Open-Meteo / Guardian / ABC | HTTP/RSS via plain `fetch`                                               | authorised (DATA_SOURCES.md) |

## Additional packages authorised for Phase 2 auth (owner approval 2026-09-24)

| Package              | Purpose                                                                         | Status     | Authorisation notes                                                   |
| -------------------- | ------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `better-auth@1.5.0`  | Google OAuth, OAuth account records, session lifecycle, custom PBKDF2 callbacks | authorised | Owner approval; ADR-0005 hybrid amendment; v1.5.0 D1 fixture verified |
| `drizzle-orm@0.45.1` | Official Drizzle D1 driver (`drizzle-orm/d1`) and Drizzle schema runtime        | authorised | Owner approval; runtime dependency                                    |
| `drizzle-kit@0.31.9` | Schema SQL generation and local migration authoring                             | authorised | Owner approval; dev-only; remote migration remains gated              |

## Proposed (not authorised — do not install)

| Package              | Purpose                  | Status                                                                |
| -------------------- | ------------------------ | --------------------------------------------------------------------- |
| `ai` (Vercel AI SDK) | Structured LLM output    | proposed — reconsider only if OpenRouter/streaming adopted (ADR-0003) |
| `openai` SDK         | OpenAI-compatible client | proposed — only if `fetch` client proves insufficient                 |

## Exit / review triggers

- Any Workers-incompatible must-have library → execute ADR-0001 exit plan
  (adapter-node on Railway/VPS) rather than workarounds.
- AI SDK adoption requires: owner authorisation + ADR-0003 amendment.
