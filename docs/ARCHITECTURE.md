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
- CPU note (ADR-0001): wall-clock waiting is free on Workers; the ~10ms
  budget covers parsing/assembly (~5–10ms projected). Trim payloads
  per-source before heavy parsing.

## Data model (initial)

```sql
users             (id, email UNIQUE, created_at, ...)
password_credentials (user_id PK→users, password_hash NULLABLE)   -- ADR-0005
oauth_accounts    (provider, provider_account_id, user_id→users,
                   PRIMARY KEY(provider, provider_account_id))     -- ADR-0005
sessions          (id (hashed token), user_id→users, expires_at)  -- ADR-0005
user_preferences  (user_id PK→users, suburb, latitude, longitude,
                   timezone, interests_json, brief_time_local,
                   delivery_web, delivery_email)
briefs            (id, user_id→users, brief_date, status,
                   content_json, created_at,
                   UNIQUE(user_id, brief_date))
```

- All timestamps stored UTC; rendered in user's timezone (`Intl`).
- Migrations: plain SQL in `migrations/`, applied via `wrangler d1`; schema
  is the source of truth in git.
- Auth linking: OAuth sign-in with a verified email matching an existing
  account links to it automatically (documented policy, ADR-0005).

## Configuration / env vars

| Var                                         | Scope  | Purpose                                     |
| ------------------------------------------- | ------ | ------------------------------------------- |
| `AI_ACCOUNT_ID`, `AI_API_TOKEN`             | secret | Workers AI REST endpoint auth               |
| `AI_MODEL`                                  | config | Model slug (e.g. `@cf/openai/gpt-oss-120b`) |
| `RESEND_API_KEY`                            | secret | Email sending                               |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | OAuth                                       |
| `GUARDIAN_API_KEY`                          | secret | News source                                 |
| `APP_ORIGIN`                                | config | Base URL (OAuth redirects, email links)     |

Secrets are set via `wrangler secret put` (prod) and `.env` (local dev);
`.env.example` documents all of them. Never commit real values.

## Local development

- Node **22 LTS**, **pnpm**, `wrangler dev` (local D1 emulation).
- Commands are established in Phase 1 and recorded here.
