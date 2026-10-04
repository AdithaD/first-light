import { DomUtils, parseDocument } from 'htmlparser2';
import {
  CURATED_TOPICS,
  NEWS_SOURCES,
  normalizePhrase,
  type CuratedTopicId,
  type NewsSourceId,
} from '../../preferences/catalogue';
import type { UserPreference } from '../../repository/preferences';

const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;

export interface NewsArticle {
  sourceId: NewsSourceId;
  sourceLabel: string;
  id: string;
  title: string;
  link: string;
  description: string;
  publishedAt: string | null;
  categories: string[];
}

export interface NewsFeedResult {
  sourceId: NewsSourceId;
  status: 'ok' | 'empty' | 'failed';
  items: NewsArticle[];
  error: string | null;
}

export type NewsFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface NewsFetchOptions {
  fetcher?: NewsFetch;
  /** Cache is deliberately supplied by the caller and scoped to one brief run. */
  cache?: Map<NewsSourceId, { fetchedAt: number; items: NewsArticle[] }>;
  now?: () => number;
}

function directChildren(parent: Parameters<typeof DomUtils.findAll>[1], name: string) {
  // Restrict field lookup to the current RSS element; nested extension tags should not shadow fields.
  return DomUtils.findAll((node) => node.name === name && node.parent === parent, parent);
}

function textOfDirectChild(parent: Parameters<typeof DomUtils.findAll>[1], name: string): string {
  const child = directChildren(parent, name)[0];
  return child ? DomUtils.textContent(child).trim() : '';
}

/** Convert one approved RSS document to the app's compact article shape. */
function parseItems(xml: string, sourceId: NewsSourceId): NewsArticle[] {
  // Parse as XML and read RSS fields explicitly so repeated <category> tags are retained.
  const document = parseDocument(xml, { xmlMode: true, decodeEntities: true });
  const root = DomUtils.findOne((node) => node.name === 'rss', document);
  if (!root) throw new Error('The response is not an RSS document.');
  const channel = directChildren(root, 'channel')[0];
  if (!channel) throw new Error('The RSS document has no channel.');

  const source = NEWS_SOURCES.find((entry) => entry.id === sourceId);
  if (!source) throw new Error('The RSS source is not approved.');

  return directChildren(channel, 'item').flatMap((item) => {
    const title = textOfDirectChild(item, 'title');
    const link = textOfDirectChild(item, 'link');
    if (!title || !link) return [];
    let parsedLink: URL;
    try {
      parsedLink = new URL(link);
    } catch {
      return [];
    }
    if (
      parsedLink.protocol !== 'https:' ||
      (parsedLink.hostname !== 'abc.net.au' && !parsedLink.hostname.endsWith('.abc.net.au'))
    ) {
      return [];
    }

    const rawDate = textOfDirectChild(item, 'pubDate');
    const timestamp = rawDate ? Date.parse(rawDate) : Number.NaN;
    const guid = textOfDirectChild(item, 'guid');

    return [
      {
        sourceId,
        sourceLabel: source.label,
        id: guid || link,
        title,
        link,
        description: textOfDirectChild(item, 'description'),
        publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
        categories: directChildren(item, 'category')
          .map((node) => DomUtils.textContent(node).trim())
          .filter(Boolean),
      },
    ];
  });
}

/** Apply the app's best-effort topic hints to title/description/category metadata. */
function matchesPreferences(article: NewsArticle, topics: UserPreference['topics']): boolean {
  const searchable = normalizePhrase(
    [article.title, article.description, ...article.categories].join(' '),
  );
  // Exclusions always win; otherwise, configured includes use OR semantics as relevance hints.
  const exclusions = topics.filter((topic) => topic.kind === 'exclude');
  if (exclusions.some((topic) => searchable.includes(normalizePhrase(topic.value)))) return false;

  const includes = topics.filter((topic) => topic.kind !== 'exclude');
  if (includes.length === 0) return true;

  return includes.some((topic) => {
    if (topic.kind === 'custom') return searchable.includes(normalizePhrase(topic.value));
    const curated = CURATED_TOPICS.find(
      (candidate) => candidate.id === (topic.value as CuratedTopicId),
    );
    return (
      curated?.categoryAliases.some((alias) =>
        article.categories.some((category) => normalizePhrase(category) === normalizePhrase(alias)),
      ) ?? false
    );
  });
}

async function fetchFeed(
  sourceId: NewsSourceId,
  options: NewsFetchOptions,
  now: () => number,
): Promise<NewsArticle[]> {
  // Reuse fresh data only when the caller explicitly supplies a run-scoped cache.
  const cached = options.cache?.get(sourceId);
  const timestamp = now();
  if (cached && timestamp - cached.fetchedAt < CACHE_TTL_MS) return cached.items;

  const source = NEWS_SOURCES.find((entry) => entry.id === sourceId);
  if (!source) throw new Error('The RSS source is not approved.');

  // The registry supplies URLs; callers cannot turn user input into arbitrary outbound requests.
  const response = await (options.fetcher ?? fetch)(source.url, {
    headers: {
      accept: 'application/rss+xml, application/xml, text/xml;q=0.9',
      'user-agent': 'First-Light/0.1.0',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`RSS request failed with HTTP ${response.status}.`);

  // Check both declared and streamed sizes: servers may omit or misstate Content-Length.
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_FEED_BYTES) {
    throw new Error('The RSS response exceeded the size limit.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The RSS response has no body.');
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let xml = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new Error('The RSS response exceeded the size limit.');
      }
      xml += decoder.decode(value, { stream: true });
    }
    xml += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  const items = parseItems(xml, sourceId);
  options.cache?.set(sourceId, { fetchedAt: timestamp, items });
  return items;
}

/** Resolve preference source mode to registered IDs only; never trust stored values as URLs. */
function resolveSourceIds(
  preferences: Pick<UserPreference, 'sourceMode' | 'selectedSourceIds'>,
): NewsSourceId[] {
  if (preferences.sourceMode === 'all') return NEWS_SOURCES.map((source) => source.id);
  const selected = new Set(preferences.selectedSourceIds);
  return NEWS_SOURCES.filter((source) => selected.has(source.id)).map((source) => source.id);
}

/** Fetch approved ABC feeds independently and apply best-effort local relevance matching. */
export async function fetchAbcNews(
  preferences: Pick<UserPreference, 'newsEnabled' | 'sourceMode' | 'selectedSourceIds' | 'topics'>,
  options: NewsFetchOptions = {},
): Promise<NewsFeedResult[]> {
  if (!preferences.newsEnabled) return [];

  const now = options.now ?? Date.now;
  // Promise.all preserves registry order while each catch keeps one feed failure local to that feed.
  return Promise.all(
    resolveSourceIds(preferences).map(async (sourceId): Promise<NewsFeedResult> => {
      try {
        const articles = await fetchFeed(sourceId, options, now);
        const items = articles.filter((article) => matchesPreferences(article, preferences.topics));
        return { sourceId, status: items.length > 0 ? 'ok' : 'empty', items, error: null };
      } catch (error) {
        return {
          sourceId,
          status: 'failed',
          items: [],
          error: error instanceof Error ? error.message : 'Unknown ABC feed error.',
        };
      }
    }),
  );
}
