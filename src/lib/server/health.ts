/**
 * Pure health-payload builder — kept free of I/O so it is unit-testable
 * and reusable by the uptime probe (Phase 7).
 */
export interface HealthPayload {
  status: 'ok';
  version: string;
  timestamp: string;
}

/** Build a deterministic health response; callers supply time/version rather than doing I/O here. */
export function healthPayload(version: string, now: Date = new Date()): HealthPayload {
  return {
    status: 'ok',
    version,
    timestamp: now.toISOString(),
  };
}
