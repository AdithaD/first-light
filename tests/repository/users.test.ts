import { describe, expect, it } from 'vitest';
import { createTestDatabase } from './sqlite';
import { createUserRepository } from '../../src/lib/server/repository/users';

function repo() {
  return createUserRepository(createTestDatabase());
}

describe('UserRepository (real SQLite via migration files)', () => {
  it('creates a user with password credential and reads it back by email and id', async () => {
    const users = repo();
    const created = await users.createUser({
      email: 'dora@example.com',
      displayName: 'Dora',
      passwordHash: 'pbkdf2$test',
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.email).toBe('dora@example.com');

    const byEmail = await users.getUserByEmail('dora@example.com');
    const byId = await users.getUserById(created.id);
    expect(byEmail).toStrictEqual(created);
    expect(byId).toStrictEqual(created);
    expect(await users.hasPasswordCredential(created.id)).toBe(true);
  });

  it('creates OAuth-only users without a password credential', async () => {
    const users = repo();
    const created = await users.createUser({ email: 'google-only@example.com' });
    expect(await users.hasPasswordCredential(created.id)).toBe(false);
  });

  it('rejects duplicate emails', async () => {
    const users = repo();
    await users.createUser({ email: 'dupe@example.com' });
    await expect(users.createUser({ email: 'dupe@example.com' })).rejects.toThrow();
  });

  it('links an OAuth account and resolves the user through it', async () => {
    const users = repo();
    const created = await users.createUser({ email: 'linked@example.com' });
    await users.linkOAuthAccount('google', 'sub-123', created.id);

    const found = await users.getUserByOAuthAccount('google', 'sub-123');
    expect(found?.id).toBe(created.id);
    expect(await users.getUserByOAuthAccount('google', 'other-sub')).toBeNull();
  });

  it('rejects double-linking the same OAuth identity', async () => {
    const users = repo();
    const a = await users.createUser({ email: 'a@example.com' });
    const b = await users.createUser({ email: 'b@example.com' });
    await users.linkOAuthAccount('google', 'sub-1', a.id);
    await expect(users.linkOAuthAccount('google', 'sub-1', b.id)).rejects.toThrow();
  });
});
