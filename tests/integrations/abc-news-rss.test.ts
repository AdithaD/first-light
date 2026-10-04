import { describe, expect, it, vi } from 'vitest';
import { fetchAbcNews, type NewsArticle } from '../../src/lib/server/integrations/abc-news/rss';
import type { NewsSourceId } from '../../src/lib/server/preferences/catalogue';
import type { UserPreference } from '../../src/lib/server/repository/preferences';

const preferences: Pick<
  UserPreference,
  'newsEnabled' | 'sourceMode' | 'selectedSourceIds' | 'topics'
> = {
  newsEnabled: true,
  sourceMode: 'all',
  selectedSourceIds: [],
  topics: [],
};

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>ABC News</title>
  <item><guid>story-1</guid><title>Parliament debate focuses on climate</title>
    <link>https://www.abc.net.au/news/2026-09-25/story/1</link>
    <description>Federal Government considers climate policy &amp; targets.</description>
    <pubDate>Fri, 25 Sep 2026 01:00:00 GMT</pubDate>
    <category>Federal Government</category><category>Climate Change</category>
  </item>
  <item><title>Local sport results</title><link>https://www.abc.net.au/news/2026-09-25/story/2</link>
    <description><![CDATA[Final results &amp; analysis]]></description><category>Sport</category>
  </item>
  <item><title>Missing link is skipped</title><category>Sport</category></item>
</channel></rss>`;

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/rss+xml' } });
}

function article(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    sourceId: 'abc-top-stories',
    sourceLabel: 'ABC News — Top Stories',
    id: 'story-1',
    title: 'Parliament debate focuses on climate',
    link: 'https://www.abc.net.au/news/2026-09-25/story/1',
    description: 'Federal Government considers climate policy & targets.',
    publishedAt: '2026-09-25T01:00:00.000Z',
    categories: ['Federal Government', 'Climate Change'],
    ...overrides,
  };
}

describe('ABC RSS integration', () => {
  it('parses XML entities, CDATA, repeated categories and article metadata', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(String(input)).hostname).toBe('www.abc.net.au');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return response(rss);
    });
    const [feed] = await fetchAbcNews(preferences, { fetcher });

    expect(feed.status).toBe('ok');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toStrictEqual(article());
    expect(feed.items[1]).toMatchObject({
      title: 'Local sport results',
      description: 'Final results &amp; analysis',
      categories: ['Sport'],
      publishedAt: null,
    });
  });

  it('isolates failures per feed and keeps successful sources available', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('45910') ? response(rss) : response('Unavailable', 503),
    );
    const results = await fetchAbcNews(preferences, { fetcher });

    expect(results.map(({ sourceId, status }) => [sourceId, status])).toStrictEqual([
      ['abc-top-stories', 'ok'],
      ['abc-just-in', 'failed'],
    ]);
    expect(results[1].error).toContain('HTTP 503');
    expect(results[0].items).toHaveLength(2);
  });

  it('limits selected mode to approved feeds and skips all fetches when News is disabled', async () => {
    const fetcher = vi.fn(async () => response(rss));
    const selected = await fetchAbcNews(
      {
        ...preferences,
        sourceMode: 'selected',
        selectedSourceIds: ['abc-just-in', 'not-approved'],
      },
      { fetcher },
    );
    expect(selected.map((result) => result.sourceId)).toStrictEqual(['abc-just-in']);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await expect(
      fetchAbcNews({ ...preferences, newsEnabled: false }, { fetcher }),
    ).resolves.toStrictEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('applies curated category and custom phrase includes, then exclusions', async () => {
    const fetcher = vi.fn(async () => response(rss));
    const curated = await fetchAbcNews(
      {
        ...preferences,
        sourceMode: 'selected',
        selectedSourceIds: ['abc-top-stories'],
        topics: [{ kind: 'curated', value: 'australian-politics' }],
      },
      { fetcher },
    );
    expect(curated[0].items.map((item) => item.id)).toStrictEqual(['story-1']);

    const custom = await fetchAbcNews(
      {
        ...preferences,
        sourceMode: 'selected',
        selectedSourceIds: ['abc-top-stories'],
        topics: [{ kind: 'custom', value: 'climate policy' }],
      },
      { fetcher },
    );
    expect(custom[0].items.map((item) => item.id)).toStrictEqual(['story-1']);

    const excluded = await fetchAbcNews(
      {
        ...preferences,
        sourceMode: 'selected',
        selectedSourceIds: ['abc-top-stories'],
        topics: [
          { kind: 'custom', value: 'climate' },
          { kind: 'exclude', value: 'federal government' },
        ],
      },
      { fetcher },
    );
    expect(excluded[0]).toMatchObject({ status: 'empty', items: [] });
  });

  it('reports invalid feeds independently and caches successful feeds for one supplied run', async () => {
    const cache = new Map<NewsSourceId, { fetchedAt: number; items: NewsArticle[] }>();
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('45910') ? response('<not-rss/>') : response(rss),
    );
    const options = { cache, fetcher, now: () => 1000 };
    const first = await fetchAbcNews(preferences, options);
    expect(first[0]).toMatchObject({ status: 'failed', items: [] });
    expect(first[1].status).toBe('ok');

    const second = await fetchAbcNews(preferences, options);
    expect(second[1].items).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('expires cached data after one hour and rejects oversized feed bodies', async () => {
    const cache = new Map<NewsSourceId, { fetchedAt: number; items: NewsArticle[] }>();
    const fetcher = vi.fn(async () => response(rss));
    const options = { cache, fetcher, now: () => 1000 };
    await fetchAbcNews(
      { ...preferences, sourceMode: 'selected', selectedSourceIds: ['abc-top-stories'] },
      options,
    );
    await fetchAbcNews(
      { ...preferences, sourceMode: 'selected', selectedSourceIds: ['abc-top-stories'] },
      { ...options, now: () => 1000 + 60 * 60 * 1000 },
    );
    expect(fetcher).toHaveBeenCalledTimes(2);

    const largeBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
        controller.close();
      },
    });
    const [result] = await fetchAbcNews(
      { ...preferences, sourceMode: 'selected', selectedSourceIds: ['abc-top-stories'] },
      { fetcher: async () => new Response(largeBody) },
    );
    expect(result).toMatchObject({ status: 'failed', items: [] });
    expect(result.error).toContain('size limit');
  });

  it('fails closed for articles with unsafe links and skips malformed optional metadata', async () => {
    const unsafe = rss.replace(
      'https://www.abc.net.au/news/2026-09-25/story/2',
      'javascript:alert(1)',
    );
    const [result] = await fetchAbcNews(
      { ...preferences, sourceMode: 'selected', selectedSourceIds: ['abc-top-stories'] },
      { fetcher: async () => response(unsafe) },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].link.startsWith('https://')).toBe(true);
  });
});
