/**
 * Minimal structural interface for D1 access (ADR-0002).
 *
 * We deliberately do NOT import `@cloudflare/workers-types`: the real D1
 * binding satisfies this interface, and tests provide their own
 * implementation (`testing.ts` — real SQLite via node:sqlite). This keeps
 * the dependency surface at zero and the repository layer portable
 * (charter, ADR-0001).
 */
export interface DbStatement {
  bind(...values: (string | number | bigint | null)[]): DbStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface Database {
  prepare(sql: string): DbStatement;
  batch(statements: DbStatement[]): Promise<unknown>;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function getDb(platform: unknown): Database | null {
  // Structural access: the real platform is `App.Platform` whose `env` shape
  // is provided by the adapter; we intentionally don't depend on its types.
  const env = (platform as { env?: { DB?: unknown } } | null | undefined)?.env;
  return (env?.DB as Database | undefined) ?? null;
}
