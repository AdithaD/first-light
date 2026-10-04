# Data Sources Registry

English-language product; **initial market scope: Australia**. Sources are
added here (with owner approval) before any client code is written. Every
brief must attribute its sources with links.

## Weather

| Source                                                                | Auth | Free tier                                                 | Contract notes                                                                  | Status                                  |
| --------------------------------------------------------------------- | ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| **Open-Meteo** (`api.open-meteo.com`, `geocoding-api.open-meteo.com`) | none | Free for non-commercial use only; under 10k API calls/day | Geocode Australian suburb/postcode; forecast by lat/long; CC BY 4.0 attribution | Selected (MVP; non-commercial use only) |

## News

| Source                                                           | Auth         | Free tier          | Contract notes                                                                                                   | Status         |
| ---------------------------------------------------------------- | ------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| **ABC News Top Stories** (`abc.net.au/news/feed/45910/rss.xml`)  | none         | Public RSS         | 25-item sample verified 2026-09-25; article title/link/description/pubDate/category; use for broad lead stories  | Selected (MVP) |
| **ABC News Just In** (`abc.net.au/news/feed/51120/rss.xml`)      | none         | Public RSS         | 25-item sample verified 2026-09-25; article title/link/description/pubDate/category; use for recent developments | Selected (MVP) |
| **Guardian Australia** (Content API: `content.guardianapis.com`) | free API key | Open, rate-limited | Candidate source; defer until API mappings and terms are verified                                                | Deferred       |

## Preference-to-source mapping

- Initial source IDs are `abc-top-stories` and `abc-just-in`; IDs are stable
  application registry identifiers, not feed URLs stored on user rows.
- Curated topic IDs map through app-owned category-tag aliases observed in
  samples of both ABC feeds (25 entries/feed checked 2026-09-25). Matching is
  local and exact after case/whitespace normalization; no claim of comprehensive
  ABC taxonomy coverage. The unit-tested catalogue contains only aliases
  actually observed in those samples.
- Custom include/exclude phrases are relevance hints applied to trimmed
  ABC article title, description, and category metadata. Do not accept
  arbitrary feed URLs/query syntax.
- Source selection refers only to the approved source IDs above. “All sources”
  means all approved sources that are configured and currently available; a
  failure in one source does not suppress other sections.
- RSS ingestion uses the owner-authorised `htmlparser2` XML-mode parser. The
  adapter retains item title, link, description, publication date, GUID, and
  repeated category tags; curated matching uses exact normalized category
  aliases, and custom include/exclude phrases use title, description, and
  categories. Only HTTPS links on `abc.net.au` or its subdomains are accepted.
  Each feed has an independent result/error status. Apply a 5-second fetch
  timeout, a 2 MiB response limit, and a caller-scoped one-hour cache; do not
  persist copied feed bodies. Identify the client with a descriptive User-Agent.

## Usage and attribution constraints

- Product-level constraint: while the selected Open-Meteo Free API is in use,
  First Light must remain non-commercial (no ads or subscriptions). Any future
  monetisation requires switching Open-Meteo to an appropriate paid plan or
  replacing it before launch of that monetised feature.
- Open-Meteo Free API (forecast and geocoding) is non-commercial only, limited
  to fewer than 10,000 calls/day, and its data is under CC BY 4.0. The MVP must
  remain non-commercial (no subscriptions or advertising) while using this
  tier; revisit provider/plan before monetisation. Attribute Open-Meteo in the
  weather section.
- BOM RSS is not an MVP weather source: its RSS catalogue is for warnings, not
  forecasts, and its RSS terms require non-commercial use, attribution, and a
  direct link to the BOM page. See the BOM catalogue at
  `https://reg.bom.gov.au/rss/`.

## Client rules (all sources)

1. Timeouts on every call; failures degrade that section only.
2. Respect documented rate limits; cache responses in-memory per brief run;
   news fetched at most hourly per user.
3. Identify honestly via `User-Agent` where APIs allow custom headers.
4. Trim/select fields **before** heavy parsing (Workers CPU budget, ADR-0001).
5. All clients unit-tested with mocked `fetch`; no live calls in tests.
