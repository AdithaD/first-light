import { describe, expect, it } from 'vitest';
import { createPbkdf2PasswordCallbacks } from '../../src/lib/server/auth/better-auth';
import { parseHash } from '../../src/lib/server/auth/password';

describe('Better Auth PBKDF2 callback adapter', () => {
  it('stores the existing PBKDF2 format with configured iterations and verifies it', async () => {
    const callbacks = createPbkdf2PasswordCallbacks({ iterations: 1000 });
    const hash = await callbacks.hash('correct horse battery staple');

    expect(parseHash(hash)).toStrictEqual({ iterations: 1000 });
    await expect(
      callbacks.verify({ password: 'correct horse battery staple', hash }),
    ).resolves.toBe(true);
    await expect(callbacks.verify({ password: 'wrong password', hash })).resolves.toBe(false);
  });

  it('keeps salted hashes non-deterministic', async () => {
    const callbacks = createPbkdf2PasswordCallbacks({ iterations: 1000 });
    const first = await callbacks.hash('same password');
    const second = await callbacks.hash('same password');
    expect(first).not.toBe(second);
    await expect(callbacks.verify({ password: 'same password', hash: first })).resolves.toBe(true);
    await expect(callbacks.verify({ password: 'same password', hash: second })).resolves.toBe(true);
  });
});
