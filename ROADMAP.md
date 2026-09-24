# Roadmap — Zero to Deployment

Status at each gate is recorded inline. Decisions reference
[docs/adr/](docs/adr/). Dependencies reference [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

**Legend:** ⛔ requires owner decision · 🔑 requires owner account/key · 📦 dependency (authorise in DEPENDENCIES.md)

---

## Phase 0 — Foundation ✅ (current)

- [x] All five architectural decisions made & recorded (ADR-0001…0005)
- [x] Documentation set established (README, AGENTS.md, ROADMAP, ARCHITECTURE, DATA_SOURCES, DEPENDENCIES, ADRs)
- [x] `.gitignore`, repo initialised, **initial commit made** (`main`)

## Phase 1 — Skeleton app

- [x] 📦 Scaffold SvelteKit (Svelte 5, TypeScript strict) via `sv create` → toolchain deps authorised in DEPENDENCIES.md (incl. Tailwind v4 — owner choice)
- [x] `adapter-cloudflare` + `wrangler.jsonc` (Workers + D1 binding stub, cron deferred to Phase 5), verified via `wrangler dev` smoke test
- [x] `.nvmrc` pin committed — **Node 24** (owner tick; local runtime upgrade to 24 pending on owner machine)
- [x] Tooling: ESLint (`typescript-eslint` + `globals` authorised, owner tick Step 4) / Prettier / Vitest — first unit tests (2) passing; `lint`/`format`/`test` scripts
- [x] Home page + layout, `/health` endpoint (verified via wrangler dev), `.env.example`
- [x] CI: lint + typecheck + unit tests + build on push — **first run green** (repo: github.com/AdithaD/first-light; deploy stays manual until Phase 7)
- [x] **Gate met:** first deployment of the empty pipeline to Workers — live at
  `https://first-light.adithaidoratiyawa.workers.dev`, `/health` returning
  `{"status":"ok","version":"0.1.0",...}` (2026-09-24); D1 `first-light` created
  and bound (`DB`); DNS/TLS via workers.dev; CI green; hosting proven end-to-end

## Phase 2 — Users & auth (preferences deferred)

Owner decision 2026-09-24: interests/brief-time representation (free-form vs
curated) will be deliberately designed **before Phase 3** — auth ships first.

- [x] Auth schema migration approved & applied (`migrations/0001_users_and_auth.sql`: users, password_credentials, oauth_accounts, sessions)
- [ ] Migration workflow verified local & remote (`wrangler d1 migrations apply`)
- [ ] Repository layer over D1 (`UserRepository`/`SessionRepository`), unit-tested
- [ ] Auth: email+password (WebCrypto PBKDF2), session cookies, signup/login/logout, protected routes
- [ ] Auth: Google OAuth (authorization-code flow, verified-email auto-linking) — 🔑 owner creates Google Cloud OAuth client
- [ ] Phase verification: full walkthrough both paths, CI green, deploy

## Phase 3 — Data ingestion

⛔ **Gate-first decision:** interests/brief-time representation (free-form vs
curated options vs hybrid) must be designed and recorded (ADR-0006) before
ingestion code — it shapes `user_preferences` and the onboarding UI.

- 🔑/free Integration clients behind interfaces, unit-tested with mocked `fetch`:
  - Weather: **Open-Meteo** (free, no key)
  - News: **Guardian Australia open API** (free key); **ABC News RSS** as second source
- Registry & contracts documented in `docs/DATA_SOURCES.md`
- Caching, timeouts, per-source graceful degradation, rate-limit respect
- **Gate:** raw fetched data viewable for a configured user (debug page)

## Phase 4 — AI summarisation

- `Summariser` interface; primary implementation = Workers AI via **OpenAI-compatible HTTP endpoint** (plain `fetch` client); model chosen via env, benchmark 2–3 candidates
- Prompt pipeline: structured JSON output (lead + sections + links), token budget, Zod-style validation (hand-rolled if zero-dep)
- Fallback & config path for OpenRouter (ADR-0003)
- **Gate:** end-to-end brief generated from real data for one user, on demand

## Phase 5 — Daily brief engine

- 🔑 Resend account + domain DKIM/SPF via Cloudflare DNS; `Mailer` implementation (plain `fetch`)
- Brief steps wired: `fetchWeather → fetchNews → summarise → render → deliver`; idempotency guard (one brief/user/day); partial-failure degradation
- Cron Trigger scheduling, timezone-correct per user; in-app brief page + email template
- **Gate:** real email brief arrives at the right local time; web brief renders

## Phase 6 — Hardening

- E2E smoke tests (Playwright) vs local `wrangler dev`
- Failure drills: each source down, AI down, email down — verify graceful briefs
- Secrets audit; security headers/CSP; rate limiting on auth endpoints
- Docs full sync pass

## Phase 7 — Deployment

- Production deploy (Workers + D1 + cron), custom domain, production OAuth redirect URIs, Resend sending domain live
- Monitoring: Workers logs, uptime probe on health endpoint, spend caps (Workers AI neurons, Resend) confirmed
- Runbook: deploy steps, D1 backup (`wrangler d1 export`), secret rotation, exit procedure (ADR-0001)
- **Gate:** a real user receives tomorrow's brief. 🚀

## Phase 8 — Post-MVP backlog (parked ideas)

- Brief history/archive page; on-demand regeneration
- More sources (per-interest categories: sport, finance, science…)
- Second OAuth provider → **triggers ADR-0006 re-evaluation of Auth.js/Better Auth**
- Frontier-model prose via OpenRouter config dial
- Workers AI binding/streaming upgrades **only if** charter is amended
- PWA/mobile polish; ICS/calendar snippets; multiple localities per user
