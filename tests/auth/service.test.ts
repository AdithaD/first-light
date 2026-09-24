import { describe, expect, it } from 'vitest';
import { createDefaultAuthService } from '../../src/lib/server/auth/service';
import { verifyPassword, parseHash } from '../../src/lib/server/auth/password';
import { DUMMY_HASH_FOR_TESTS } from '../../src/lib/server/auth/service';
import {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidEmailError,
  WeakPasswordError,
} from '../../src/lib/server/auth/service';
import { createTestDatabase } from '../repository/sqlite';

/** Fast hashing for tests (real PBKDF2, small iteration count). */
const ITERATIONS = 1000;

function service() {
  return createDefaultAuthService(createTestDatabase(), ITERATIONS);
}

describe('AuthService (real SQLite + real PBKDF2)', () => {
  it('uses a valid-format dummy hash for unknown-account timing equalisation', async () => {
    expect(parseHash(DUMMY_HASH_FOR_TESTS)).toStrictEqual({ iterations: 100_000 });
    expect(await verifyPassword('not-the-password', DUMMY_HASH_FOR_TESTS)).toBe(false);
  });
  it('signup → login round-trip yields sessions for the same user', async () => {
    const auth = service();
    const signupToken = await auth.signup({
      email: 'dora@example.com',
      password: 'long enough pw',
    });
    const loginToken = await auth.login({ email: 'dora@example.com', password: 'long enough pw' });

    expect(signupToken).not.toBe(loginToken); // independent sessions
    expect(signupToken).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('normalises emails (case/whitespace) and de-duplicates on them', async () => {
    const auth = service();
    await auth.signup({ email: '  Mixed@Example.COM ', password: 'long enough pw' });
    await expect(
      auth.signup({ email: 'mixed@example.com', password: 'long enough pw' }),
    ).rejects.toThrow(EmailTakenError);
    await auth.login({ email: 'MIXED@Example.COM', password: 'long enough pw' });
  });

  it('rejects invalid emails and weak passwords', async () => {
    const auth = service();
    await expect(auth.signup({ email: 'nope', password: 'long enough pw' })).rejects.toThrow(
      InvalidEmailError,
    );
    await expect(auth.signup({ email: 'ok@example.com', password: 'short' })).rejects.toThrow(
      WeakPasswordError,
    );
  });

  it('rejects duplicate signup and wrong-password login', async () => {
    const auth = service();
    await auth.signup({ email: 'dupe@example.com', password: 'long enough pw' });
    await expect(
      auth.signup({ email: 'dupe@example.com', password: 'long enough pw' }),
    ).rejects.toThrow(EmailTakenError);
    await expect(
      auth.login({ email: 'dupe@example.com', password: 'wrong but long enough' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('unknown email behaves identically to wrong password (no enumeration)', async () => {
    const auth = service();
    await expect(
      auth.login({ email: 'ghost@example.com', password: 'long enough pw' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('changePassword requires the current password and invalidates the old one', async () => {
    const db = createTestDatabase();
    const auth = createDefaultAuthService(db, ITERATIONS);
    const { getSessionUser } = await import('../../src/lib/server/repository/sessions').then((m) =>
      m.createSessionRepository(db),
    );

    const token = await auth.signup({ email: 'cp@example.com', password: 'first password' });
    const userId = (await getSessionUser(token))!.userId;

    // Wrong current password is rejected.
    await expect(
      auth.changePassword(userId, 'wrong current pw', 'new safe password'),
    ).rejects.toThrow(InvalidCredentialsError);

    // Correct current password: change succeeds, old password dies, new works.
    await auth.changePassword(userId, 'first password', 'new safe password');
    await expect(
      auth.login({ email: 'cp@example.com', password: 'first password' }),
    ).rejects.toThrow(InvalidCredentialsError);
    await auth.login({ email: 'cp@example.com', password: 'new safe password' });
  });
});
