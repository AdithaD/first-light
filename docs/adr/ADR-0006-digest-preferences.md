# ADR-0006 — MVP Daily Digest Preferences and Content

**Date:** 2026-09-25 · **Status:** Accepted · **Deciders:** Owner + Cline

## Context

Phase 3 ingestion and the preferences schema depend on what users can customise
and what the daily digest promises. The MVP should be useful and personal
without making onboarding a long configuration exercise or introducing
unapproved data sources, sensitive integrations, or unnecessary scope.

## Decision

1. Build the MVP as a **customisable daily digest recipe** with structured
   preferences, not as a free-form prompt.
2. Weather uses one user-selected suburb or postcode as the primary location.
   Resolve it to coordinates for the weather provider. Multiple locations,
   work/travel locations, and calendar integration are outside the MVP.
3. News interests use a **hybrid model**: curated topic choices for quick
   onboarding, plus a small set of optional user-entered topic phrases and
   exclusions. Treat custom phrases as relevance hints, not guarantees that
   every provider can filter them exactly.
4. Use all approved and available news sources by default. Allow optional
   selection from the sources in `docs/DATA_SOURCES.md`; do not accept arbitrary
   source URLs or add sources without owner approval and registry review.
   Initial news sources are the confirmed ABC News RSS feeds **Top Stories**
   and **Just In**. The Guardian is deferred; the source model must allow
   additional providers/feed IDs without changing the user-preference shape.
5. Let users select a daily delivery time in their configured timezone. Default
   new users to **07:00** in `Australia/Sydney`; timezone defaults to
   `Australia/Sydney` and is independently configurable from the weather
   locality. Support concise or standard digest lengths, defaulting to concise.
6. The digest should provide relevant local, Australian, and broader news;
   concise summaries with source links; brief context on major stories; and
   notable developments since the previous digest when identifiable. Include
   practical weather context to help plan the day. Attribute sources and do not
   imply that AI-generated context is original reporting.
7. Provide a lightweight **“less like this”** feedback action to reduce similar
   content. Do not build a recommendation platform or promise perfect
   deduplication for the MVP.
8. Keep the onboarding path short: location, interests, optional source choices,
   delivery time, and digest length. Advanced preference editing belongs on the
   account/preferences page rather than being required during signup.
9. Treat digest modules as independently enabled preferences. The MVP has
   **Weather** and **News** modules, both enabled by default. Users can turn a
   module off; its saved configuration remains available to turn back on later.
   Weather location is required only while Weather is enabled. Future modules
   should be added as separate sections and preferences without changing the
   meaning of existing module settings.
10. Calendar, commute/traffic, public events, specialist feeds (for example
    sport, surf, air quality, or pollen), urgent alerts, weekend editions, and
    additional delivery channels are excluded from MVP and may be considered in
    the Phase 8 backlog.

## Alternatives considered

- **Free-form interests only** — expressive but harder to map consistently to
  Guardian and ABC capabilities, and less helpful for new users.
- **Curated interests only** — easy to implement and explain, but does not cover
  niche or local interests.
- **Require users to select sources** — offers control but adds onboarding
  friction; use all approved sources by default instead.
- **Unrestricted prompt-based personalisation** — flexible but makes behaviour,
  safety, provider mapping, and preference persistence less predictable.
- **Add calendar, commute, and specialist data in MVP** — potentially useful,
  but each adds provider, privacy, reliability, and support obligations before
  the core digest is proven.

## Consequences & triggers to revisit

- `docs/ARCHITECTURE.md` specifies the provider-independent preference model,
  defaults, validation, and provider mappings. Implement against that design;
  preserve separation between user preferences and provider-specific
  query/filter logic.
- Weather and News enabled flags are persisted independently and default to on.
  Turning off a module must not delete its stored configuration.
- During the section-switch migration, existing preference rows without resolved
  coordinates get Weather disabled (they cannot satisfy the enabled-weather
  location invariant); existing News preferences remain enabled. New users
  default to both sections enabled.
- The source selector only exposes sources already approved in
  `docs/DATA_SOURCES.md`; source failures should degrade independently.
- Open-Meteo's free API is selected for MVP locality lookup and weather under
  its non-commercial terms only. Before adding ads, subscriptions, or other
  commercial use, move to an appropriate paid plan or replace the provider.
- Location is collected only to provide weather for the selected locality.
- Review topic controls, story repetition, and desired length after user
  feedback. Revisit the MVP boundary if users consistently request multiple
  locations, other data modules, or more delivery schedules.
