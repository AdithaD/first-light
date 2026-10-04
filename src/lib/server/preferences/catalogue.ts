export const NEWS_SOURCES = [
  {
    id: 'abc-top-stories',
    label: 'ABC News — Top Stories',
    url: 'https://www.abc.net.au/news/feed/45910/rss.xml',
  },
  {
    id: 'abc-just-in',
    label: 'ABC News — Just In',
    url: 'https://www.abc.net.au/news/feed/51120/rss.xml',
  },
] as const;

export type NewsSourceId = (typeof NEWS_SOURCES)[number]['id'];

export const CURATED_TOPICS = [
  {
    id: 'australian-politics',
    label: 'Australian politics',
    categoryAliases: ['Federal Government', 'State and Territory Government'],
  },
  {
    id: 'world-affairs',
    label: 'World affairs',
    categoryAliases: ['World Politics', 'Foreign Affairs', 'War'],
  },
  {
    id: 'business-economy',
    label: 'Business and economy',
    categoryAliases: [
      'Business, Economics and Finance',
      'Economic Trends and Indicators',
      'Financial Markets',
      'Interest Rates',
      'Stock Market',
      'Cost of Living',
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    categoryAliases: ['Sport', 'AFL', 'Australian Rules Football', 'NRL', 'Cricket', 'Soccer'],
  },
  {
    id: 'science-technology',
    label: 'Technology and AI',
    categoryAliases: ['AI'],
  },
  {
    id: 'climate-environment',
    label: 'Climate and environment',
    categoryAliases: ['Climate Change', 'Nature', 'National Parks'],
  },
  {
    id: 'health',
    label: 'Health',
    categoryAliases: ['Mental Health', 'Public Health', "Children's Health", "Women's Health"],
  },
] as const;

export type CuratedTopicId = (typeof CURATED_TOPICS)[number]['id'];

export const MAX_CUSTOM_PHRASES = 10;
export const MAX_PHRASE_LENGTH = 80;

/** Canonicalise phrases identically for validation, persistence, and relevance matching. */
export function normalizePhrase(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-AU');
}

export function isNewsSourceId(value: string): value is NewsSourceId {
  return NEWS_SOURCES.some((source) => source.id === value);
}

export function isCuratedTopicId(value: string): value is CuratedTopicId {
  return CURATED_TOPICS.some((topic) => topic.id === value);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
