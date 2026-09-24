import { describe, expect, it } from 'vitest';
import { createTestDatabase } from './sqlite';
import { createSessionRepository } from '../../src/lib/server/repository/sessions';
import { createUserRepository } from '../../src/lib/server/repository/users';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const T0 = 1_758_700_000_000; // fixed epoch for deterministic tests

function repos(opts: { ttlMs?: number } = {}) {
  const db = createTestDatabase();
  const user = createUserRepository(db);
  let clockMs = T0;
  const clock = () => clockMs;
  const sessions = createSessionRepository(db, opts.ttlMs ?? TTL_MS, clock);
  return {
    user,
    sessions,
    advance: (ms: number) => {
      clockMs += ms;
    },
  };
}

async function createUserWithSession(
  r: ReturnType<typeof repos>,
  email: string,
): Promise<{ userId: string; raw: string }> {
  const created = await r.user.createUser({ email });
  return { userId: created.id, raw: await r.sessions.create(created.id) };
}

describe('SessionRepository (real SQLite via migration files)', () => {
  it('creates a session and resolves the user from the raw cookie token', async () => {
    const r = repos();
    const { userId, raw } = await createUserWithSession(r, 's@example.com');

    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    const found = await r.sessions.getSessionUser(raw);
    expect(found?.userId).toBe(userId);
    expect(found?.email).toBe('s@example.com');
  });

  it('rejects unknown tokens and deleted sessions', async () => {
    const r = repos();
    const { raw } = await createUserWithSession(r, 's2@example.com');

    expect(await r.sessions.getSessionUser('garbage-token')).toBeNull();
    await r.sessions.delete(raw);
    expect(await r.sessions.getSessionUser(raw)).toBeNull();
  });

  it('expires sessions past their TTL and purges them lazily on read', async () => {
    const r = repos();
    const { raw } = await createUserWithSession(r, 's3@example.com');

    r.advance(TTL_MS + 1000);
    expect(await r.sessions.getSessionUser(raw)).toBeNull(); // expired + purged

    // The lazy purge above already deleted the row; a fresh token space is empty anyway.
    await r.sessions.purgeExpired();
  });

  it('purgeExpired removes only expired rows', async () => {
    const r = repos();
    const fresh = await createUserWithSession(r, 'fresh@example.com');
    const stale = await createUserWithSession(r, 'stale@example.com');

    r.advance(TTL_MS + 1000);
    const survivor = await r.sessions.create(
      (await r.user.getUserByEmail('fresh@example.com'))!.id,
    );

    await r.sessions.purgeExpired();
    expect(await r.sessions.getSessionUser(survivor)).not.toBeNull();
    expect(await r.sessions.getSessionUser(fresh.raw)).toBeNull();
    expect(await r.sessions.getSessionUser(stale.raw)).toBeNull();
  });

  it('slides expiry forward when less than half the TTL remains', async () => {
    const HALF = 100_000;
    const r = repos({ ttlMs: HALF });
    const { raw } = await createUserWithSession(r, 'sliding@example.com');

    const before = await r.sessions.getSessionUser(raw);
    const firstExpiry = before!.sessionExpiresAt;

    r.advance(HALF * 0.75); // 75% consumed → within the renewal window
    const after = await r.sessions.getSessionUser(raw);
    expect(after!.sessionExpiresAt).not.toBe(firstExpiry);
    expect(new Date(after!.sessionExpiresAt).getTime() - T0).toBe(HALF * 0.75 + HALF);
  });

  it('does NOT slide expiry while more than half the TTL remains', async () => {
    const HALF = 100_000;
    const r = repos({ ttlMs: HALF });
    const { raw } = await createUserWithSession(r, 'stable@example.com');

    r.advance(HALF * 0.25);
    const found = await r.sessions.getSessionUser(raw);
    // Expiry was set at create time as T0 + HALF; 25% consumed → unchanged.
    expect(new Date(found!.sessionExpiresAt).getTime() - T0).toBe(HALF);
  });
});
