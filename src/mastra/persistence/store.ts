import { workspaceSchema, type CareWorkspace } from '../../shared/workspace';
export type Query = (statement: string, params: unknown[]) => Promise<Record<string, unknown>[]>;
export class CareStore {
  constructor(private query: Query) {}
  async load(sessionHash: string) {
    const [row] = await this.query('SELECT state, revision FROM baymax_care_workspaces WHERE session_hash = $1', [sessionHash]);
    return row ? { state: workspaceSchema.parse(row.state), revision: Number(row.revision) } : { state: null, revision: 0 };
  }
  async save(sessionHash: string, state: CareWorkspace, revision: number) {
    // A missing row may only be created at revision zero. This also stops a
    // stale tab from recreating a workspace another tab has just deleted.
    // Sequence-backed revisions also prevent reuse after delete/recreate.
    const rows = revision === 0
      ? await this.query('INSERT INTO baymax_care_workspaces (session_hash, state) VALUES ($1, $2::jsonb) ON CONFLICT (session_hash) DO NOTHING RETURNING revision', [sessionHash, JSON.stringify(state)])
      : await this.query('UPDATE baymax_care_workspaces SET state = $2::jsonb, revision = DEFAULT, updated_at = now() WHERE session_hash = $1 AND revision = $3 RETURNING revision', [sessionHash, JSON.stringify(state), revision]);
    return rows[0] ? Number(rows[0].revision) : null;
  }
  async remove(sessionHash: string) {
    await this.query('DELETE FROM baymax_care_workspaces WHERE session_hash = $1', [sessionHash]);
  }
}
