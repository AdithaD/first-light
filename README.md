# First Light

[![CI](https://github.com/AdithaD/first-light/actions/workflows/ci.yml/badge.svg)](https://github.com/AdithaD/first-light/actions/workflows/ci.yml)

A daily personal briefing app: local weather, curated news, and an AI-written
summary — delivered in-app and by email — customised per user by **locality**
and **interests**. English-language product; **initial market scope is
Australia** (source list, localities, and defaults reflect that scope and can
expand later).

> **Status: Phase 0 (Foundation)** — architecture decisions locked, documentation
> established. Application scaffolding begins at the Phase 1 gate.
> See [ROADMAP.md](ROADMAP.md) for the plan and
> [docs/adr/](docs/adr/) for every decision made so far.

## What it does (MVP)

- Each user sets a locality (suburb → coordinates), interest categories,
  brief time, and delivery preference (web, email, or both).
- Once per user-day, the **brief engine** fetches weather + news, asks an LLM
  to write a short "first light" lead plus section summaries with source links,
  and stores the result in D1.
- The web app renders today's brief; Resend emails a rendered copy if enabled.

## Locked architecture (decided — see ADRs)

| Concern  | Decision                                                                   | ADR                                                 |
| -------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| Hosting  | Cloudflare Workers + D1 + Cron Triggers, under a **portability charter**   | [ADR-0001](docs/adr/ADR-0001-cloudflare-hosting.md) |
| Database | Cloudflare D1 (SQLite), repository layer, SQL migrations in git            | [ADR-0002](docs/adr/ADR-0002-d1-database.md)        |
| AI       | `Summariser` interface → Workers AI via OpenAI-compatible HTTP endpoint    | [ADR-0003](docs/adr/ADR-0003-ai-provider.md)        |
| Email    | Resend behind a `Mailer` interface (plain `fetch`)                         | [ADR-0004](docs/adr/ADR-0004-email-delivery.md)     |
| Auth     | Better Auth + Drizzle D1; Google OAuth and PBKDF2 email/password callbacks | [ADR-0005](docs/adr/ADR-0005-authentication.md)     |

Auth uses owner-authorised Better Auth/Drizzle runtime dependencies; other
external providers remain behind plain `fetch` / WebCrypto interfaces. All
packages are tracked in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

## For agents (human or AI)

Read [AGENTS.md](AGENTS.md) **before** changing anything. It defines the
project's non-negotiables, conventions, and documentation duties. Key rule:
**no dependency is added and no locked decision is changed without owner
authorisation, recorded in a written decision record.**

## Documentation map

| File                                         | Purpose                                      |
| -------------------------------------------- | -------------------------------------------- |
| [ROADMAP.md](ROADMAP.md)                     | Phase plan, gates, current status            |
| [AGENTS.md](AGENTS.md)                       | Operating rules for every contributing agent |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, modules, interfaces, limits   |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Weather/news source registry & contracts     |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | Dependency authorisation manifest            |
| [docs/adr/](docs/adr/)                       | Decision records (ADRs)                      |

## Local development (from Phase 1)

Use **Node 24 LTS** ("Krypton" — active LTS, maintained to April 2028; the
previously documented 22 LTS enters maintenance Oct 2026 and goes EOL April
2027), **pnpm** as package manager, and `wrangler` for the local
Workers/D1 runtime. Exact commands land here as the scaffold is created in
Phase 1.
