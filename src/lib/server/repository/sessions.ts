import type { Database } from './db';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = 'fl_session';

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string | null;
  sessionExpiresAt: string;
}

interface SessionJoinRow {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  email: string;
  display_name: string | null;
}

export function createSessionRepository(
  db: Database,
  ttlMs: number = SESSION_TTL_MS,
  /** Injectable clock (ms epoch) for tests; defaults to real time. */
  now: () => number = () => Date.now(),
) {
  async function tokenHash(rawToken: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function newRawToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  return {
    COOKIE_NAME,

    /** Creates a session; returns the RAW token (goes in the cookie). Only its hash is stored. */
    async create(userId: string): Promise<string> {
      const raw = newRawToken();
      const id = await tokenHash(raw);
      const nowMs = now();
      await db
        .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .run(id, userId, new Date(nowMs + ttlMs).toISOString(), new Date(nowMs).toISOString());
      return raw;
    },

    /**
     * Validates a raw session token; returns the user it belongs to.
     * Expired sessions are purged lazily on read. Sliding renewal: if less
     * than half the TTL remains, the session is extended on read.
     */
    async getSessionUser(rawToken: string): Promise<SessionUser | null> {
      const id = await tokenHash(rawToken);
      const nowMs = now();
      const row = await db
        .prepare(
          `SELECT s.id, s.user_id, s.expires_at, s.created_at, u.email, u.display_name
					 FROM sessions s JOIN users u ON u.id = s.user_id
					 WHERE s.id = ?`,
        )
        .first<SessionJoinRow>(id);
      if (!row) return null;

      const expiresAt = new Date(row.expires_at).getTime();
      if (expiresAt <= nowMs) {
        await db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
        return null;
      }
      if (expiresAt - nowMs < ttlMs / 2) {
        const newExpiry = new Date(nowMs + ttlMs).toISOString();
        await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiry, id);
        row.expires_at = newExpiry;
      }
      return {
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        sessionExpiresAt: row.expires_at,
      };
    },

    async delete(rawToken: string): Promise<void> {
      await db.prepare('DELETE FROM sessions WHERE id = ?').run(await tokenHash(rawToken));
    },

    /** Removes all expired sessions (cron-friendly, also fine to call opportunistically). */
    async purgeExpired(): Promise<void> {
      await db
        .prepare('DELETE FROM sessions WHERE expires_at <= ?')
        .run(new Date(now()).toISOString());
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
