import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import { setSessionCookie } from '$lib/server/auth/cookies';
import {
  createDefaultAuthService,
  EmailTakenError,
  InvalidEmailError,
  WeakPasswordError,
} from '$lib/server/auth/service';

import type { Actions } from './$types';

const MESSAGES: Record<string, string> = {
  InvalidEmailError: 'Enter a valid email address.',
  WeakPasswordError: 'Password must be at least 10 characters.',
  EmailTakenError: 'That email is already registered.',
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    const displayName = String(data.get('displayName') ?? '').trim() || undefined;

    if (!locals.db) return fail(500, { error: 'Database unavailable.' });

    const iterations = Number(env.AUTH_PBKDF2_ITERATIONS) || undefined;
    try {
      const auth = createDefaultAuthService(locals.db, iterations);
      const raw = await auth.signup({ email, password, displayName });
      setSessionCookie(cookies, raw);
    } catch (e) {
      if (
        e instanceof InvalidEmailError ||
        e instanceof WeakPasswordError ||
        e instanceof EmailTakenError
      )
        return fail(400, { error: MESSAGES[e.constructor.name] });
      throw e; // includes SvelteKit's own Redirect/HttpError — always rethrow
    }
    redirect(303, '/account');
  },
};
