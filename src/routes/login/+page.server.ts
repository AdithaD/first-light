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

    if (!locals.auth) return fail(503, { error: 'Authentication is not available.' });
    try {
      const response = await locals.auth.api.signInEmail({
        body: { email: email.trim().toLowerCase(), password },
        headers: request.headers,
        asResponse: true,
      });
      if (!response.ok) return fail(400, { error: 'Invalid email or password.' });
    } catch {
      return fail(400, { error: 'Invalid email or password.' });
    }
    redirect(303, '/account');
  },
};
