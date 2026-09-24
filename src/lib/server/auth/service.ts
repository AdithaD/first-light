/**
 * Auth service: signup / login / password change, backed by the repositories
 * and WebCrypto PBKDF2 (ADR-0005). Framework-agnostic — routes and tests
 * construct it with the same factory.
 *
 * Design notes:
 * - Typed errors (mapped to user-facing messages by routes, no string matching).
 * - Login runs a dummy verification for unknown emails: uniform timing, no
 *   user enumeration.
 * - Password signup against an existing account raises EmailTakenError;
 *   coexistence linking happens via the OAuth verified-email path (ADR-0005).
 */
import { createSessionRepository, type SessionRepository } from '$lib/server/repository/sessions';
import { createUserRepository, type UserRepository } from '$lib/server/repository/users';
import type { Database } from '$lib/server/repository/db';
import { hashPassword, verifyPassword } from './password';

export class AuthError extends Error {}
export class InvalidEmailError extends AuthError {}
export class WeakPasswordError extends AuthError {}
export class EmailTakenError extends AuthError {}
export class InvalidCredentialsError extends AuthError {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

/** Constant dummy hash so unknown-email logins cost the same as real ones. */
export const DUMMY_HASH_FOR_TESTS =
  'pbkdf2$sha256$100000$n0Yg3jR0362YS_m7Dsj8mQ$PKjV-O1xjt29DV-we3Eaq9uoLmLxqfA88tz6H5Ty2hk';

export type PasswordHasher = {
  hash: (password: string, opts?: { iterations?: number }) => Promise<string>;
  verify: (password: string, stored: string) => Promise<boolean>;
};

export interface AuthDeps {
  users: Pick<
    UserRepository,
    'getUserByEmail' | 'createUser' | 'getPasswordHash' | 'updatePasswordHash'
  >;
  sessions: Pick<SessionRepository, 'create'>;
  hash: PasswordHasher['hash'];
  verify: PasswordHasher['verify'];
  /** PBKDF2 iterations for NEW hashes (tests pass a small value). */
  iterations?: number;
}

export function createAuthService(deps: AuthDeps) {
  const { users, sessions, hash, verify, iterations } = deps;

  return {
    /** Signup: creates user + password credential, returns a session token. */
    async signup(input: {
      email: string;
      password: string;
      displayName?: string;
    }): Promise<string> {
      const email = input.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new InvalidEmailError();
      if (input.password.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError();

      if (await users.getUserByEmail(email)) throw new EmailTakenError();

      const passwordHash = await hash(input.password, iterations ? { iterations } : undefined);
      const user = await users.createUser({ email, displayName: input.displayName, passwordHash });
      return sessions.create(user.id);
    },

    /** Login: verifies the password, returns a session token. */
    async login(input: { email: string; password: string }): Promise<string> {
      const email = input.email.trim().toLowerCase();
      const user = await users.getUserByEmail(email);
      const stored = user
        ? ((await users.getPasswordHash(user.id)) ?? DUMMY_HASH_FOR_TESTS)
        : DUMMY_HASH_FOR_TESTS;
      const ok = await verify(input.password, stored);
      if (!user || !ok) throw new InvalidCredentialsError(); // uniform: no enumeration
      return sessions.create(user.id);
    },

    /** Password change (re-verifies the current password first). */
    async changePassword(userId: string, current: string, next: string): Promise<void> {
      if (next.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError();
      const stored = await users.getPasswordHash(userId);
      if (!stored || !(await verify(current, stored))) throw new InvalidCredentialsError();
      await users.updatePasswordHash(
        userId,
        await hash(next, iterations ? { iterations } : undefined),
      );
    },
  };
}

/** Default wiring: D1 repositories + the PBKDF2 module. */
export function createDefaultAuthService(db: Database, iterations?: number) {
  return createAuthService({
    users: createUserRepository(db),
    sessions: createSessionRepository(db),
    hash: hashPassword,
    verify: verifyPassword,
    iterations,
  });
}
