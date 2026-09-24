import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, request, url }) => {
  if (!locals.auth) error(503, 'Google sign-in is not configured yet.');
  const authRequest = new Request(new URL('/api/auth/sign-in/social', url.origin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
      origin: url.origin,
    },
    body: JSON.stringify({ provider: 'google', callbackURL: '/account' }),
  });
  const response = await locals.auth.handler(authRequest);
  const location = response.headers.get('location');
  if (response.ok && location) {
    return new Response(null, { status: 302, headers: response.headers });
  }
  return response;
};
