import { redirect } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

// POST only (CSRF-safe: won't fire from a linked image or plain link).
/** Revoke the current Better Auth session, then return the browser to the home page. */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (locals.auth) await locals.auth.api.signOut({ headers: request.headers });
  redirect(303, '/');
};
