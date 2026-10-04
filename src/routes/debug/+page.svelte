<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  /** Render enum-style states as readable labels without changing the server result. */
  function statusLabel(status: string): string {
    return status.replaceAll('-', ' ');
  }
</script>

<svelte:head>
  <title>Raw data debug · First Light</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p class="text-sm text-slate-400">First Light · Phase 3</p>
      <h1 class="mt-1 text-3xl font-semibold">Raw data debug</h1>
      <p class="mt-2 max-w-2xl text-sm text-slate-400">
        Live data returned for your saved preferences. This page is private to your signed-in
        account and is not a generated digest.
      </p>
    </div>
    <nav class="flex gap-3 text-sm">
      <a
        class="rounded border border-slate-600 px-3 py-2 hover:bg-slate-800"
        href={resolve('/account')}
      >
        Account preferences
      </a>
      <form method="POST" action="/logout">
        <button class="rounded border border-slate-600 px-3 py-2 hover:bg-slate-800" type="submit">
          Sign out
        </button>
      </form>
    </nav>
  </header>

  <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-medium">Weather</h2>
        <p class="mt-1 text-sm text-slate-400">
          Open-Meteo · current conditions and two-day forecast
        </p>
      </div>
      <span class="rounded-full border border-slate-600 px-3 py-1 text-xs capitalize">
        {statusLabel(data.modules.weather.status)}
      </span>
    </div>

    {#if data.modules.weather.error}
      <p class="rounded border border-amber-800 bg-amber-950/60 px-3 py-2 text-sm text-amber-200">
        {data.modules.weather.error}
      </p>
    {/if}

    {#if data.modules.weather.data}
      {@const weather = data.modules.weather.data}
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div class="rounded-lg bg-slate-950/60 p-3">
          <dt class="text-slate-400">Current</dt>
          <dd class="mt-1">
            {weather.current.temperature}{weather.currentUnits.temperature} · feels like
            {weather.current.feelsLike}{weather.currentUnits.temperature}
          </dd>
        </div>
        <div class="rounded-lg bg-slate-950/60 p-3">
          <dt class="text-slate-400">Conditions</dt>
          <dd class="mt-1">
            Weather code {weather.current.weatherCode} · wind {weather.current.windSpeed}
            {weather.currentUnits.windSpeed} · precipitation {weather.current.precipitation}
            {weather.currentUnits.precipitation}
          </dd>
        </div>
      </dl>
      <h3 class="mt-5 text-sm font-medium">Forecast</h3>
      <ul class="mt-2 grid gap-3 sm:grid-cols-2">
        {#each weather.days as day (day.date)}
          <li class="rounded-lg bg-slate-950/60 p-3 text-sm">
            <p class="font-medium">{day.date}</p>
            <p class="mt-1 text-slate-300">
              {day.minimumTemperature}–{day.maximumTemperature}{weather.dailyUnits.temperature}
              · {day.precipitationProbability}{weather.dailyUnits.precipitationProbability} chance of
              rain · code {day.weatherCode}
            </p>
          </li>
        {/each}
      </ul>
      <p class="mt-4 text-xs text-slate-500">
        Open-Meteo forecast data · current timestamp {weather.current.time} ({weather.timezone}).
        <a class="underline" href="https://open-meteo.com/" rel="noreferrer" target="_blank">
          Attribution and API details
        </a>
      </p>
    {/if}
  </section>

  <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-medium">News</h2>
        <p class="mt-1 text-sm text-slate-400">
          ABC News RSS · selected approved feeds and matched items
        </p>
      </div>
      <span class="rounded-full border border-slate-600 px-3 py-1 text-xs capitalize">
        {statusLabel(data.modules.news.status)}
      </span>
    </div>

    {#if data.modules.news.error}
      <p class="rounded border border-amber-800 bg-amber-950/60 px-3 py-2 text-sm text-amber-200">
        {data.modules.news.error}
      </p>
    {/if}

    {#if data.modules.news.feeds.length > 0}
      <div class="flex flex-col gap-5">
        {#each data.modules.news.feeds as feed (feed.sourceId)}
          <section class="border-t border-slate-800 pt-4 first:border-0 first:pt-0">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-medium">{feed.items[0]?.sourceLabel ?? feed.sourceId}</h3>
              <span class="text-xs capitalize text-slate-400">{statusLabel(feed.status)}</span>
            </div>
            {#if feed.error}
              <p class="mt-2 text-sm text-amber-200">{feed.error}</p>
            {:else if feed.items.length === 0}
              <p class="mt-2 text-sm text-slate-400">No items matched these preferences.</p>
            {:else}
              <ul class="mt-3 flex flex-col gap-3">
                {#each feed.items as item (item.id)}
                  <li class="rounded-lg bg-slate-950/60 p-3">
                    <a
                      class="font-medium text-sky-300 underline decoration-slate-600 underline-offset-2 hover:text-sky-200"
                      href={item.link}
                      rel="external noreferrer"
                      target="_blank"
                    >
                      {item.title}
                    </a>
                    {#if item.publishedAt}
                      <p class="mt-1 text-xs text-slate-500">{item.publishedAt}</p>
                    {/if}
                    {#if item.description}
                      <p class="mt-2 text-sm text-slate-300">{item.description}</p>
                    {/if}
                    {#if item.categories.length > 0}
                      <p class="mt-2 text-xs text-slate-400">
                        Categories: {item.categories.join(', ')}
                      </p>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/each}
      </div>
    {:else if data.modules.news.status === 'not-configured'}
      <p class="text-sm text-slate-400">
        Save news preferences in your account to fetch approved feeds.
      </p>
    {/if}
  </section>

  <p class="text-xs text-slate-500">
    Raw provider data is fetched when you load this page; failed modules are shown independently.
    Nothing here is sent for AI summarisation.
  </p>
</main>
