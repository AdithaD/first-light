import { fetchAbcNews, type NewsFeedResult } from '../integrations/abc-news/rss';
import { fetchOpenMeteoForecast, type WeatherForecast } from '../integrations/open-meteo/forecast';
import type { UserPreference } from '../repository/preferences';

export interface WeatherDebugResult {
  status: 'ok' | 'failed' | 'disabled' | 'not-configured';
  data: WeatherForecast | null;
  error: string | null;
}

export interface NewsDebugResult {
  status: 'ok' | 'empty' | 'failed' | 'disabled' | 'not-configured';
  feeds: NewsFeedResult[];
  error: string | null;
}

export interface RawDebugData {
  weather: WeatherDebugResult;
  news: NewsDebugResult;
}

/** Fetch each enabled provider module independently for the user's debug view. */
export async function loadRawDebugData(preferences: UserPreference): Promise<RawDebugData> {
  // Disabled or incomplete modules produce explicit states instead of provider calls or thrown errors.
  const weatherPromise: Promise<WeatherDebugResult> = !preferences.weatherEnabled
    ? Promise.resolve({ status: 'disabled', data: null, error: null })
    : preferences.latitude === null || preferences.longitude === null
      ? Promise.resolve({
          status: 'not-configured',
          data: null,
          error: 'Choose a location in your account preferences to enable weather.',
        })
      : fetchOpenMeteoForecast({
          latitude: preferences.latitude,
          longitude: preferences.longitude,
          timezone: preferences.timezone,
        })
          .then((data) => ({ status: 'ok' as const, data, error: null }))
          .catch((cause: unknown) => ({
            status: 'failed' as const,
            data: null,
            error: cause instanceof Error ? cause.message : 'Weather forecast failed.',
          }));

  const newsPromise: Promise<NewsDebugResult> = !preferences.newsEnabled
    ? Promise.resolve({ status: 'disabled', feeds: [], error: null })
    : preferences.sourceMode === 'selected' && preferences.selectedSourceIds.length === 0
      ? Promise.resolve({
          status: 'not-configured',
          feeds: [],
          error: 'Select at least one approved news source in your account preferences.',
        })
      : fetchAbcNews(preferences)
          .then((feeds) => ({
            status: feeds.some((feed) => feed.status === 'ok')
              ? ('ok' as const)
              : feeds.some((feed) => feed.status === 'failed')
                ? ('failed' as const)
                : ('empty' as const),
            feeds,
            error: null,
          }))
          .catch((cause: unknown) => ({
            status: 'failed' as const,
            feeds: [],
            error: cause instanceof Error ? cause.message : 'News fetch failed.',
          }));

  // Fetch modules concurrently, but keep their outcomes independent for partial diagnostics.
  const [weather, news] = await Promise.all([weatherPromise, newsPromise]);
  return { weather, news };
}
