# ADR-0005 — Better Auth + Drizzle on D1, retaining PBKDF2 email/password

**Original date:** 2026-09-24 · **Amended:** 2026-09-24 · **Status:** Accepted · **Deciders:** Owner + Cline

## Context

The original Phase 0 decision selected custom Lucia-style sessions and hand-rolled Google OAuth. The owner approved Better Auth + Drizzle on D1 to avoid maintaining security-sensitive OAuth/session plumbing, then specified retaining the existing PBKDF2 email/password hashing because Better Auth's default scrypt may exceed Workers CPU limits.

Better Auth v1.5.0 provides custom password `hash` and `verify` callbacks. Its official Cloudflare D1 smoke fixture uses `better-auth/adapters/drizzle` with `drizzle-orm/d1`; its SvelteKit integration is `better-auth/svelte-kit`. Better Auth's OAuth/account/session behavior will be used, with our PBKDF2 module wired as the email/password hash provider.

## Decision (amended by owner approval; hybrid clarified 2026-09-24)

1. Use **Better Auth** for Google OAuth, OAuth account linking, session issuance/validation/cookies, and auth API endpoints. Use its official SvelteKit `svelteKitHandler` and `sveltekitCookies(getRequestEvent)` integration.
2. Keep the existing email/password form UX and PBKDF2 hash/verify implementation. Configure Better Auth's `emailAndPassword.password.hash(password)` and `verify({ password, hash })` callbacks to call `hashPassword`/`verifyPassword` from `src/lib/server/auth/password.ts` (100k iterations). Better Auth stores the opaque PBKDF2 hash in `account.password` for `providerId='credential'` and owns credential account rows and sessions. Keep validation and user-facing errors in thin SvelteKit route wrappers around Better Auth server APIs; do not implement a second session/cookie system.
3. The current PBKDF2 implementation remains authoritative; Better Auth's default scrypt MUST be overridden and never used for this product unless the owner changes the work-factor decision.
4. Use Drizzle's D1 driver (`drizzle-orm/d1`) with `env.DB` and Better Auth's Drizzle adapter (`better-auth/adapters/drizzle`, provider `sqlite`). App-owned non-auth data remains behind the repository layer.
5. Email+password and Google remain **equal first-class** methods.
6. Do not add `google` to `account.accountLinking.trustedProviders`: Better Auth v1.5 links an existing email account only when the provider reports verified email or is explicitly trusted. Rely on verified Google email; test that unverified email cannot link. Do not permit different-email linking. End-to-end account-linking tests are out of scope for this release by owner decision; preserve this security configuration regardless.
7. Set explicit `baseURL`/`BETTER_AUTH_URL`; do not rely on request-host inference for OAuth callback construction.
8. Define Better Auth tables (`user`, `session`, `account`, `verification`) in Drizzle schema, generate plain SQL with Drizzle Kit, and apply via Wrangler D1 migrations. No remote migration/deploy until Phase 2 verification and owner approval.

## Compatibility caveat

D1 does **not** support interactive transactions. Better Auth v1.5's D1 fixture uses Drizzle's D1 driver and Wrangler migration workflow. Auth paths that need atomic multi-write semantics must be tested against `wrangler dev`'s D1 emulator; do not assume a SQLite transaction call is portable to D1. Keep D1 access isolated behind the adapter/repository boundary.

## Alternatives considered

- **Fully custom Lucia sessions + hand-rolled Google OIDC** — no new runtime dependency, but duplicates security-sensitive OAuth/session plumbing and ongoing maintenance. Superseded for OAuth/session duties; retain PBKDF2 implementation only.
- **Better Auth default scrypt** — not used; custom callbacks preserve the owner-approved PBKDF2 work factor.
- **Auth.js / Auth.js v5** — not selected; Better Auth's official SvelteKit and D1 fixture match this app more closely.
- **Supabase Auth** — remains rejected: vendor-coupled and contrary to D1 decision (ADR-0002).

## PBKDF2 runtime evidence

- The existing PBKDF2 module uses 100,000 iterations, which completed six trials on an isolated temporary Worker. 150k returned Cloudflare error 1101 twice; the cause was not proven, and no exact CPU-ms was exposed. The temporary Worker was deleted.
- Owner accepts **100,000 iterations for MVP**. This is preserved with Better Auth custom hash/verify callbacks. Revisit only if the threat model or Workers plan changes; do not silently switch to Better Auth's default scrypt.

## Consequences / revisit triggers

- Better Auth, Drizzle ORM, and Drizzle Kit add dependencies; owner authorisation is recorded in `docs/DEPENDENCIES.md` before installation.
- Better Auth owns auth users/accounts/sessions and stores credential PBKDF2 hashes in `account`; an authenticated Google-only account adds password login via `auth.api.setPassword`, not a second signup. Credential users change passwords through `auth.api.changePassword`, which checks the current password and can revoke other sessions; owner verified password change, subsequent sign-in, and session revocation locally. Remove use of custom `sessions` and `password_credentials` tables. The legacy migration was applied locally only and not to production D1. Retain migration history; do not alter production until explicit approval.
- Revisit if Workers compatibility, D1 transaction limitations, dependency size, or Better Auth's maintenance/behavior no longer meet requirements.
- Google OAuth client credentials and redirect URI are configured locally. Owner-reported first-time consent and returning sign-in passed against Wrangler dev; verified-email account-linking tests remain part of the Phase 2 gate. No client secret is committed.
