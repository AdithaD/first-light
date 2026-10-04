import { describe, expect, it, vi } from 'vitest';
import type { Database, DbStatement } from '../../src/lib/server/repository/db';
import {
  getUserPreferences,
  saveUserPreferences,
  type SaveUserPreferenceInput,
} from '../../src/lib/server/repository/preferences';

const validInput: SaveUserPreferenceInput = {
  userId: 'user-1',
  localityName: 'Carlton',
  localityRegion: 'Victoria',
  latitude: -37.8,
  longitude: 144.97,
  timezone: 'Australia/Melbourne',
  deliveryLocalTime: '07:00',
  digestLength: 'concise',
  sourceMode: 'selected',
  weatherEnabled: true,
  newsEnabled: true,
  selectedSourceIds: ['abc-top-stories'],
  topics: [
    { kind: 'curated', value: 'sport' },
    { kind: 'custom', value: 'local council' },
    { kind: 'exclude', value: 'celebrity gossip' },
  ],
};

function makeDatabase(
  results: {
    first?: Record<string, unknown> | null;
    topics?: Record<string, unknown>[];
    sources?: Record<string, unknown>[];
    all?: Record<string, unknown>[];
  } = {},
) {
  const prepared: Array<{ sql: string; values: unknown[] }> = [];
  let lastBatch: DbStatement[] = [];
  const tables = new Set(['user_preference_topics', 'user_preference_sources']);
  const batch = vi.fn(async (statements: DbStatement[]) => {
    lastBatch = statements;
    return statements;
  });

  const db: Database = {
    prepare(sql) {
      const tableMatch = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+([a-z_]+)/iu);
      if (tableMatch) tables.add(tableMatch[1]);
      const record = { sql, values: [] as unknown[] };
      prepared.push(record);
      const statement: DbStatement = {
        bind(...values) {
          record.values = values;
          return statement;
        },
        async first<T>() {
          return (results.first ?? null) as T | null;
        },
        async all<T>() {
          const rows = sql.includes('user_preference_topics')
            ? (results.topics ?? [])
            : (results.sources ?? []);
          return { results: rows as T[] };
        },
        async run() {
          return { success: true };
        },
      };
      return statement;
    },
    async batch(statements) {
      return batch(statements);
    },
  };

  return { db, prepared, batch, getBatch: () => lastBatch };
}

describe('user preference repository', () => {
  it('reads core preferences, topics, and selected source IDs', async () => {
    const { db, prepared } = makeDatabase({
      first: {
        user_id: 'user-1',
        locality_name: 'Carlton',
        locality_region: 'Victoria',
        latitude: -37.8,
        longitude: 144.97,
        timezone: 'Australia/Melbourne',
        delivery_local_time: '07:00',
        digest_length: 'concise',
        source_mode: 'selected',
        weather_enabled: 1,
        news_enabled: 1,
      },
      topics: [
        { kind: 'custom', value: 'local council' },
        { kind: 'curated', value: 'sport' },
      ],
      sources: [{ source_id: 'abc-top-stories' }],
    });

    const preference = await getUserPreferences(db, 'user-1');
    expect(preference).toMatchObject({
      userId: 'user-1',
      localityName: 'Carlton',
      localityRegion: 'Victoria',
      latitude: -37.8,
      sourceMode: 'selected',
      selectedSourceIds: ['abc-top-stories'],
    });
    expect(preference?.topics).toHaveLength(2);
    expect(preference?.selectedSourceIds).toStrictEqual(['abc-top-stories']);
    expect(prepared[0].values).toStrictEqual(['user-1']);
  });

  it('returns null if no preference row has been saved', async () => {
    const { db } = makeDatabase();
    await expect(getUserPreferences(db, 'new-user')).resolves.toBeNull();
  });

  it('saves core fields and replaces child selections atomically in one D1 batch', async () => {
    const { db, batch, getBatch } = makeDatabase();
    await saveUserPreferences(db, validInput);
    expect(batch).toHaveBeenCalledOnce();
    expect(getBatch()).toHaveLength(7);
  });

  it('stores no selected-source child rows in all-source mode', async () => {
    const { db, getBatch, prepared } = makeDatabase();
    await saveUserPreferences(db, {
      ...validInput,
      sourceMode: 'all',
      selectedSourceIds: [],
      topics: [],
    });
    const statements = getBatch();
    expect(statements).toHaveLength(3);
    expect(prepared.some(({ sql }) => sql.includes('INSERT INTO user_preference_sources'))).toBe(
      false,
    );
  });

  it('allows Weather off without coordinates and preserves News child rows while News is off', async () => {
    const { db, getBatch, prepared } = makeDatabase();
    await saveUserPreferences(db, {
      ...validInput,
      weatherEnabled: false,
      newsEnabled: false,
      localityName: null,
      localityRegion: null,
      latitude: null,
      longitude: null,
    });

    expect(getBatch()).toHaveLength(1);
    expect(prepared.some(({ sql }) => sql.includes('DELETE FROM user_preference_topics'))).toBe(
      false,
    );
    expect(prepared.some(({ sql }) => sql.includes('DELETE FROM user_preference_sources'))).toBe(
      false,
    );
    expect(prepared[0].values[9]).toBe(0);
    expect(prepared[0].values[10]).toBe(0);
  });

  it('does not validate or clear News configuration while News is disabled', async () => {
    const { db, batch, getBatch } = makeDatabase();
    await saveUserPreferences(db, {
      ...validInput,
      newsEnabled: false,
      sourceMode: 'selected',
      selectedSourceIds: ['not-currently-registered'],
      topics: [{ kind: 'curated', value: 'not-currently-in-catalogue' }],
    });
    expect(batch).toHaveBeenCalledOnce();
    expect(getBatch()).toHaveLength(1);
  });

  it('rejects invalid source IDs and coordinates before any database writes', async () => {
    const { db, batch } = makeDatabase();
    await expect(
      saveUserPreferences(db, {
        ...validInput,
        selectedSourceIds: ['https://other.example/rss.xml'],
      }),
    ).rejects.toThrow(/not approved/);
    await expect(saveUserPreferences(db, { ...validInput, latitude: 100 })).rejects.toThrow(
      /coordinates/,
    );
    expect(batch).not.toHaveBeenCalled();
  });

  it('rejects unknown curated topics and unsupported timezones before any database writes', async () => {
    const { db, batch } = makeDatabase();
    await expect(
      saveUserPreferences(db, {
        ...validInput,
        topics: [{ kind: 'curated', value: 'invented-topic' }],
      }),
    ).rejects.toThrow(/topic identifier is invalid/);
    await expect(
      saveUserPreferences(db, { ...validInput, timezone: 'Mars/Olympus' }),
    ).rejects.toThrow(/valid timezone/);
    expect(batch).not.toHaveBeenCalled();
  });
});
