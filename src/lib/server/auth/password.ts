/**
 * Password hashing via WebCrypto PBKDF2-SHA256 (ADR-0005).
 * Workers-native (no binaries). Format:
 *   pbkdf2$sha256$<iterations>$<salt-b64url>$<hash-b64url>
 * Iterations are configurable (AUTH_PBKDF2_ITERATIONS) because hashing runs
 * inside the Worker and counts against the CPU budget (ADR-0001). Default
 * 100k is a deliberate trade-off documented in ARCHITECTURE.md — revisit on
 * Workers Paid or if threat model changes.
 */
const DEFAULT_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const te = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const paddedB64 = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(paddedB64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(
  password: string,
  opts: { iterations?: number } = {},
): Promise<string> {
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const salt = fromB64url(parts[3]);
  const expected = fromB64url(parts[4]);
  const actual = await deriveBits(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** Hash format self-describes its parameters — used by tests and future upgrades. */
export function parseHash(stored: string): { iterations: number } | null {
  const parts = stored.split('$');
  if (parts.length !== 5) return null;
  const iterations = Number(parts[2]);
  return Number.isInteger(iterations) && iterations > 0 ? { iterations } : null;
}
