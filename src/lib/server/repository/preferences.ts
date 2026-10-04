import { isoNow, type Database, type DbStatement } from './db';
import {
  isCuratedTopicId,
  isNewsSourceId,
  isValidTimeZone,
  normalizePhrase,
} from '../preferences/catalogue';

export type DigestLength = 'concise' | 'standard';
export type SourceMode = 'all' | 'selected';
export type TopicKind = 'curated' | 'custom' | 'exclude';

export interface UserPreference {
  userId: string;
  localityName: string | null;
  localityRegion: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  deliveryLocalTime: string;
  digestLength: DigestLength;
  sourceMode: SourceMode;
  weatherEnabled: boolean;
  newsEnabled: boolean;
  topics: Array<{ kind: TopicKind; value: string }>;
  selectedSourceIds: string[];
}

export interface SaveUserPreferenceInput {
  userId: string;
  localityName: string | null;
  localityRegion: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  deliveryLocalTime: string;
  digestLength: DigestLength;
  sourceMode: SourceMode;
  weatherEnabled: boolean;
  newsEnabled: boolean;
  topics: Array<{ kind: TopicKind; value: string }>;
  selectedSourceIds: string[];
}

interface PreferenceRow {
  user_id: string;
  locality_name: string | null;
  locality_region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  delivery_local_time: string;
  digest_length: DigestLength;
  source_mode: SourceMode;
  weather_enabled: number;
  news_enabled: number;
}

interface TopicRow {
  kind: TopicKind;
  value: string;
}

interface SourceRow {
  source_id: string;
}

/** Load one user's preference row together with its topic and selected-source details. */
export async function getUserPreferences(
  db: Database,
  userId: string,
): Promise<UserPreference | null> {
  const row = await db
    .prepare(
      `SELECT user_id, locality_name, locality_region, latitude, longitude,
        timezone, delivery_local_time, digest_length, source_mode,
        weather_enabled, news_enabled
       FROM user_preferences WHERE user_id = ?`,
    )
    .bind(userId)
    .first<PreferenceRow>();

  if (!row) return null;

  // The preference row, topic rows, and selected sources are separate tables; load the detail rows together.
  const [topics, sources] = await Promise.all([
    db
      .prepare(
        'SELECT kind, value FROM user_preference_topics WHERE user_id = ? ORDER BY kind, value',
      )
      .bind(userId)
      .all<TopicRow>(),
    db
      .prepare('SELECT source_id FROM user_preference_sources WHERE user_id = ? ORDER BY source_id')
      .bind(userId)
      .all<SourceRow>(),
  ]);

  return {
    userId: row.user_id,
    localityName: row.locality_name,
    localityRegion: row.locality_region,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
    deliveryLocalTime: row.delivery_local_time,
    digestLength: row.digest_length,
    sourceMode: row.source_mode,
    weatherEnabled: row.weather_enabled !== 0,
    newsEnabled: row.news_enabled !== 0,
    topics: topics.results,
    selectedSourceIds: sources.results.map((source) => source.source_id),
  };
}

/** Validate and batch-save a user's core preferences plus enabled News selections. */
export async function saveUserPreferences(
  db: Database,
  input: SaveUserPreferenceInput,
): Promise<void> {
  if (!input.userId.trim()) throw new Error('A user ID is required.');

  // Enforce the enabled-weather/location invariant at the persistence boundary too.
  if (input.weatherEnabled) {
    if (
      input.latitude === null ||
      input.longitude === null ||
      !Number.isFinite(input.latitude) ||
      !Number.isFinite(input.longitude) ||
      input.latitude < -90 ||
      input.latitude > 90 ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      throw new Error('Valid coordinates are required when Weather is enabled.');
    }
  } else if (
    (input.latitude === null) !== (input.longitude === null) ||
    (input.latitude !== null &&
      input.longitude !== null &&
      (!Number.isFinite(input.latitude) ||
        !Number.isFinite(input.longitude) ||
        input.latitude < -90 ||
        input.latitude > 90 ||
        input.longitude < -180 ||
        input.longitude > 180))
  ) {
    throw new Error('Coordinates must either both be empty or both be valid.');
  }

  if (!isValidTimeZone(input.timezone)) throw new Error('A valid timezone is required.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(input.deliveryLocalTime)) {
    throw new Error('A valid local delivery time is required.');
  }
  if (!['concise', 'standard'].includes(input.digestLength)) {
    throw new Error('A valid digest length is required.');
  }
  if (!['all', 'selected'].includes(input.sourceMode)) {
    throw new Error('A valid source mode is required.');
  }
  if (
    input.newsEnabled &&
    input.sourceMode === 'selected' &&
    input.selectedSourceIds.length === 0
  ) {
    throw new Error('Select at least one approved source.');
  }
  if (input.newsEnabled && input.selectedSourceIds.some((sourceId) => !isNewsSourceId(sourceId))) {
    throw new Error('A selected source is not approved.');
  }
  if (
    input.newsEnabled &&
    new Set(input.selectedSourceIds).size !== input.selectedSourceIds.length
  ) {
    throw new Error('Duplicate source IDs are not allowed.');
  }
  if (input.newsEnabled && input.topics.length > 24) {
    throw new Error('Too many topic preferences were supplied.');
  }
  if (input.newsEnabled && input.topics.filter((topic) => topic.kind !== 'curated').length > 10) {
    throw new Error('Too many custom or excluded phrases were supplied.');
  }

  if (input.newsEnabled) {
    const topicKeys = new Set<string>();
    for (const topic of input.topics) {
      if (!['curated', 'custom', 'exclude'].includes(topic.kind)) {
        throw new Error('A topic kind is not approved.');
      }
      if (topic.kind === 'curated' && !isCuratedTopicId(topic.value)) {
        throw new Error('A curated topic identifier is invalid.');
      }
      if (
        topic.kind !== 'curated' &&
        (Array.from(topic.value).length < 1 ||
          Array.from(topic.value).length > 80 ||
          topic.value !== normalizePhrase(topic.value))
      ) {
        throw new Error('Custom topic phrases must be normalized and 1–80 characters long.');
      }
      const topicKey = `${topic.kind}:${topic.value}`;
      if (topicKeys.has(topicKey)) throw new Error('Duplicate topic preferences are not allowed.');
      topicKeys.add(topicKey);
    }
  }

  const now = isoNow();
  // D1 has no interactive transactions; one batch keeps the core row and enabled News details in sync.
  const statements: DbStatement[] = [
    db
      .prepare(
        `INSERT INTO user_preferences (
          user_id, locality_name, locality_region, latitude, longitude, timezone,
          delivery_local_time, digest_length, source_mode, weather_enabled,
          news_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          locality_name = excluded.locality_name,
          locality_region = excluded.locality_region,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          timezone = excluded.timezone,
          delivery_local_time = excluded.delivery_local_time,
          digest_length = excluded.digest_length,
          source_mode = excluded.source_mode,
          weather_enabled = excluded.weather_enabled,
          news_enabled = excluded.news_enabled,
          updated_at = excluded.updated_at`,
      )
      .bind(
        input.userId,
        input.localityName,
        input.localityRegion,
        input.latitude,
        input.longitude,
        input.timezone,
        input.deliveryLocalTime,
        input.digestLength,
        input.sourceMode,
        input.weatherEnabled ? 1 : 0,
        input.newsEnabled ? 1 : 0,
        now,
        now,
      ),
  ];

  if (input.newsEnabled) {
    statements.push(
      db.prepare('DELETE FROM user_preference_topics WHERE user_id = ?').bind(input.userId),
      db.prepare('DELETE FROM user_preference_sources WHERE user_id = ?').bind(input.userId),
    );

    for (const topic of input.topics) {
      statements.push(
        db
          .prepare(
            'INSERT INTO user_preference_topics (id, user_id, kind, value, created_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(crypto.randomUUID(), input.userId, topic.kind, topic.value, now),
      );
    }

    if (input.sourceMode === 'selected') {
      for (const sourceId of input.selectedSourceIds) {
        statements.push(
          db
            .prepare('INSERT INTO user_preference_sources (user_id, source_id) VALUES (?, ?)')
            .bind(input.userId, sourceId),
        );
      }
    }
  }

  // When News is disabled, omit child-table writes so the saved topics and source choices are preserved.
  await db.batch(statements);
}
