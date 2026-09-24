// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Database } from '$lib/server/repository/db';
import type { FirstLightAuth } from '$lib/server/auth/better-auth';
import type { Session, User } from 'better-auth';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** D1 handle, attached in hooks.server.ts; null outside the Workers runtime. */
      db: Database | null;
      /** Request-scoped Better Auth instance, built from the D1 binding. */
      auth: FirstLightAuth | null;
      user: User | null;
      session: Session | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
