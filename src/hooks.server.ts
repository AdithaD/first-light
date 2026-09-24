import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/repository/db';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.db = getDb(event.platform);
  return resolve(event);
};
