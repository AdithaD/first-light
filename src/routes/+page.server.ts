import type { PageServerLoad } from './$types';

/** Expose only the small identity flag needed to choose the home-page navigation. */
export const load: PageServerLoad = ({ locals }) => ({
  user: locals.user ? { name: locals.user.name } : null,
});
