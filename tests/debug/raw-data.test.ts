import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRawDebugData } from '../../src/lib/server/debug/raw-data';
import type { UserPreference } from '../../src/lib/server/repository/preferences';

const mocks = vi.hoisted(() => ({
  fetchAbcNews: vi.fn(),
  fetchOpenMeteoForecast: vi.fn(),
}));

vi.mock('../../src/lib/server/integrations/abc-news/rss', () => ({
  fetchAbcNews: mocks.fetchAbcNews,
}));
vi.mock('../../src/lib/server/integrations/open-meteo/forecast', () => ({
  fetchOpenMeteoForecast: mocks.fetchOpenMeteoForecast,
}));

const preferences: UserPreference = {
  userId: 'user-1',
  localityName: 'Melbourne',
  localityRegion: 'Victoria',
  latitude: -37.8,
  longitude: 144.9,
  timezone: 'Australia/Melbourne',
  deliveryLocalTime: '07:00',
  digestLength: 'concise',
  sourceMode: 'all',
  weatherEnabled: true,
  newsEnabled: true,
  topics: [],
  selectedSourceIds: [],
};

describe('raw provider debug data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchOpenMeteoForecast.mockResolvedValue({ current: {}, days: [] });
    mocks.fetchAbcNews.mockResolvedValue([]);
  });

  it('fetches enabled modules concurrently and reports each result independently', async () => {
    mocks.fetchOpenMeteoForecast.mockRejectedValue(new Error('Weather unavailable'));
    mocks.fetchAbcNews.mockResolvedValue([
      { sourceId: 'abc-top-stories', status: 'ok', items: [{ id: 'story-1' }], error: null },
      { sourceId: 'abc-just-in', status: 'failed', items: [], error: 'Feed timeout' },
    ]);

    await expect(loadRawDebugData(preferences)).resolves.toMatchObject({
      weather: { status: 'failed', data: null, error: 'Weather unavailable' },
      news: { status: 'ok', feeds: [{ status: 'ok' }, { status: 'failed' }] },
    });
  });

  it('skips disabled modules and reports missing weather location without skipping news', async () => {
    const result = await loadRawDebugData({
      ...preferences,
      weatherEnabled: true,
      latitude: null,
      longitude: null,
    });
    expect(result.weather).toMatchObject({ status: 'not-configured', data: null });
    expect(mocks.fetchOpenMeteoForecast).not.toHaveBeenCalled();
    expect(mocks.fetchAbcNews).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    await expect(
      loadRawDebugData({ ...preferences, weatherEnabled: false, newsEnabled: false }),
    ).resolves.toMatchObject({
      weather: { status: 'disabled', data: null },
      news: { status: 'disabled', feeds: [] },
    });
    expect(mocks.fetchOpenMeteoForecast).not.toHaveBeenCalled();
    expect(mocks.fetchAbcNews).not.toHaveBeenCalled();
  });
});
