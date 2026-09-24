// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Database } from '$lib/server/repository/db';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** D1 handle, attached in hooks.server.ts; null outside the Workers runtime. */
      db: Database | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
