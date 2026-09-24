import type { Database } from './db';

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createUserRepository(db: Database) {
  function toUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return {
    /**
     * Creates a user (and password credential when provided) atomically.
     * Throws on duplicate email (UNIQUE constraint) — auth layer maps this.
     */
    async createUser(input: {
      email: string;
      displayName?: string;
      passwordHash?: string;
    }): Promise<User> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const statements = [
        db
          .prepare(
            'INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(id, input.email, input.displayName ?? null, now, now),
      ];
      if (input.passwordHash !== undefined) {
        statements.push(
          db
            .prepare(
              'INSERT INTO password_credentials (user_id, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)',
            )
            .bind(id, input.passwordHash, now, now),
        );
      }
      await db.batch(statements);
      return {
        id,
        email: input.email,
        displayName: input.displayName ?? null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async getUserByEmail(email: string): Promise<User | null> {
      const row = await db
        .prepare('SELECT * FROM users WHERE email = ?')
        .bind(email)
        .first<UserRow>();
      return row ? toUser(row) : null;
    },

    async getUserById(id: string): Promise<User | null> {
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
      return row ? toUser(row) : null;
    },

    /** Resolves the user linked to an OAuth identity, if any (ADR-0005). */
    async getUserByOAuthAccount(provider: string, providerAccountId: string): Promise<User | null> {
      const row = await db
        .prepare(
          `SELECT u.* FROM users u
					 JOIN oauth_accounts o ON o.user_id = u.id
					 WHERE o.provider = ? AND o.provider_account_id = ?`,
        )
        .bind(provider, providerAccountId)
        .first<UserRow>();
      return row ? toUser(row) : null;
    },

    /**
     * Links an OAuth identity to a user. Throws if the identity is already
     * linked (PK conflict) — auth layer maps this to a typed error.
     */
    async linkOAuthAccount(
      provider: string,
      providerAccountId: string,
      userId: string,
    ): Promise<void> {
      await db
        .prepare(
          'INSERT INTO oauth_accounts (provider, provider_account_id, user_id, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(provider, providerAccountId, userId, new Date().toISOString())
        .run();
    },

    /** Does this email already have a password credential? (Coexistence routing, ADR-0005.) */
    async hasPasswordCredential(userId: string): Promise<boolean> {
      const row = await db
        .prepare('SELECT user_id FROM password_credentials WHERE user_id = ?')
        .bind(userId)
        .first();
      return row !== null;
    },

    /** Raw stored PBKDF2 hash (auth layer verifies; never leaves the server). */
    async getPasswordHash(userId: string): Promise<string | null> {
      const row = await db
        .prepare('SELECT password_hash FROM password_credentials WHERE user_id = ?')
        .bind(userId)
        .first<{ password_hash: string }>();
      return row?.password_hash ?? null;
    },

    async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
      await db
        .prepare(
          'UPDATE password_credentials SET password_hash = ?, updated_at = ? WHERE user_id = ?',
        )
        .bind(passwordHash, new Date().toISOString(), userId)
        .run();
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
