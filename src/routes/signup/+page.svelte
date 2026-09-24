<script lang="ts">
  import { resolve } from '$app/paths';

  let { form } = $props();
</script>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
  <h1 class="text-3xl font-semibold">Create your account</h1>

  <form method="POST" class="flex flex-col gap-4">
    <label class="flex flex-col gap-1 text-sm">
      Display name <span class="text-slate-500">(optional)</span>
      <input
        name="displayName"
        type="text"
        autocomplete="name"
        class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
      />
    </label>
    <label class="flex flex-col gap-1 text-sm">
      Email
      <input
        name="email"
        type="email"
        required
        autocomplete="email"
        class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
      />
    </label>
    <label class="flex flex-col gap-1 text-sm">
      Password <span class="text-slate-500">(min 10 characters)</span>
      <input
        name="password"
        type="password"
        required
        minlength="10"
        autocomplete="new-password"
        class="rounded border border-slate-700 bg-slate-900 px-3 py-2"
      />
    </label>

    {#if form?.error}
      <p class="rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
        {form.error}
      </p>
    {/if}

    <button type="submit" class="rounded bg-sky-600 px-4 py-2 font-medium hover:bg-sky-500">
      Sign up
    </button>
  </form>

  <p class="text-sm text-slate-400">
    Already have an account? <a class="text-sky-400 hover:underline" href={resolve('/login')}
      >Log in</a
    >
  </p>
</main>
