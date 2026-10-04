import { error, redirect } from '@sveltejs/kit';
import { loadRawDebugData, type RawDebugData } from '$lib/server/debug/raw-data';
import { getUserPreferences } from '$lib/server/repository/preferences';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  // Do not query preferences or providers until the session has been verified by the request hook.
  if (!locals.user || !locals.session) redirect(303, '/login');
  if (!locals.db) error(503, 'The debug view is unavailable right now.');
  // Provider data is user-specific and live; prevent browser/proxy caches from sharing it.
  setHeaders({ 'cache-control': 'private, no-store' });

  const preferences = await getUserPreferences(locals.db, locals.user.id);
  const result: RawDebugData = preferences
    ? await loadRawDebugData(preferences)
    : {
        weather: { status: 'not-configured', data: null, error: null },
        news: { status: 'not-configured', feeds: [], error: null },
      };
  return { modules: result };
};
