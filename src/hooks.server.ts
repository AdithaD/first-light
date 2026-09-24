import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createBetterAuth } from '$lib/server/auth/better-auth';
import { getDb } from '$lib/server/repository/db';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.db = getDb(event.platform);
  event.locals.auth = event.locals.db
    ? createBetterAuth(event.locals.db as Parameters<typeof createBetterAuth>[0])
    : null;

  if (event.locals.auth) {
    const current = await event.locals.auth.api.getSession({ headers: event.request.headers });
    event.locals.user = current?.user ?? null;
    event.locals.session = current?.session ?? null;
    return svelteKitHandler({ event, resolve, auth: event.locals.auth, building });
  }
  return resolve(event);
};
