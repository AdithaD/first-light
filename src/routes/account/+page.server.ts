import { error, redirect } from '@sveltejs/kit';
import { createSessionRepository, SESSION_COOKIE_NAME } from '$lib/server/repository/sessions';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.db) error(500, 'Database unavailable.');

  const raw = cookies.get(SESSION_COOKIE_NAME);
  if (!raw) redirect(303, '/login');

  const user = await createSessionRepository(locals.db).getSessionUser(raw);
  if (!user) redirect(303, '/login');

  return {
    email: user.email,
    displayName: user.displayName,
    sessionExpiresAt: user.sessionExpiresAt,
  };
};
