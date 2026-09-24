# AGENTS.md — Operating Rules for All Agents

You are contributing to **First Light**, a daily personal briefing web app
(local weather + Australian news + AI summary; web + email delivery).
These rules bind every agent — human or AI — in every session. They exist to
keep the architecture portable, the dependency surface small, and the
documentation truthful.

## 0. Read first, every session

1. `ROADMAP.md` — where we are, what gate is next
2. `docs/adr/` — every locked decision and its reasoning
3. `docs/DEPENDENCIES.md` — what may and may not be installed
4. Relevant source file(s) before editing them

## 1. Non-negotiables

1. **Dependency gate.** NEVER install, import, or upgrade any package without
   owner authorisation recorded in `docs/DEPENDENCIES.md` (status must move
   from _proposed_ → _authorised_ first). This applies to transitive
   "convenience" imports too.
2. **Portability charter.** Target plain Workers + D1. NEVER adopt:
   Cloudflare Workflows, KV, Queues, R2, Durable Objects, or native bindings
   (`env.AI`). All external services are called via plain `fetch`; all state
   lives in D1 behind a repository layer. See ADR-0001.
3. **Decision-change protocol.** Locked ADR decisions change only with the
   owner's explicit approval, recorded as a new/amended ADR _before_ the code
   changes. Never contradict an ADR silently. If you spot a conflict between
   code and ADR, flag it — do not pick a side.
4. **Workers runtime.** No native/binary Node modules; WebCrypto over crypto
   npm packages; Node-compat APIs allowed but prefer Web-standard APIs
   (`fetch`, `URL`, `crypto`, `crypto.subtle`, `Intl`).
5. **Secrets.** Never commit secrets. All config via env vars, documented in
   `.env.example` and the table in `docs/ARCHITECTURE.md`.
6. **Before writing a feature, check the roadmap.** Build what the current
   phase describes; park good ideas in the Phase 8 backlog instead of
   expanding scope mid-phase.

## 2. Architecture invariants (enforce in review)

- **Module boundaries:** app code never imports third-party API clients
  directly. Integrations sit behind interfaces:
  `Summariser` (ADR-0003), `Mailer` (ADR-0004), repository layer for D1
  (ADR-0002). Swapping a provider = new implementation + env config.
- **Brief engine:** discrete, idempotent step functions
  (`fetchWeather → fetchNews → summarise → render → deliver`) orchestrated by
  one plain function invoked by a Cron Trigger. One brief per user per day
  (DB unique guard). Partial failure degrades gracefully: ship a brief with
  missing sections rather than no brief; each section carries a status.
- **No silent data loss:** failed steps are logged with enough context to
  diagnose; never swallow errors.

## 3. Conventions

- TypeScript **strict**; Svelte 5 runes syntax; no `any` in committed code.
- Package manager: **pnpm**. Node: **24.x LTS** for local dev (`.nvmrc`
  pins the exact minor at Phase 1).
- File layout (Phase 1 establishes): `src/lib/server/{auth,brief-engine,integrations,repository}`,
  `src/lib/server/integrations/<provider>` per external service,
  `src/routes/**` for UI/endpoints, `migrations/*.sql` for D1 schema.
- Tests: unit tests for every integration client (mocked `fetch`) and brief
  step; D1 auth route integration exercised in Wrangler's D1 emulator; E2E
  smoke via Playwright from Phase 6. Drizzle Kit schema output is reviewed and
  committed as plain SQL migrations.
- Error handling: typed errors per module; user-facing copy in Australian
  English ("customise", "organise").
- Dates/times: store UTC in D1; render in the user's timezone (`Intl`), which
  defaults to Australia/Sydney until set.

## 4. Documentation duties (every change)

- **Docs move with code.** Any change that touches architecture, schema,
  config, a dependency, or a locked decision updates the relevant doc **in the
  same change set**: ADR (if decision-adjacent), ARCHITECTURE (if structure/
  interfaces/schema/env changed), DEPENDENCIES (if packages changed),
  DATA_SOURCES (if sources changed), ROADMAP (status boxes).
- After finishing work, run the checklist in `docs/adr/` (template header)
  and state which docs you updated and which you checked as not-required.
- Stale docs are bugs: if you find drift, fix it in the same session or open
  it explicitly in your hand-off summary.

## 5. Data sources policy

- Only sources listed in `docs/DATA_SOURCES.md` (or added there with owner
  approval). Respect rate limits; identify the app honestly via User-Agent;
  prefer official APIs over scraping HTML.
- Content scope: English-language product with **initial market scope of
  Australia** — the source registry reflects that scope and grows with it.
- Attribute sources in briefs (links); never present scraped content as
  original analysis beyond summarisation.

## 6. When something is ambiguous

If a rule, ADR, or the roadmap doesn't answer your question: **stop and ask
the owner** rather than guessing on anything architectural, financial
(spend), or user-data-related. Small implementation details are yours to
decide — document notable ones in the PR/hand-off note.
