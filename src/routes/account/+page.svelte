<script lang="ts">
  let { data, form } = $props();
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
