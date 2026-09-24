import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
  googleConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  oauthMessage: url.searchParams.get('error')
    ? 'Google sign-in did not complete. Please try again.'
    : null,
});

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    const name = String(data.get('displayName') ?? '').trim();

    if (!locals.auth) return fail(503, { error: 'Authentication is not available.' });
    if (!name) return fail(400, { error: 'Enter your name.' });
    if (password.length < 10)
      return fail(400, { error: 'Password must be at least 10 characters.' });

    try {
      const response = await locals.auth.api.signUpEmail({
        body: { name, email: email.trim().toLowerCase(), password },
        headers: request.headers,
        asResponse: true,
      });
      if (!response.ok) return fail(400, { error: 'Unable to create your account.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('email') || message.toLowerCase().includes('exist')) {
        return fail(400, {
          error:
            'That email already has an account. Sign in with its existing method; for Google accounts, add a password from account settings.',
        });
      }
      return fail(400, {
        error: 'Unable to create your account. Check your details and try again.',
      });
    }
    redirect(303, '/account');
  },
};
