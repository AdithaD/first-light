import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import { setSessionCookie } from '$lib/server/auth/cookies';
import { createDefaultAuthService, InvalidCredentialsError } from '$lib/server/auth/service';

import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');

    if (!locals.db) return fail(500, { error: 'Database unavailable.' });

    const iterations = Number(env.AUTH_PBKDF2_ITERATIONS) || undefined;
    try {
      const auth = createDefaultAuthService(locals.db, iterations);
      const raw = await auth.login({ email, password });
      setSessionCookie(cookies, raw);
    } catch (e) {
      if (e instanceof InvalidCredentialsError)
        return fail(400, { error: 'Invalid email or password.' });
      throw e;
    }
    redirect(303, '/account');
  },
};
