import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/lib/server/repository/db';

const mocks = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
  loadRawDebugData: vi.fn(),
}));

vi.mock('../../src/lib/server/repository/preferences', () => ({
  getUserPreferences: mocks.getUserPreferences,
}));
vi.mock('../../src/lib/server/debug/raw-data', () => ({
  loadRawDebugData: mocks.loadRawDebugData,
}));

import { load } from '../../src/routes/debug/+page.server';

const basePreferences = {
  userId: 'user-1',
  localityName: 'Melbourne',
  localityRegion: 'Victoria',
  latitude: -37.8,
  longitude: 144.9,
  timezone: 'Australia/Melbourne',
  deliveryLocalTime: '07:00',
  digestLength: 'concise' as const,
  sourceMode: 'all' as const,
  weatherEnabled: true,
  newsEnabled: true,
  topics: [],
  selectedSourceIds: [],
};

function event(overrides: Record<string, unknown> = {}): Parameters<typeof load>[0] {
  return {
    locals: {
      user: { id: 'user-1' },
      session: { id: 'session-1' },
      db: {} as Database,
    },
    setHeaders: vi.fn(),
    ...overrides,
  } as unknown as Parameters<typeof load>[0];
}

describe('authenticated raw-data debug page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserPreferences.mockResolvedValue(basePreferences);
    mocks.loadRawDebugData.mockResolvedValue({
      weather: { status: 'ok', data: { current: {}, days: [] }, error: null },
      news: { status: 'empty', feeds: [], error: null },
    });
  });

  it('redirects requests with no user or session to login', async () => {
    await expect(
      load(event({ locals: { user: null, session: null, db: {} as Database } })),
    ).rejects.toMatchObject({ status: 303, location: '/login' });
    await expect(
      load(event({ locals: { user: { id: 'user-1' }, session: null, db: {} as Database } })),
    ).rejects.toMatchObject({ status: 303, location: '/login' });
    expect(mocks.getUserPreferences).not.toHaveBeenCalled();
  });

  it('does not fetch disabled modules and leaves missing preferences unconfigured', async () => {
    mocks.getUserPreferences.mockResolvedValueOnce(null);
    await expect(load(event())).resolves.toMatchObject({
      modules: {
        weather: { status: 'not-configured', data: null },
        news: { status: 'not-configured', feeds: [] },
      },
    });
    expect(mocks.loadRawDebugData).not.toHaveBeenCalled();

    mocks.getUserPreferences.mockResolvedValueOnce({
      ...basePreferences,
      weatherEnabled: false,
      newsEnabled: false,
    });
    mocks.loadRawDebugData.mockResolvedValueOnce({
      weather: { status: 'disabled', data: null, error: null },
      news: { status: 'disabled', feeds: [], error: null },
    });
    await expect(load(event())).resolves.toMatchObject({
      modules: {
        weather: { status: 'disabled', data: null },
        news: { status: 'disabled', feeds: [] },
      },
    });
    expect(mocks.loadRawDebugData).toHaveBeenCalledTimes(1);
  });

  it('runs enabled sources independently and returns raw results', async () => {
    mocks.loadRawDebugData.mockResolvedValue({
      weather: { status: 'failed', data: null, error: 'Weather provider unavailable' },
      news: { status: 'ok', feeds: [{ sourceId: 'abc-top-stories', status: 'ok' }], error: null },
    });

    const result = await load(event());
    expect(result).toMatchObject({
      modules: {
        weather: { status: 'failed', error: 'Weather provider unavailable' },
        news: { status: 'ok', feeds: [{ sourceId: 'abc-top-stories', status: 'ok' }] },
      },
    });
    expect(mocks.loadRawDebugData).toHaveBeenCalledWith(basePreferences);
  });

  it('marks debug output private and non-cacheable', async () => {
    const setHeaders = vi.fn();
    await load(event({ setHeaders }));
    expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
  });

  it('does not attempt Weather without saved coordinates while preserving enabled News', async () => {
    mocks.getUserPreferences.mockResolvedValue({
      ...basePreferences,
      latitude: null,
      longitude: null,
    });
    mocks.loadRawDebugData.mockResolvedValueOnce({
      weather: { status: 'not-configured', data: null, error: 'No location.' },
      news: { status: 'empty', feeds: [], error: null },
    });
    const result = await load(event());
    expect(result).toMatchObject({
      modules: {
        weather: { status: 'not-configured' },
        news: { status: 'empty' },
      },
    });
    expect(mocks.loadRawDebugData).toHaveBeenCalledTimes(1);
  });
});
