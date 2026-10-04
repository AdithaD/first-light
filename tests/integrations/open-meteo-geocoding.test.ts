import { describe, expect, it, vi } from 'vitest';
import { resolveAustralianLocality } from '../../src/lib/server/integrations/open-meteo/geocoding';

function response(results: unknown, ok = true): Response {
  return new Response(JSON.stringify({ results }), {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'application/json' },
  });
}

const melbourne = {
  name: 'Carlton',
  admin1: 'Victoria',
  latitude: -37.8,
  longitude: 144.97,
  timezone: 'Australia/Melbourne',
  country_code: 'AU',
  postcodes: ['3053'],
};

describe('Open-Meteo Australian geocoding client', () => {
  it('resolves a locality, filters to Australia, and accepts exact normalized names', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('countryCode=AU');
      return response([melbourne]);
    });
    const result = await resolveAustralianLocality('  carlton ', ' victoria ', fetcher);
    expect(result).toStrictEqual({
      name: 'Carlton',
      region: 'Victoria',
      postcodes: ['3053'],
      latitude: -37.8,
      longitude: 144.97,
      timeZone: 'Australia/Melbourne',
    });
    const requestUrl = new URL(String(fetcher.mock.calls[0][0]));
    expect(requestUrl.searchParams.get('countryCode')).toBe('AU');
    expect(requestUrl.searchParams.get('name')).toBe('carlton, victoria');
  });

  it('resolves an exact postcode and rejects ambiguous same-name localities', async () => {
    await expect(
      resolveAustralianLocality('3053', '', async () => response([melbourne])),
    ).resolves.toMatchObject({
      name: 'Carlton',
    });

    const otherCarlton = { ...melbourne, admin1: 'Tasmania', latitude: -41.2 };
    await expect(
      resolveAustralianLocality('Carlton', '', async () => response([melbourne, otherCarlton])),
    ).rejects.toThrow(/more than one locality matched/i);
  });

  it('rejects results from outside Australia and malformed coordinates', async () => {
    await expect(
      resolveAustralianLocality('Carlton', '', async () =>
        response([{ ...melbourne, country_code: 'US' }]),
      ),
    ).rejects.toThrow(/could not find an exact Australian locality/i);
    await expect(
      resolveAustralianLocality('Carlton', '', async () =>
        response([{ ...melbourne, longitude: 300 }]),
      ),
    ).rejects.toThrow(/could not find an exact Australian locality/i);
  });

  it('handles invalid queries and provider failures without leaking provider details', async () => {
    await expect(resolveAustralianLocality('A', '')).rejects.toThrow(/2–80 characters/);
    await expect(
      resolveAustralianLocality('Carlton', '', async () => response([], false)),
    ).rejects.toThrow(/temporarily unavailable/i);
  });
});
