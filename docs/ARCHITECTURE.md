# Architecture

Last updated: Phase 3 (preferences). This document describes the system as designed; the
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
                         │   2 fetchNews ────▶ ABC News RSS         │
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
| `NewsProvider`, `WeatherProvider`   | ABC RSS; Open-Meteo Geocoding + Forecast  | Guardian deferred; see DATA_SOURCES.md                         |

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
unused; migration 0002 adds Better Auth tables. Both migrations have been
applied to local and production D1. App-owned tables remain explicit
SQL/repository work for their phases. Migration 0003 adds the locally applied
preferences and feedback tables; production rollout awaits CI and owner approval.

- **Phase 3 preferences (implemented locally; migrations 0003 and 0004 are applied
  locally; production migration/deploy are pending CI and owner approval):**
  ADR-0006 defines the product scope. Keep
  persisted preferences provider-independent and translate them to providers in
  integration adapters.

  - `user_preferences`: one row per Better Auth user, with `user_id` as a
    primary/foreign key (`user.id`, cascade delete); `locality_name` and
    optional `locality_region`; nullable `latitude`/`longitude` until a location
    is selected; `timezone` (IANA identifier); `delivery_local_time` (`HH:mm`);
    `digest_length` (`concise` or `standard`); and `source_mode` (`all` or
    `selected`), `weather_enabled` and `news_enabled` boolean flags (both default
    true), plus UTC `created_at`/`updated_at`. Latitude and longitude must
    be both null or both set. Create lazily on first preference save, with
    defaults of `Australia/Sydney`, `07:00`, `concise`, and `all`. Location
    remains unset until selected; it is required only when Weather is enabled.
    New preferences default both sections on. In migration 0004, existing rows
    without coordinates get Weather off until configured; rows with coordinates
    keep Weather on, while News stays on.
    `timezone` defaults to `Australia/Sydney`; users may choose another
    supported IANA timezone independently of their locality.
  - `user_preference_topics`: one row per topic preference, owned by the user
    with cascade delete. Store a kind (`curated`, `custom`, or `exclude`) and a
    normalized value, plus UTC `created_at`. Curated values are stable app-owned
    slugs; custom and excluded values are trimmed phrases, limited to 10 combined
    phrases per user and 80 Unicode characters per phrase, case- and
    whitespace-normalized for deduplication. Curated values are unique per user;
    custom/excluded normalized phrases are unique within their kind. Do not
    persist a provider-specific query as the user's interest.
    Turning News off preserves topic/source preferences; they are applied again
    when News is re-enabled.
  - `user_preference_sources`: selected source IDs for users whose source mode
    is `selected`; use stable registry IDs (initially `abc-top-stories` and
    `abc-just-in`) and a unique `(user_id, source_id)` key. The repository
    checks these against the current registry. Keep the allowlist extensible as
    sources are added. In `all` mode the
    absence of rows means all approved, available sources, avoiding a stale
    source snapshot when the registry changes. In `selected` mode an empty set
    is invalid; require at least one active approved source.
  - `story_feedback`: separate, minimal “less like this” signals with
    app-generated ID, user FK (cascade delete), stable approved `source_id`,
    provider article ID or canonical article URL, and UTC `created_at`. Enforce
    uniqueness per `(user_id, source_id, article_identifier)`. Do not store
    copied article bodies or inferred sensitive traits. Use only as a lightweight
    negative relevance signal; this is not a recommendation profile.

  Validate coordinates as finite numbers in latitude/longitude ranges, timezone
  against supported IANA identifiers, delivery time as a valid 24-hour local
  time, and all enum/source/topic values against app-owned allowlists. Keep
  timestamps UTC. Repository code owns D1 reads/writes; do not expose Drizzle or
  provider clients to routes. Saving a preference set (core row plus topic/source
  selections) must be all-or-nothing from the application's perspective: because
  D1 has no interactive transactions, use a tested batch or another explicit
  consistency strategy; do not silently leave partial preferences.

  Provider mapping:

  - Weather location is resolved from the user's locality and optional
    `locality_region` via Open-Meteo's Geocoding API, filtered to Australia.
    Store the chosen display label and coordinates. The IANA timezone is a
    separate user-controlled delivery preference (default `Australia/Sydney`)
    and is sent to the forecast adapter. Validate it as a recognized IANA
    identifier. The weather
    adapter requests only current conditions and a two-day daily forecast using
    the configured timezone. Attribute Open-Meteo in the weather section.
  - ABC adapter uses `htmlparser2` in XML mode to fetch and parse only the
    selected registry feeds. Curated topics match app-owned category-tag aliases
    on returned item metadata, while custom terms and exclusions match locally
    against trimmed title, description, and category values. Do not accept
    arbitrary feed URLs. Feed errors remain isolated per source; successful RSS
    is cached only in the caller-supplied per-brief cache for at most one hour.
    Bound RSS responses to 2 MiB and apply a 5-second request timeout. Require
    HTTPS ABC article URLs. ABC feed category tags are useful but not a
    guaranteed exhaustive topic taxonomy.
  - Guardian is deferred. Adding it later means a provider client and reviewed
    mappings in `docs/DATA_SOURCES.md`; it must not require a user-preference
    schema change.
  - `all`/`selected` source mode is resolved before fetching. A disabled or
    failing source degrades only its own section. The general Australian news
    mix remains available even when the user has no topic preferences.
  - `/debug` is an authenticated, read-only view of raw approved-provider
    results for the current user. It fetches only enabled/configured modules,
    renders independent `ok | empty | failed | disabled | not-configured`
    states, sets `Cache-Control: private, no-store`, and does not persist copied
    provider content or invoke AI. It is a manual diagnostic fetch; scheduled
    ingestion and persistent hourly per-user caching are not implemented yet.

  Curated topic slugs and category aliases are app-owned mapping data, not
  database enum values or user-supplied strings. The first mapping catalogue
  uses categories observed in samples of 25 entries from each confirmed ABC
  feed; a unit test ensures every alias exists in those samples. Keep the
  catalogue small and explain that matching is best-effort over RSS metadata.

  Onboarding captures location, interests, optional sources, delivery time,
  and length. Do not require advanced configuration during signup.

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
  migrations 0001 and 0002 have been applied to local and production D1.
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
| `GUARDIAN_API_KEY`                          | secret | Reserved for deferred Guardian integration        |
| `APP_ORIGIN`                                | config | Base URL for email and app links                  |

Secrets are set via `wrangler secret put` (prod) and `.env` (local dev);
`.env.example` documents all of them. Never commit real values.

## Local development

- Node **24 LTS**, **pnpm**, `wrangler dev` (local D1 emulation). Auth integration is exercised in Wrangler's Worker/D1 emulator; password hashing callbacks are unit-tested directly.
- Commands are established in Phase 1 and recorded here.
