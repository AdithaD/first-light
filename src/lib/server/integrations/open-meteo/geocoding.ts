export interface GeocodedLocality {
  name: string;
  region: string | null;
  postcodes: string[];
  latitude: number;
  longitude: number;
  timeZone: string;
}

interface GeocodingResponse {
  results?: unknown;
}

export type GeocodingFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class LocalityLookupError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 503 = 400,
  ) {
    super(message);
    this.name = 'LocalityLookupError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Normalise names for exact matching without accepting provider fuzzy matches as exact results. */
function normalizedLocation(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** Keep only structurally valid Australian localities with usable coordinates and an IANA timezone. */
function parseResult(value: unknown): GeocodedLocality | null {
  if (!isRecord(value)) return null;
  const {
    name,
    admin1,
    latitude,
    longitude,
    timezone,
    country_code: countryCode,
    postcodes,
  } = value;
  if (
    typeof name !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof timezone !== 'string' ||
    countryCode !== 'AU' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: timezone });
  } catch {
    return null;
  }

  return {
    name,
    region: typeof admin1 === 'string' && admin1.length > 0 ? admin1 : null,
    latitude,
    longitude,
    timeZone: timezone,
    postcodes: Array.isArray(postcodes)
      ? postcodes.filter((postcode): postcode is string => typeof postcode === 'string')
      : [],
  };
}

export async function resolveAustralianLocality(
  name: string,
  region: string,
  fetcher: GeocodingFetch = fetch,
): Promise<GeocodedLocality> {
  const cleanName = name.trim();
  const cleanRegion = region.trim();
  if (cleanName.length < 2 || cleanName.length > 80 || cleanRegion.length > 80) {
    throw new LocalityLookupError(
      'Enter a locality of 2–80 characters and a region of no more than 80 characters.',
    );
  }

  // Query Australian results only; exact local matching below avoids silently choosing a fuzzy hit.
  const query = new URL('https://geocoding-api.open-meteo.com/v1/search');
  query.searchParams.set('name', cleanRegion ? `${cleanName}, ${cleanRegion}` : cleanName);
  query.searchParams.set('countryCode', 'AU');
  query.searchParams.set('count', '10');
  query.searchParams.set('language', 'en');

  let response: Response;
  try {
    response = await fetcher(query, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new LocalityLookupError(
      'Location lookup is temporarily unavailable. Please try again.',
      503,
    );
  }
  if (!response.ok) {
    throw new LocalityLookupError(
      'Location lookup is temporarily unavailable. Please try again.',
      503,
    );
  }
  let payload: unknown;
  try {
    payload = (await response.json()) as GeocodingResponse;
  } catch {
    throw new LocalityLookupError(
      'Location lookup returned an invalid response. Please try again.',
      503,
    );
  }
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new LocalityLookupError(
      'Location lookup returned an invalid response. Please try again.',
      503,
    );
  }

  const results = payload.results.map(parseResult).filter((result) => result !== null);
  const wantedName = normalizedLocation(cleanName);
  const wantedRegion = normalizedLocation(cleanRegion);
  const matches = results.filter((result) => {
    const isPostcode = /^\d{4}$/u.test(cleanName);
    const nameMatches = isPostcode
      ? result.postcodes.includes(cleanName)
      : normalizedLocation(result.name) === wantedName;
    const regionMatches =
      !wantedRegion ||
      (result.region !== null && normalizedLocation(result.region) === wantedRegion);
    return nameMatches && regionMatches;
  });

  if (matches.length === 0) {
    throw new LocalityLookupError(
      'We could not find an exact Australian locality match. Check the spelling or add its region.',
    );
  }
  // Duplicate provider records at identical coordinates are harmless; distinct coordinates are ambiguous.
  const uniqueCoordinates = new Set(matches.map((match) => `${match.latitude},${match.longitude}`));
  if (uniqueCoordinates.size > 1) {
    throw new LocalityLookupError(
      'More than one locality matched. Add the state, region, or postcode area to narrow it down.',
    );
  }
  return matches[0];
}
