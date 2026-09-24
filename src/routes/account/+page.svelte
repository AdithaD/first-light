<script lang="ts">
  let { data } = $props();
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

  <form method="POST" action="/logout">
    <button
      type="submit"
      class="mt-4 rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
    >
      Log out
    </button>
  </form>
</main>
