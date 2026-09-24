# ADR-0005 — Authentication: Lucia-style Sessions; Email+Password and Google OAuth as Equal Coexistence

**Date:** 2026-09-24 · **Status:** Accepted · **Deciders:** Owner + Cline

## Context

MVP auth for a Workers app: signup/login, one session per user, preferences.
Constraints: no native binaries (no bcrypt), minimal dependencies, future
OAuth desirable.

## Decision

1. **Lucia-style custom sessions on D1** — `sessions` table (hashed token,
   expiry), HttpOnly cookie, rotation on renewal. ~150 owned lines; the
   archived Lucia project's pattern is the canonical reference (zero deps).
2. **Email+password AND Google OAuth are equal, fully first-class** flows
   (owner explicitly chose equal coexistence over Google-primary or
   Google-only).
   - Passwords: WebCrypto **PBKDF2** (Workers-native, no binaries).
   - Google: OAuth 2.0 authorization-code flow, hand-rolled (~100–150 LOC,
     two redirects + one token fetch; ID token verified via WebCrypto/JWKS).
     Google Cloud project with test-mode consent screen; no review needed for
     basic scopes.
3. Schema: `password_credentials.password_hash` nullable (full support, not
   vestigial); `oauth_accounts(provider, provider_account_id, user_id)`.
   `users.email` NOT NULL from day one (both paths yield an email).
4. **Account-linking policy:** OAuth sign-in whose verified email matches an
   existing account links to it automatically.

## Alternatives considered

- **Auth.js v5** — OAuth-first, but D1 driver community-maintained and
  email+password second-class; weight not justified for one provider.
- **Better Auth** — feature-rich but heavier; D1 support maturing.
- **Supabase Auth** — vendor-coupled; DB already declined (ADR-0002).

## Consequences / triggers to revisit

- **Trigger:** adding a _second_ OAuth provider → formally re-evaluate
  Auth.js / Better Auth (recorded so it isn't forgotten).
- Session security details (cookie flags, rotation, expiry) implemented in
  Phase 2 and unit-tested.
- Google OAuth keys required at Phase 2 (owner action, free).
