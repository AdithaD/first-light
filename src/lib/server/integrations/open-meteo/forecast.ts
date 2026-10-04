export interface ForecastLocation {
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature: number;
    feelsLike: number;
    precipitation: number;
    weatherCode: number;
    windSpeed: number;
  };
  currentUnits: {
    temperature: string;
    precipitation: string;
    windSpeed: string;
  };
  days: Array<{
    date: string;
    minimumTemperature: number;
    maximumTemperature: number;
    precipitationProbability: number;
    weatherCode: number;
  }>;
  dailyUnits: {
    temperature: string;
    precipitationProbability: string;
  };
}

export type ForecastFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class ForecastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForecastError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!finiteNumber(value)) throw new ForecastError('Open-Meteo returned invalid forecast data.');
  return value;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ForecastError('Open-Meteo returned invalid forecast data.');
  }
  return value;
}

/** Validate the provider's parallel daily arrays before mapping them into app-owned fields. */
function parseForecast(payload: unknown): WeatherForecast {
  if (!isRecord(payload) || !isRecord(payload.current) || !isRecord(payload.current_units)) {
    throw new ForecastError('Open-Meteo returned invalid forecast data.');
  }
  const current = payload.current;
  const currentUnits = payload.current_units;
  if (!isRecord(payload.daily) || !isRecord(payload.daily_units)) {
    throw new ForecastError('Open-Meteo returned invalid forecast data.');
  }

  const daily = payload.daily;
  const dates = daily.time;
  const maximums = daily.temperature_2m_max;
  const minimums = daily.temperature_2m_min;
  const rainProbabilities = daily.precipitation_probability_max;
  const codes = daily.weather_code;
  if (
    !Array.isArray(dates) ||
    !Array.isArray(maximums) ||
    !Array.isArray(minimums) ||
    !Array.isArray(rainProbabilities) ||
    !Array.isArray(codes) ||
    dates.length === 0 ||
    dates.length > 2 ||
    maximums.length !== dates.length ||
    minimums.length !== dates.length ||
    rainProbabilities.length !== dates.length ||
    codes.length !== dates.length
  ) {
    throw new ForecastError('Open-Meteo returned invalid forecast data.');
  }

  // Open-Meteo represents each daily metric as a positional array; reject mismatched lengths.
  const days = dates.map((date, index) => {
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
      !finiteNumber(maximums[index]) ||
      !finiteNumber(minimums[index]) ||
      !finiteNumber(rainProbabilities[index]) ||
      !finiteNumber(codes[index]) ||
      rainProbabilities[index] < 0 ||
      rainProbabilities[index] > 100
    ) {
      throw new ForecastError('Open-Meteo returned invalid forecast data.');
    }
    return {
      date,
      minimumTemperature: minimums[index],
      maximumTemperature: maximums[index],
      precipitationProbability: rainProbabilities[index],
      weatherCode: codes[index],
    };
  });

  return {
    latitude: numberField(payload, 'latitude'),
    longitude: numberField(payload, 'longitude'),
    timezone: stringField(payload, 'timezone'),
    current: {
      time: stringField(current, 'time'),
      temperature: numberField(current, 'temperature_2m'),
      feelsLike: numberField(current, 'apparent_temperature'),
      precipitation: numberField(current, 'precipitation'),
      weatherCode: numberField(current, 'weather_code'),
      windSpeed: numberField(current, 'wind_speed_10m'),
    },
    currentUnits: {
      temperature: stringField(currentUnits, 'temperature_2m'),
      precipitation: stringField(currentUnits, 'precipitation'),
      windSpeed: stringField(currentUnits, 'wind_speed_10m'),
    },
    days,
    dailyUnits: {
      temperature: stringField(
        payload.daily_units as Record<string, unknown>,
        'temperature_2m_max',
      ),
      precipitationProbability: stringField(
        payload.daily_units as Record<string, unknown>,
        'precipitation_probability_max',
      ),
    },
  };
}

/** Fetch a minimal current and two-day forecast for an already-resolved location. */
export async function fetchOpenMeteoForecast(
  location: ForecastLocation,
  fetcher: ForecastFetch = fetch,
): Promise<WeatherForecast> {
  if (
    !Number.isFinite(location.latitude) ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    !Number.isFinite(location.longitude) ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    throw new ForecastError('A valid weather location is required.');
  }
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: location.timezone });
  } catch {
    throw new ForecastError('A valid timezone is required for the forecast.');
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
  );
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
  );
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', location.timezone);

  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': 'First-Light/0.1.0' },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ForecastError('Weather forecast is temporarily unavailable.');
  }
  if (!response.ok)
    throw new ForecastError(`Weather forecast failed with HTTP ${response.status}.`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ForecastError('Open-Meteo returned an invalid forecast response.');
  }
  return parseForecast(payload);
}
