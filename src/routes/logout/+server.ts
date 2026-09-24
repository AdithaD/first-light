import { redirect } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth/cookies';
import { createSessionRepository, SESSION_COOKIE_NAME } from '$lib/server/repository/sessions';

import type { RequestHandler } from './$types';

// POST only (CSRF-safe: won't fire from a linked image or plain link).
export const POST: RequestHandler = async ({ locals, cookies }) => {
  const raw = cookies.get(SESSION_COOKIE_NAME);
  if (raw && locals.db) {
    await createSessionRepository(locals.db).delete(raw);
  }
  clearSessionCookie(cookies);
  redirect(303, '/');
};
