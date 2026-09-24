import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { healthPayload } from '$lib/server/health';

import type { RequestHandler } from './$types';

// Uptime-probe target (Phase 7). APP_VERSION is set as a Worker var at deploy;
// falls back to 'dev' locally.
export const GET: RequestHandler = () => json(healthPayload(env.APP_VERSION ?? 'dev'));
