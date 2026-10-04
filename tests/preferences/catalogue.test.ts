import { describe, expect, it } from 'vitest';
import { CURATED_TOPICS, NEWS_SOURCES } from '../../src/lib/server/preferences/catalogue';

const sampledAbcCategories = new Set([
  'AI',
  'AFL',
  'Australian Rules Football',
  'Business, Economics and Finance',
  "Children's Health",
  'Climate Change',
  'Cost of Living',
  'Economic Trends and Indicators',
  'Federal Government',
  'Financial Markets',
  'Foreign Affairs',
  'Interest Rates',
  'Mental Health',
  'National Parks',
  'Nature',
  'NRL',
  'Public Health',
  'Soccer',
  'Sport',
  'State and Territory Government',
  'Stock Market',
  'War',
  "Women's Health",
  'World Politics',
  'Cricket',
]);

describe('ABC MVP preference catalogue', () => {
  it('uses the verified feed IDs and only category aliases seen in sampled feeds', () => {
    expect(NEWS_SOURCES.map((source) => source.id)).toStrictEqual([
      'abc-top-stories',
      'abc-just-in',
    ]);
    const aliases = CURATED_TOPICS.flatMap((topic) => topic.categoryAliases);
    expect(aliases.length).toBeGreaterThan(0);
    for (const alias of aliases) {
      expect(sampledAbcCategories.has(alias), `Unverified ABC category alias: ${alias}`).toBe(true);
    }
  });
});
