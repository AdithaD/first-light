import { describe, expect, it } from 'vitest';
import { hashPassword, parseHash, verifyPassword } from '../../src/lib/server/auth/password';

const FAST = { iterations: 1000 };

describe('PBKDF2 password hashing (WebCrypto, real implementation)', () => {
  it('round-trips: correct password verifies, wrong one does not', async () => {
    const stored = await hashPassword('correct horse battery staple', FAST);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('wrong password entirely', stored)).toBe(false);
  });

  it('embeds salt uniqueness: identical passwords hash differently', async () => {
    const a = await hashPassword('same password', FAST);
    const b = await hashPassword('same password', FAST);
    expect(a).not.toBe(b);
    expect(await verifyPassword('same password', a)).toBe(true);
    expect(await verifyPassword('same password', b)).toBe(true);
  });

  it('rejects tampered stored hashes', async () => {
    const stored = await hashPassword('a safe password', FAST);
    const tampered = stored.slice(0, -2) + (stored.endsWith('AA') ? 'BB' : 'AA');
    expect(await verifyPassword('a safe password', tampered)).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$2b$10$abc')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$sha256$notanumber$abc$def')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });

  it('records its parameters in the hash (self-describing, upgrade-friendly)', async () => {
    const stored = await hashPassword('a safe password', { iterations: 123_456 });
    expect(parseHash(stored)).toStrictEqual({ iterations: 123_456 });
    expect(parseHash('garbage')).toBeNull();
  });

  it('uses different salts per user even within the same millisecond', async () => {
    // 16 random salt bytes make collision practically impossible; assert variety.
    const hashes = new Set(
      await Promise.all(Array.from({ length: 5 }, () => hashPassword('pw', FAST))),
    );
    expect(hashes.size).toBe(5);
  });
});
