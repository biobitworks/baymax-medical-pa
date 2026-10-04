import type { AppleHealthDay, AppleHealthStatus } from '../../shared/apple-health';
import type { Query } from './store';

export class AppleHealthStore {
  constructor(private query: Query) {}
  async pair(sessionHash: string, tokenHash: string) {
    const rows = await this.query(`INSERT INTO baymax_apple_health_connections (session_hash, token_hash)
      SELECT session_hash, $2 FROM baymax_care_workspaces WHERE session_hash = $1 AND state->>'remember' = 'true'
      ON CONFLICT (session_hash) DO UPDATE SET token_hash = EXCLUDED.token_hash RETURNING session_hash`, [sessionHash, tokenHash]);
    return rows.length > 0;
  }
  async status(sessionHash: string, days = 7): Promise<AppleHealthStatus> {
    const rows = await this.query(`SELECT c.last_sync_at, COALESCE((
      SELECT jsonb_agg(d.metrics ORDER BY d.date DESC) FROM (
        SELECT metrics, date FROM baymax_apple_health_days WHERE session_hash = c.session_hash
        AND date >= (now() AT TIME ZONE c.time_zone)::date - ($2::int - 1) ORDER BY date DESC LIMIT $2
      ) d), '[]'::jsonb) AS daily
      FROM baymax_apple_health_connections c JOIN baymax_care_workspaces w USING (session_hash)
      WHERE c.session_hash = $1 AND w.state->>'remember' = 'true'`, [sessionHash, days]);
    if (!rows.length) return { connected: false, lastSyncAt: null, daily: [] };
    const timestamp = rows[0].last_sync_at;
    return { connected: true, lastSyncAt: timestamp ? new Date(String(timestamp)).toISOString() : null, daily: rows[0].daily as AppleHealthDay[] };
  }
  async import(tokenHash: string, daily: AppleHealthDay[], exportedAt: string, timeZone: string): Promise<boolean> {
    const rows = await this.query(`WITH owner AS (
      SELECT c.session_hash FROM baymax_apple_health_connections c JOIN baymax_care_workspaces w USING (session_hash)
      WHERE c.token_hash = $1 AND w.state->>'remember' = 'true' FOR UPDATE OF c
    ), saved AS (
      INSERT INTO baymax_apple_health_days (session_hash, date, metrics, exported_at)
      SELECT owner.session_hash, (entry->>'date')::date, entry, $3::timestamptz
      FROM owner CROSS JOIN jsonb_array_elements($2::jsonb) entry
      ON CONFLICT (session_hash, date) DO UPDATE SET
        metrics = baymax_apple_health_days.metrics || jsonb_strip_nulls(EXCLUDED.metrics),
        exported_at = EXCLUDED.exported_at
      WHERE EXCLUDED.exported_at >= baymax_apple_health_days.exported_at RETURNING session_hash
    ) UPDATE baymax_apple_health_connections SET last_sync_at = now(), time_zone = $4
      WHERE session_hash IN (SELECT session_hash FROM saved) RETURNING session_hash`, [tokenHash, JSON.stringify(daily), exportedAt, timeZone]);
    return rows.length > 0;
  }
  async acceptsToken(tokenHash: string) {
    const rows = await this.query(`SELECT 1 FROM baymax_apple_health_connections c JOIN baymax_care_workspaces w USING (session_hash)
      WHERE c.token_hash = $1 AND w.state->>'remember' = 'true'`, [tokenHash]);
    return rows.length > 0;
  }
  async disconnect(sessionHash: string) {
    // Imported summaries cascade with the connection; workspace deletion also cascades.
    await this.query('DELETE FROM baymax_apple_health_connections WHERE session_hash = $1', [sessionHash]);
  }
}
