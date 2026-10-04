import { fail, redirect } from '@sveltejs/kit';
import {
  LocalityLookupError,
  resolveAustralianLocality,
} from '$lib/server/integrations/open-meteo/geocoding';
import { CURATED_TOPICS, NEWS_SOURCES } from '$lib/server/preferences/catalogue';
import { validatePreferenceForm } from '$lib/server/preferences/validation';
import { getUserPreferences, saveUserPreferences } from '$lib/server/repository/preferences';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, request, url }) => {
  // Protect both account details and saved preference data with the current session.
  if (!locals.auth || !locals.user || !locals.session) redirect(303, '/login');
  const accounts = await locals.auth.api.listUserAccounts({ headers: request.headers });
  const preferences = locals.db ? await getUserPreferences(locals.db, locals.user.id) : null;
  return {
    email: locals.user.email,
    displayName: locals.user.name,
    sessionExpiresAt: locals.session.expiresAt,
    hasPassword: accounts.some((account) => account.providerId === 'credential'),
    passwordNotice: url.searchParams.get('password'),
    preferences,
    sources: NEWS_SOURCES,
    topics: CURATED_TOPICS,
    preferencesNotice: url.searchParams.get('preferences'),
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

    // Delegate password verification and session revocation to Better Auth.
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

    // Google-only accounts use Better Auth to add a credential rather than creating a second user.
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
  savePreferences: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');
    if (!locals.db)
      return fail(503, { preferencesErrors: ['Preferences are unavailable right now.'] });

    const validation = validatePreferenceForm(await request.formData());
    if (!validation.values) {
      return fail(400, {
        preferencesErrors: validation.errors,
        preferencesInput: validation.input,
      });
    }

    const weatherEnabled = validation.values.weatherEnabled;
    const newsEnabled = validation.values.newsEnabled;
    let existingPreferences;
    try {
      existingPreferences = await getUserPreferences(locals.db, locals.user.id);
    } catch (error) {
      console.error('Digest preference read failed', { userId: locals.user.id, error });
      return fail(500, {
        preferencesErrors: ['Unable to load your saved preferences. Please try again.'],
        preferencesInput: validation.input,
      });
    }
    let locality: Awaited<ReturnType<typeof resolveAustralianLocality>> | null = null;
    // Avoid an external geocoding call unless enabled Weather needs a new/unresolved locality.
    const shouldResolveLocation =
      weatherEnabled &&
      (validation.values.localityName !== existingPreferences?.localityName ||
        validation.values.localityRegion !== existingPreferences?.localityRegion ||
        existingPreferences?.latitude === null ||
        existingPreferences?.latitude === undefined);
    if (shouldResolveLocation) {
      try {
        locality = await resolveAustralianLocality(
          validation.values.localityName,
          validation.values.localityRegion,
        );
      } catch (error) {
        if (error instanceof LocalityLookupError) {
          return fail(error.status, {
            preferencesErrors: [error.message],
            preferencesInput: validation.input,
          });
        }
        return fail(503, {
          preferencesErrors: ['Location lookup is temporarily unavailable. Please try again.'],
          preferencesInput: validation.input,
        });
      }
    }

    try {
      // Preserve each disabled module's own settings while still allowing shared delivery settings to change.
      const shouldApplyNewsForm = newsEnabled;
      const shouldApplyWeatherForm = weatherEnabled;
      await saveUserPreferences(locals.db, {
        userId: locals.user.id,
        weatherEnabled,
        newsEnabled,
        localityName: shouldApplyWeatherForm
          ? (locality?.name ?? existingPreferences?.localityName ?? null)
          : (existingPreferences?.localityName ?? null),
        localityRegion: shouldApplyWeatherForm
          ? (locality?.region ?? existingPreferences?.localityRegion ?? null)
          : (existingPreferences?.localityRegion ?? null),
        latitude: shouldApplyWeatherForm
          ? (locality?.latitude ?? existingPreferences?.latitude ?? null)
          : (existingPreferences?.latitude ?? null),
        longitude: shouldApplyWeatherForm
          ? (locality?.longitude ?? existingPreferences?.longitude ?? null)
          : (existingPreferences?.longitude ?? null),
        timezone: validation.values.timezone,
        deliveryLocalTime: validation.values.deliveryLocalTime,
        digestLength: validation.values.digestLength,
        sourceMode: shouldApplyNewsForm
          ? validation.values.sourceMode
          : (existingPreferences?.sourceMode ?? validation.values.sourceMode),
        topics: shouldApplyNewsForm
          ? validation.values.topics
          : (existingPreferences?.topics ?? []),
        selectedSourceIds: shouldApplyNewsForm
          ? validation.values.selectedSourceIds
          : (existingPreferences?.selectedSourceIds ?? []),
      });
    } catch (error) {
      console.error('Digest preference persistence failed', {
        userId: locals.user.id,
        error,
      });
      return fail(500, {
        preferencesErrors: ['Unable to save preferences right now. Please try again.'],
        preferencesInput: validation.input,
      });
    }

    redirect(303, '/account?preferences=saved');
  },
};
