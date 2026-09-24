import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME } from '$lib/server/repository/sessions';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, matches SessionRepository TTL

export function setSessionCookie(cookies: Cookies, rawToken: string): void {
  cookies.set(SESSION_COOKIE_NAME, rawToken, {
    path: '/',
    httpOnly: true, // not readable from JS — XSS mitigation
    sameSite: 'lax', // CSRF baseline; top-level GET navigations still send it
    secure: !dev, // HTTPS-only in production (localhost exempt in dev)
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
