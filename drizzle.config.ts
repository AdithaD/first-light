import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/server/auth/schema.ts',
  out: './drizzle',
});
