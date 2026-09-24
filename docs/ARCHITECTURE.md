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

| Interface                                                | Implementations (MVP)                   | Documented alternatives                                   |
| -------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| `Summariser`                                             | Workers AI (OpenAI-compatible endpoint) | OpenRouter (config-only swap) — ADR-0003                  |
| `Mailer`                                                 | Resend REST                             | Postmark, SES — ADR-0004                                  |
| `UserRepository`, `BriefRepository`, `SessionRepository` | D1                                      | (charter: D1 only; export runbook is the exit) — ADR-0002 |
| `NewsProvider`, `WeatherProvider`                        | Guardian AU, ABC RSS; Open-Meteo        | see DATA_SOURCES.md                                       |

## Brief engine

- Discrete **idempotent step functions**, orchestrated by one plain function
  (portable: callable by Cron Trigger today, by anything later). No
  Workflows/KV/Queues (ADR-0001 charter).
- **Idempotency guard:** unique `(user_id, brief_date)` in D1 prevents
  duplicate briefs on cron overlap/retry.
- **Graceful degradation:** each step returns a section with
  `ok | empty | failed` status; a partial brief always beats no brief.
- CPU note (ADR-0001): Worker CPU limits apply to active execution, not network wait. Do not assume WebCrypto PBKDF2 is free from CPU accounting: Cloudflare documents PBKDF2 support, but does not explicitly specify its CPU-metering behavior. The auth default of 100,000 iterations is provisional and MUST be measured on a deployed Worker before production auth is enabled; Node/local timings are not a substitute. Record measured CPU and plan limits here before selecting the production value.

## Data model (initial)

```sql
users             (id, email UNIQUE, created_at, ...)
password_credentials (user_id PK→users, password_hash)             -- ADR-0005
oauth_accounts    (provider, provider_account_id, user_id→users,
                   PRIMARY KEY(provider, provider_account_id))     -- ADR-0005
sessions          (id (hashed token), user_id→users, expires_at)  -- ADR-0005
```

- **Deferred:** `user_preferences` (locality/interests/brief time) — the
  interests representation (free-form vs curated options) is an open design
  question the owner wants to deliberate before Phase 3. Auth ships first.
- All timestamps stored UTC; rendered in user's timezone (`Intl`).
- Migrations: plain SQL in `migrations/`, applied via
  `wrangler d1 migrations apply first-light` (add `--local` for dev); schema
  is the source of truth in git.
- Auth linking: OAuth sign-in with a verified email matching an existing
  account links to it automatically (documented policy, ADR-0005).

### Password and session implementation (Phase 2)

- Password hash format: `pbkdf2$sha256$<iterations>$<salt-base64url>$<hash-base64url>`;
  WebCrypto PBKDF2-SHA256, random 16-byte salt, 256-bit derived value,
  constant-time comparison. No password or raw session token is stored.
- `AUTH_PBKDF2_ITERATIONS` currently defaults to **100,000 provisionally**.
  Cloudflare documents PBKDF2 support but does not state whether its async
  `deriveBits()` work is excluded from Worker CPU accounting. Local Node time
  is not evidence of deployed Worker CPU usage. **Before enabling production
  signup, measure this on a deployed Worker and record the CPU result/plan
  limit; adjust the work factor if necessary.**
- Sessions use 32 random bytes in a base64url cookie; D1 stores only the
  SHA-256 token digest. Cookie flags: `HttpOnly; SameSite=Lax; Secure` in
  production, path `/`, 30-day max-age; the database TTL and cookie TTL match.
  Expired sessions are rejected and lazily deleted; expiry slides when under
  half the TTL remains.
- Auth forms use SvelteKit's same-origin POST protection. Logout is POST-only.
- Node 24 LTS, pnpm, Wrangler local D1, Node built-in SQLite repository tests.

## Configuration / env vars

| Var                                         | Scope  | Purpose                                                                                  |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `AI_ACCOUNT_ID`, `AI_API_TOKEN`             | secret | Workers AI REST endpoint auth                                                            |
| `AI_MODEL`                                  | config | Model slug (e.g. `@cf/openai/gpt-oss-120b`)                                              |
| `RESEND_API_KEY`                            | secret | Email sending                                                                            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | OAuth                                                                                    |
| `GUARDIAN_API_KEY`                          | secret | News source                                                                              |
| `APP_ORIGIN`                                | config | Base URL (OAuth redirects, email links)                                                  |
| `AUTH_PBKDF2_ITERATIONS`                    | config | Provisional password-hash work factor; must be measured on Workers before production use |

Secrets are set via `wrangler secret put` (prod) and `.env` (local dev);
`.env.example` documents all of them. Never commit real values.

## Local development

- Node **24 LTS**, **pnpm**, `wrangler dev` (local D1 emulation). Tests use built-in `node:sqlite` with the actual migrations; route integration smoke tests use Wrangler's local Worker + D1 emulator.
- Commands are established in Phase 1 and recorded here.
