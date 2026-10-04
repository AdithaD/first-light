import { describe, expect, it, vi } from 'vitest';
import {
  fetchOpenMeteoForecast,
  type ForecastFetch,
} from '../../src/lib/server/integrations/open-meteo/forecast';

const location = { latitude: -37.8136, longitude: 144.9631, timezone: 'Australia/Melbourne' };

function payload(): unknown {
  return {
    latitude: -37.81,
    longitude: 144.96,
    timezone: 'Australia/Melbourne',
    current: {
      time: '2026-09-25T11:00',
      temperature_2m: 18.4,
      apparent_temperature: 17.9,
      precipitation: 0,
      weather_code: 2,
      wind_speed_10m: 12.2,
    },
    current_units: {
      temperature_2m: '°C',
      precipitation: 'mm',
      wind_speed_10m: 'km/h',
    },
    daily: {
      time: ['2026-09-25', '2026-09-26'],
      temperature_2m_max: [21.1, 19.2],
      temperature_2m_min: [12.3, 11.7],
      precipitation_probability_max: [10, 35],
      weather_code: [2, 61],
    },
    daily_units: {
      temperature_2m_max: '°C',
      precipitation_probability_max: '%',
    },
  };
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

describe('Open-Meteo forecast integration', () => {
  it('requests minimal current and two-day data in the user timezone and maps it', async () => {
    const fetcher = vi.fn<ForecastFetch>(async () => response(payload()));
    const forecast = await fetchOpenMeteoForecast(location, fetcher);
    const url = new URL(String(fetcher.mock.calls[0][0]));

    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('current')).toContain('temperature_2m');
    expect(url.searchParams.get('daily')).toContain('precipitation_probability_max');
    expect(url.searchParams.get('forecast_days')).toBe('2');
    expect(url.searchParams.get('timezone')).toBe('Australia/Melbourne');
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(forecast).toMatchObject({
      timezone: 'Australia/Melbourne',
      current: { temperature: 18.4, feelsLike: 17.9, weatherCode: 2 },
      days: [
        { date: '2026-09-25', minimumTemperature: 12.3, maximumTemperature: 21.1 },
        { date: '2026-09-26', precipitationProbability: 35, weatherCode: 61 },
      ],
    });
  });

  it('rejects invalid locations and timezones before fetching', async () => {
    const fetcher = vi.fn<ForecastFetch>(async () => response(payload()));
    await expect(fetchOpenMeteoForecast({ ...location, latitude: 91 }, fetcher)).rejects.toThrow(
      /valid weather location/i,
    );
    await expect(
      fetchOpenMeteoForecast({ ...location, timezone: 'Not/AZone' }, fetcher),
    ).rejects.toThrow(/valid timezone/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalises service, network and invalid payload failures', async () => {
    await expect(fetchOpenMeteoForecast(location, async () => response({}, 503))).rejects.toThrow(
      /HTTP 503/,
    );
    await expect(
      fetchOpenMeteoForecast(location, async () => {
        throw new Error('internal network detail');
      }),
    ).rejects.toThrow(/temporarily unavailable/i);
    await expect(
      fetchOpenMeteoForecast(location, async () => response({ daily: {} })),
    ).rejects.toThrow(/invalid forecast data/i);
  });
});
