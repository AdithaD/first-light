<script lang="ts">
  import { resolve } from '$app/paths';

  let { data } = $props();
</script>

<main
  class="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center"
>
  <h1 class="text-5xl font-semibold tracking-tight">First Light</h1>
  <p class="text-lg text-slate-400">
    Your daily briefing — local weather, curated news, and an AI-written summary.
  </p>
  <nav class="flex flex-wrap justify-center gap-3">
    {#if data.user}
      <a
        href={resolve('/debug')}
        class="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500">View raw data</a
      >
      <a
        href={resolve('/account')}
        class="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
        >Account preferences</a
      >
      <form method="POST" action="/logout">
        <button
          class="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          type="submit"
        >
          Sign out
        </button>
      </form>
    {:else}
      <a
        href={resolve('/login')}
        class="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800">Log in</a
      >
      <a
        href={resolve('/signup')}
        class="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500">Sign up</a
      >
    {/if}
  </nav>
  <p class="text-sm text-slate-500">Phase 3 · data ingestion</p>
</main>
