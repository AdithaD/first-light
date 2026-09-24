/**
 * Test-only `Database` implementation backed by real SQLite (node:sqlite,
 * built into Node — no new dependencies). Applies the actual migration files,
 * so repository tests exercise true SQL semantics. NOT imported by app code.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import type { Database, DbStatement } from '../../src/lib/server/repository/db';

export function createTestDatabase(): Database {
  const sqlite = new DatabaseSync(':memory:');

  const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    sqlite.exec(readFileSync(`${migrationsDir}/${file}`, 'utf8'));
  }

  type Params = (string | number | bigint | null)[];
  const wrap = (sql: string): DbStatement => {
    const stmt = sqlite.prepare(sql);
    let bound: Params = [];
    return {
      bind(...values) {
        bound = values;
        return this;
      },
      async first<T>(): Promise<T | null> {
        const row = stmt.get(...bound) as T | undefined;
        return row ?? null;
      },
      async all<T>(): Promise<{ results: T[] }> {
        return { results: stmt.all(...bound) as T[] };
      },
      async run(): Promise<unknown> {
        return stmt.run(...bound);
      },
    };
  };

  return {
    prepare: wrap,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) await statement.run();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
