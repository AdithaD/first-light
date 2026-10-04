import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const userPreferences = sqliteTable(
  'user_preferences',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    localityName: text('locality_name'),
    localityRegion: text('locality_region'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    timezone: text('timezone').notNull().default('Australia/Sydney'),
    deliveryLocalTime: text('delivery_local_time').notNull().default('07:00'),
    digestLength: text('digest_length').notNull().default('concise'),
    sourceMode: text('source_mode').notNull().default('all'),
    weatherEnabled: integer('weather_enabled', { mode: 'boolean' }).notNull().default(true),
    newsEnabled: integer('news_enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    // Keep module flags and location coordinates consistent even if a write bypasses the repository.
    check('user_preferences_weather_enabled_check', sql`${table.weatherEnabled} IN (0, 1)`),
    check('user_preferences_news_enabled_check', sql`${table.newsEnabled} IN (0, 1)`),
    check(
      'user_preferences_coordinates_check',
      sql`(${table.weatherEnabled} = 0 AND ((${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL AND ${table.latitude} BETWEEN -90 AND 90 AND ${table.longitude} BETWEEN -180 AND 180))) OR (${table.weatherEnabled} = 1 AND ${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL AND ${table.latitude} BETWEEN -90 AND 90 AND ${table.longitude} BETWEEN -180 AND 180)`,
    ),
    check(
      'user_preferences_delivery_time_check',
      sql`length(${table.deliveryLocalTime}) = 5 AND ${table.deliveryLocalTime} GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(${table.deliveryLocalTime}, 1, 2) < '24'`,
    ),
    check(
      'user_preferences_digest_length_check',
      sql`${table.digestLength} IN ('concise', 'standard')`,
    ),
    check('user_preferences_source_mode_check', sql`${table.sourceMode} IN ('all', 'selected')`),
  ],
);

export const userPreferenceTopics = sqliteTable(
  'user_preference_topics',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    value: text('value').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('user_preference_topics_user_kind_value_unique').on(
      table.userId,
      table.kind,
      table.value,
    ),
    index('user_preference_topics_user_idx').on(table.userId),
    check(
      'user_preference_topics_kind_check',
      sql`${table.kind} IN ('curated', 'custom', 'exclude')`,
    ),
    check(
      'user_preference_topics_value_length_check',
      sql`length(${table.value}) BETWEEN 1 AND 80`,
    ),
  ],
);

export const userPreferenceSources = sqliteTable(
  'user_preference_sources',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.sourceId] })],
);

export const storyFeedback = sqliteTable(
  'story_feedback',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').notNull(),
    articleIdentifier: text('article_identifier').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('story_feedback_user_source_article_unique').on(
      table.userId,
      table.sourceId,
      table.articleIdentifier,
    ),
    index('story_feedback_user_idx').on(table.userId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(user, { fields: [userPreferences.userId], references: [user.id] }),
}));
export const userPreferenceTopicsRelations = relations(userPreferenceTopics, ({ one }) => ({
  user: one(user, { fields: [userPreferenceTopics.userId], references: [user.id] }),
}));
export const userPreferenceSourcesRelations = relations(userPreferenceSources, ({ one }) => ({
  user: one(user, { fields: [userPreferenceSources.userId], references: [user.id] }),
}));
export const storyFeedbackRelations = relations(storyFeedback, ({ one }) => ({
  user: one(user, { fields: [storyFeedback.userId], references: [user.id] }),
}));

// Keep Better Auth's tables separate from app-owned preference/feedback tables for adapter boundaries.
export const authSchema = { user, session, account, verification };

export const applicationSchema = {
  user,
  session,
  account,
  verification,
  userPreferences,
  userPreferenceTopics,
  userPreferenceSources,
  storyFeedback,
};
