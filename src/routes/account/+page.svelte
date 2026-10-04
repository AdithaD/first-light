<script lang="ts">
  import type { PreferenceFormInput } from '$lib/server/preferences/validation';

  let { data, form } = $props();
  let submitted = $derived(
    form && 'preferencesInput' in form
      ? ((form.preferencesInput as PreferenceFormInput | undefined) ?? null)
      : null,
  );
  let weatherEnabled = $state(true);
  let newsEnabled = $state(true);

  // After failed form submissions, keep the attempted switch states visible rather than reverting to storage.
  $effect(() => {
    weatherEnabled = submitted?.weatherEnabled ?? data.preferences?.weatherEnabled ?? true;
    newsEnabled = submitted?.newsEnabled ?? data.preferences?.newsEnabled ?? true;
  });
</script>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
  <h1 class="text-3xl font-semibold">Your account</h1>

  <dl class="flex flex-col gap-2 text-sm">
    <div class="flex justify-between border-b border-slate-800 pb-2">
      <dt class="text-slate-400">Email</dt>
      <dd>{data.email}</dd>
    </div>
    <div class="flex justify-between border-b border-slate-800 pb-2">
      <dt class="text-slate-400">Display name</dt>
      <dd>{data.displayName ?? '—'}</dd>
    </div>
    <div class="flex justify-between border-b border-slate-800 pb-2">
      <dt class="text-slate-400">Session expires</dt>
      <dd>{new Date(data.sessionExpiresAt).toLocaleString('en-AU')}</dd>
    </div>
  </dl>

  <section class="flex flex-col gap-4 border-t border-slate-800 pt-5">
    <div>
      <h2 class="text-lg font-medium">Daily digest preferences</h2>
      <p class="mt-1 text-sm text-slate-400">
        Choose what your daily briefing covers and when it arrives. Weather is looked up for
        Australian locations.
      </p>
    </div>

    {#if data.preferencesNotice === 'saved'}
      <p
        class="rounded border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-200"
      >
        Your digest preferences have been saved.
      </p>
    {/if}

    {#if form?.preferencesErrors}
      <div
        class="rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300"
        role="alert"
      >
        {#each form.preferencesErrors as error (error)}
          <p>{error}</p>
        {/each}
      </div>
    {/if}

    <form method="POST" action="?/savePreferences" class="flex flex-col gap-5">
      <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <div class="mb-4">
          <h3 class="text-base font-medium">Delivery</h3>
          <p class="mt-1 text-sm text-slate-400">How and when your digest is sent.</p>
        </div>
        <dl class="mb-4 flex justify-between border-b border-slate-800 pb-3 text-sm">
          <dt class="text-slate-400">Email destination</dt>
          <dd>{data.email}</dd>
        </dl>
        <div class="flex flex-col gap-4">
          <label class="flex flex-col gap-1 text-sm">
            Timezone
            <select
              name="timezone"
              class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
              value={submitted?.timezone ?? data.preferences?.timezone ?? 'Australia/Sydney'}
            >
              <option value="Australia/Sydney">Australia/Sydney (default)</option>
              <option value="Australia/Adelaide">Australia/Adelaide</option>
              <option value="Australia/Brisbane">Australia/Brisbane</option>
              <option value="Australia/Darwin">Australia/Darwin</option>
              <option value="Australia/Eucla">Australia/Eucla</option>
              <option value="Australia/Hobart">Australia/Hobart</option>
              <option value="Australia/Lord_Howe">Australia/Lord_Howe</option>
              <option value="Australia/Melbourne">Australia/Melbourne</option>
              <option value="Australia/Perth">Australia/Perth</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Daily delivery time
            <input
              name="deliveryLocalTime"
              type="time"
              required
              value={submitted?.deliveryLocalTime ?? data.preferences?.deliveryLocalTime ?? '07:00'}
              class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <fieldset class="flex flex-col gap-2">
            <legend class="text-sm font-medium">Digest length</legend>
            {#each [{ id: 'concise', label: 'Concise' }, { id: 'standard', label: 'Standard' }] as option (option.id)}
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="digestLength"
                  value={option.id}
                  checked={(submitted?.digestLength ??
                    data.preferences?.digestLength ??
                    'concise') === option.id}
                />
                {option.label}
              </label>
            {/each}
          </fieldset>
        </div>
      </section>

      <section class="rounded-xl border border-sky-900 bg-sky-950/20 p-4">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-base font-medium">Weather</h3>
            <p class="mt-1 text-sm text-slate-400">A forecast for one Australian locality.</p>
          </div>
          <label class="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="weatherEnabled"
              checked={weatherEnabled}
              onchange={(event) => (weatherEnabled = event.currentTarget.checked)}
            />
            Include
          </label>
        </div>
        <fieldset disabled={!weatherEnabled} class="flex flex-col gap-3 disabled:opacity-50">
          <label class="flex flex-col gap-1 text-sm">
            Suburb or postcode
            <input
              name="localityName"
              type="text"
              minlength="2"
              maxlength="80"
              required={weatherEnabled}
              value={submitted?.localityName ?? data.preferences?.localityName ?? ''}
              placeholder="e.g. Carlton or 3053"
              autocomplete="address-level2"
              class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Region (optional, helps distinguish locations)
            <input
              name="localityRegion"
              type="text"
              maxlength="80"
              value={submitted?.localityRegion ?? data.preferences?.localityRegion ?? ''}
              placeholder="e.g. Victoria"
              autocomplete="address-level1"
              class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <p class="text-xs text-slate-500">
            Open-Meteo resolves this locality to coordinates. Your delivery timezone is set above.
          </p>
        </fieldset>
      </section>

      <section class="rounded-xl border border-amber-900 bg-amber-950/20 p-4">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-base font-medium">News</h3>
            <p class="mt-1 text-sm text-slate-400">
              Choose the ABC sources and topics for your briefing.
            </p>
          </div>
          <label class="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="newsEnabled"
              checked={newsEnabled}
              onchange={(event) => (newsEnabled = event.currentTarget.checked)}
            />
            Include
          </label>
        </div>
        <fieldset disabled={!newsEnabled} class="flex flex-col gap-4 disabled:opacity-50">
          <fieldset class="flex flex-col gap-2">
            <legend class="text-sm font-medium">Sources</legend>
            {#each [{ id: 'all', label: 'All available ABC sources' }, { id: 'selected', label: 'Only sources I select' }] as option (option.id)}
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="sourceMode"
                  value={option.id}
                  checked={(submitted?.sourceMode ?? data.preferences?.sourceMode ?? 'all') ===
                    option.id}
                />
                {option.label}
              </label>
            {/each}
            <div class="ml-5 flex flex-col gap-2 border-l border-slate-700 pl-3">
              {#each data.sources as source (source.id)}
                <label class="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="sourceIds"
                    value={source.id}
                    checked={submitted
                      ? submitted.sourceMode === 'all' ||
                        submitted.selectedSourceIds.includes(source.id)
                      : data.preferences?.sourceMode === 'selected'
                        ? data.preferences.selectedSourceIds.includes(source.id)
                        : true}
                  />
                  {source.label}
                </label>
              {/each}
            </div>
            <p class="text-xs text-slate-500">
              Source selections apply in “Only sources I select” mode; choose at least one.
            </p>
          </fieldset>

          <fieldset class="flex flex-col gap-3 border-t border-slate-800 pt-4">
            <legend class="text-sm font-medium">Interests</legend>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {#each data.topics as topic (topic.id)}
                <label class="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="curatedTopics"
                    value={topic.id}
                    checked={submitted
                      ? submitted.curatedTopicIds.includes(topic.id)
                      : (data.preferences?.topics.some(
                          (preference) =>
                            preference.kind === 'curated' && preference.value === topic.id,
                        ) ?? false)}
                  />
                  {topic.label}
                </label>
              {/each}
            </div>
            <label class="flex flex-col gap-1 text-sm">
              Other interests (optional; separate phrases with commas)
              <textarea
                name="customTopics"
                rows="2"
                maxlength="818"
                class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                >{submitted?.customTopics ??
                  data.preferences?.topics
                    .filter((preference) => preference.kind === 'custom')
                    .map((preference) => preference.value)
                    .join(', ') ??
                  ''}</textarea
              >
            </label>
            <label class="flex flex-col gap-1 text-sm">
              Topics to avoid (optional; separate phrases with commas)
              <textarea
                name="excludedTopics"
                rows="2"
                maxlength="818"
                class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                >{submitted?.excludedTopics ??
                  data.preferences?.topics
                    .filter((preference) => preference.kind === 'exclude')
                    .map((preference) => preference.value)
                    .join(', ') ??
                  ''}</textarea
              >
            </label>
            <p class="text-xs text-slate-500">
              Topic matching uses ABC RSS categories and article text, so custom interests are
              best-effort. Maximum 10 custom or excluded phrases, 80 characters each.
            </p>
          </fieldset>
        </fieldset>
      </section>

      <button
        type="submit"
        class="rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
      >
        Save digest preferences
      </button>
    </form>
  </section>

  {#if data.passwordNotice === 'set'}
    <p class="rounded border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-200">
      Password sign-in is now enabled for this account.
    </p>
  {:else if data.passwordNotice === 'changed'}
    <p class="rounded border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-200">
      Your password has been changed. Other active sessions have been signed out.
    </p>
  {/if}

  {#if data.hasPassword}
    <section class="flex flex-col gap-3 border-t border-slate-800 pt-5">
      <h2 class="text-lg font-medium">Change password</h2>
      <form method="POST" action="?/changePassword" class="flex flex-col gap-3">
        <label class="flex flex-col gap-1 text-sm">
          Current password
          <input
            name="currentPassword"
            type="password"
            required
            autocomplete="current-password"
            class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          New password <span class="text-slate-500">(at least 10 characters)</span>
          <input
            name="newPassword"
            type="password"
            required
            minlength="10"
            autocomplete="new-password"
            class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        {#if form?.changePasswordError}
          <p class="rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
            {form.changePasswordError}
          </p>
        {/if}
        <button
          type="submit"
          class="rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
        >
          Change password
        </button>
      </form>
    </section>
  {/if}

  {#if !data.hasPassword}
    <section class="flex flex-col gap-3 border-t border-slate-800 pt-5">
      <h2 class="text-lg font-medium">Add email and password sign-in</h2>
      <p class="text-sm text-slate-400">
        You can keep signing in with Google and also use a password.
      </p>
      <form method="POST" action="?/setPassword" class="flex flex-col gap-3">
        <label class="flex flex-col gap-1 text-sm">
          New password <span class="text-slate-500">(at least 10 characters)</span>
          <input
            name="password"
            type="password"
            required
            minlength="10"
            autocomplete="new-password"
            class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        {#if form?.passwordError}
          <p class="rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
            {form.passwordError}
          </p>
        {/if}
        <button
          type="submit"
          class="rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
        >
          Set password
        </button>
      </form>
    </section>
  {/if}

  <form method="POST" action="/logout">
    <button
      type="submit"
      class="mt-4 rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
    >
      Log out
    </button>
  </form>
</main>
