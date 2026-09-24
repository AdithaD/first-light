-- 0001: users & auth tables (ADR-0005: email+password and Google OAuth, equal coexistence).
-- user_preferences is intentionally deferred (owner decision 2026-09-24): the
-- interests/brief-time representation will be designed before Phase 3 ingestion.
-- All timestamps ISO-8601 UTC; IDs are app-generated UUIDs (crypto.randomUUID).

CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,      -- required by BOTH auth paths
  display_name TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE password_credentials (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,             -- PBKDF2, params embedded in hash string
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE oauth_accounts (
  provider            TEXT NOT NULL,       -- 'google' for now, extensible
  provider_account_id TEXT NOT NULL,       -- Google's stable `sub` claim
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          TEXT NOT NULL,
  PRIMARY KEY (provider, provider_account_id)
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,             -- SHA-256 hash of the cookie token (never the raw token)
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);