import { env as privateEnv } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { drizzle } from 'drizzle-orm/d1';
import { hashPassword, verifyPassword, type PasswordHashOptions } from './password';
import { authSchema } from './schema';
export function createPbkdf2PasswordCallbacks(options: PasswordHashOptions = {}) {
  return {
    hash: (password: string) => hashPassword(password, options),
    verify: ({ password, hash }: { password: string; hash: string }) =>
      verifyPassword(password, hash),
  };
}

export function createBetterAuth(db: Parameters<typeof drizzle>[0]) {
  const clientId = privateEnv.GOOGLE_CLIENT_ID;
  const clientSecret = privateEnv.GOOGLE_CLIENT_SECRET;
  const baseURL = privateEnv.BETTER_AUTH_URL || privateEnv.APP_ORIGIN;
  if (!privateEnv.BETTER_AUTH_SECRET || privateEnv.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  }
  if (!baseURL) throw new Error('BETTER_AUTH_URL or APP_ORIGIN must be set explicitly.');

  const drizzleDb = drizzle(db, { schema: authSchema });

  return betterAuth({
    appName: 'First Light',
    baseURL,
    secret: privateEnv.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzleDb, {
      provider: 'sqlite',
      transaction: false,
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      password: createPbkdf2PasswordCallbacks(),
    },
    socialProviders:
      clientId && clientSecret
        ? {
            google: {
              clientId,
              clientSecret,
              prompt: 'select_account',
            },
          }
        : {},
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: false,
        trustedProviders: [],
        allowDifferentEmails: false,
      },
    },
    plugins: [sveltekitCookies(getRequestEvent)],
    telemetry: { enabled: false },
  });
}

export type FirstLightAuth = ReturnType<typeof createBetterAuth>;
