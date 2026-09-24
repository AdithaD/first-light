# Data Sources Registry

English-language product; **initial market scope: Australia**. Sources are
added here (with owner approval) before any client code is written. Every
brief must attribute its sources with links.

## Weather

| Source                                | Auth | Free tier                        | Contract notes                                                        | Status         |
| ------------------------------------- | ---- | -------------------------------- | --------------------------------------------------------------------- | -------------- |
| **Open-Meteo** (`api.open-meteo.com`) | none | Non-commercial free, 10k req/day | Forecast + current by lat/long; daily/hourly fields; good AU coverage | Selected (MVP) |

## News

| Source                                                           | Auth         | Free tier          | Contract notes                                                        | Status         |
| ---------------------------------------------------------------- | ------------ | ------------------ | --------------------------------------------------------------------- | -------------- |
| **Guardian Australia** (content API: `content.guardianapis.com`) | free API key | Open, rate-limited | Filter by edition/section; returns thumbnails + standfirst; JSON      | Selected (MVP) |
| **ABC News** RSS feeds (`abc.net.au/news/feed/...`)              | none         | Public             | Per-topic feeds; XML → parse & trim to needed fields; respect cadence | Selected (MVP) |

## Client rules (all sources)

1. Timeouts on every call; failures degrade that section only.
2. Respect documented rate limits; cache responses in-memory per brief run;
   news fetched at most hourly per user.
3. Identify honestly via `User-Agent` where APIs allow custom headers.
4. Trim/select fields **before** heavy parsing (Workers CPU budget, ADR-0001).
5. All clients unit-tested with mocked `fetch`; no live calls in tests.
