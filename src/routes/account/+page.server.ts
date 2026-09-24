import { fail, redirect } from '@sveltejs/kit';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, request, url }) => {
  if (!locals.auth || !locals.user || !locals.session) redirect(303, '/login');
  const accounts = await locals.auth.api.listUserAccounts({ headers: request.headers });
  return {
    email: locals.user.email,
    displayName: locals.user.name,
    sessionExpiresAt: locals.session.expiresAt,
    hasPassword: accounts.some((account) => account.providerId === 'credential'),
    passwordNotice: url.searchParams.get('password'),
  };
};

export const actions: Actions = {
  changePassword: async ({ request, locals }) => {
    if (!locals.auth || !locals.user) redirect(303, '/login');
    const form = await request.formData();
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword.length < 10)
      return fail(400, { changePasswordError: 'New password must be at least 10 characters.' });

    try {
      const response = await locals.auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: request.headers,
        asResponse: true,
      });
      if (!response.ok) return fail(400, { changePasswordError: 'Unable to change the password.' });
    } catch {
      return fail(400, {
        changePasswordError: 'Current password is incorrect, or the password could not be changed.',
      });
    }
    redirect(303, '/account?password=changed');
  },
  setPassword: async ({ request, locals }) => {
    if (!locals.auth || !locals.user) redirect(303, '/login');
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    if (password.length < 10)
      return fail(400, { passwordError: 'Password must be at least 10 characters.' });

    try {
      const response = await locals.auth.api.setPassword({
        body: { newPassword: password },
        headers: request.headers,
        asResponse: true,
      });
      if (!response.ok)
        return fail(400, { passwordError: 'Unable to add a password to this account.' });
    } catch {
      return fail(400, {
        passwordError:
          'A password is already set for this account, or the request could not be completed.',
      });
    }
    redirect(303, '/account?password=set');
  },
};
