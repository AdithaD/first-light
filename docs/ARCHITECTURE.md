# Architecture

Last updated: Phase 0. This document describes the system as designed; the
ADR log records why. Keep both in sync (see AGENTS.md §4).

## System overview

```
                        ┌──────────────────────────────────────────┐
                        │            Cloudflare (ADR-0001)         │
                        │                                          │
 User ──browser──▶ SvelteKit app (Workers) ──repo layer──▶ D1 (ADR-0002)
                        │      │                                   │
                        │      │ Cron Trigger (daily)              │
                        │      ▼                                   │
                        │  Brief engine (plain function)           │
                        │   1 fetchWeather ──▶ Open-Meteo          │
                        │   2 fetchNews ────▶ Guardian AU / ABC    │
                        │   3 summarise ────▶ Summariser           │
                        │   4 render ───────▶ (web + email HTML)   │
                        │   5 deliver ──────▶ Mailer ─▶ Resend     │
                        └──────────────────────────────────────────┘
```

## Interfaces (the portability seams)

All external services sit behind narrow interfaces; implementations are
plain `fetch` clients living in `src/lib/server/integrations/<provider>/`.
Swapping a provider = new implementation + env config — never an app-code
change.

| Interface                           | Implementations (MVP)                     | Documented alternatives                                        |
| ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `Summariser`                        | Workers AI (OpenAI-compatible endpoint)   | OpenRouter (config-only swap) — ADR-0003                       |
| `Mailer`                            | Resend REST                               | Postmark, SES — ADR-0004                                       |
| `UserRepository`, `BriefRepository` | D1; auth tables via Better Auth + Drizzle | (charter: D1 only; export runbook is the exit) — ADR-0002/0005 |
| `NewsProvider`, `WeatherProvider`   | Guardian AU, ABC RSS; Open-Meteo          | see DATA_SOURCES.md                                            |

## Brief engine

- Discrete **idempotent step functions**, orchestrated by one plain function
  (portable: callable by Cron Trigger today, by anything later). No
  Workflows/KV/Queues (ADR-0001 charter).
- **Idempotency guard:** unique `(user_id, brief_date)` in D1 prevents
  duplicate briefs on cron overlap/retry.
- **Graceful degradation:** each step returns a section with
  `ok | empty | failed` status; a partial brief always beats no brief.
- CPU note (ADR-0001): Worker CPU limits apply to active execution, not network wait. Password hashing uses the owner-approved PBKDF2 callback described in ADR-0005.

## Data model (initial)

Better Auth tables (`user`, `session`, `account`, `verification`) are owned by
the Drizzle schema in `src/lib/server/auth/schema.ts`. Reviewed SQL is committed
as `migrations/0002_better_auth.sql` and applied via Wrangler. Drizzle Kit output is reviewed, then copied/renumbered into `migrations/`; only
Wrangler's ordered SQL migrations are applied to D1.
Legacy custom auth tables from migration 0001 remain in schema history but are
unused; migration 0002 adds Better Auth tables locally. App-owned tables remain
explicit SQL/repository work for their phases.

- **Deferred:** `user_preferences` (locality/interests/brief time) — the
  interests representation (free-form vs curated options) is an open design
  question the owner wants to deliberate before Phase 3. Auth ships first.
- All timestamps stored UTC; rendered in user's timezone (`Intl`).
- Migrations: plain SQL in `migrations/`, applied via
  `wrangler d1 migrations apply first-light` (add `--local` for dev); schema
  is the source of truth in git.

### Auth and database integration (Phase 2)

- Better Auth handles Google OAuth, account linking, sessions/cookies, and
  email/password auth endpoints. Our PBKDF2 module is supplied via custom hash
  and verify callbacks; hashes are stored in `account.password` for
  `provider_id='credential'` (ADR-0005). Keep existing SvelteKit form UX using
  thin wrappers around Better Auth server APIs.
- Better Auth uses Drizzle's D1 driver (`drizzle-orm/d1`) and adapter
  (`better-auth/adapters/drizzle`, provider `sqlite`).
- D1 does not support interactive transactions. Exercise sign-up, sign-in,
  social callback, session refresh and linking in Wrangler's D1 emulator.
- SvelteKit integration mounts `svelteKitHandler` in `hooks.server.ts`; the
  `sveltekitCookies(getRequestEvent)` plugin is enabled for action cookies.
- OAuth linking uses verified Google email; do not add Google to trusted-provider
  bypass settings. An existing Google-only user can add a credential login while
  authenticated using Better Auth `setPassword`; this writes the PBKDF2 callback
  hash to that same user's `credential` account. Credential users change passwords
  through Better Auth `changePassword`, which verifies their current password and
  revokes other sessions. Set canonical `BETTER_AUTH_URL` explicitly.
- Legacy `migrations/0001_users_and_auth.sql` is retained as applied history but
  its tables are unused. Better Auth schema is `migrations/0002_better_auth.sql`;
  it has been applied locally only, not remotely.
- Node 24 LTS, pnpm, Wrangler local D1. Auth integration tests use the real
  Worker/D1 emulator; PBKDF2 callback behavior is unit-tested.

## Configuration / env vars

| Var                                         | Scope  | Purpose                                           |
| ------------------------------------------- | ------ | ------------------------------------------------- |
| `AI_ACCOUNT_ID`, `AI_API_TOKEN`             | secret | Workers AI REST endpoint auth                     |
| `AI_MODEL`                                  | config | Model slug (e.g. `@cf/openai/gpt-oss-120b`)       |
| `RESEND_API_KEY`                            | secret | Email sending                                     |
| `BETTER_AUTH_SECRET`                        | secret | Better Auth secret (at least 32 random bytes)     |
| `BETTER_AUTH_URL`                           | config | Explicit canonical app origin for OAuth callbacks |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | Google social provider credentials                |
| `GUARDIAN_API_KEY`                          | secret | News source                                       |
| `APP_ORIGIN`                                | config | Base URL for email and app links                  |

Secrets are set via `wrangler secret put` (prod) and `.env` (local dev);
`.env.example` documents all of them. Never commit real values.

## Local development

- Node **24 LTS**, **pnpm**, `wrangler dev` (local D1 emulation). Auth integration is exercised in Wrangler's Worker/D1 emulator; password hashing callbacks are unit-tested directly.
- Commands are established in Phase 1 and recorded here.
