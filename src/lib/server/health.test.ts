import { describe, expect, it } from 'vitest';
import { healthPayload } from './health';

describe('healthPayload', () => {
  it('reports ok with the given version and an ISO timestamp', () => {
    const at = new Date('2026-09-24T00:00:00Z');
    const payload = healthPayload('0.1.0', at);

    expect(payload).toStrictEqual({
      status: 'ok',
      version: '0.1.0',
      timestamp: '2026-09-24T00:00:00.000Z',
    });
  });

  it('defaults to the current time', () => {
    const payload = healthPayload('dev');
    expect(Math.abs(Date.now() - new Date(payload.timestamp).getTime())).toBeLessThan(1000);
  });
});
