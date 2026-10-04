import { AppleHealthStore } from '../persistence/apple-health-store';
import { query } from '../persistence/database';
import { HEALTH_SESSION_KEY } from '../persistence/session';
import type { AppleHealthStatus } from '../../shared/apple-health';

export const appleHealthStore = new AppleHealthStore(query);
export async function importedHealth(context?: { requestContext?: { get: (key: string) => unknown } }, days = 7): Promise<AppleHealthStatus> {
  const sessionHash = context?.requestContext?.get(HEALTH_SESSION_KEY);
  const disconnected: AppleHealthStatus = { connected: false, lastSyncAt: null, daily: [] };
  if (typeof sessionHash !== 'string') return disconnected;
  try {
    return await appleHealthStore.status(sessionHash, days);
  } catch {
    // Optional Health sync must not break the demo before migration or during an outage.
    // Callers explicitly identify fallback metrics/profile as synthetic demo data.
    return disconnected;
  }
}
