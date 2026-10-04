import { workspaceSchema, type CareWorkspace } from '../shared/workspace';
export class PersistenceError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request(method: string, body?: unknown) {
  const response = await fetch('/care-state', {
    method, credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const message = response.status === 409 ? 'Your care space changed in another tab. Reload to use the saved version.' : 'Your changes have not been saved. Please try again.';
    throw new PersistenceError(message, response.status);
  }
  return response.json();
}
export const persistenceApi = {
  async load() {
    const data = await request('GET');
    if (!Number.isInteger(data.revision) || data.revision < 0) throw new PersistenceError('Could not restore your care space.', 502);
    return { state: data.state === null ? null : workspaceSchema.parse(data.state), revision: data.revision as number };
  },
  async save(state: CareWorkspace, revision: number) { const data = await request('PUT', { state, revision }); return data.revision as number; },
  async remove() { await request('DELETE'); },
};
export class SaveQueue {
  revision = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private blocked = false;
  constructor(private api: Pick<typeof persistenceApi, 'save' | 'remove'>) {}
  save(state: CareWorkspace) {
    const operation = this.tail.then(async () => {
      if (this.blocked) throw new PersistenceError('Reload your care space before saving.', 409);
      try { this.revision = await this.api.save(state, this.revision); }
      catch (error) { if (error instanceof PersistenceError && error.status === 409) this.blocked = true; throw error; }
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  remove() {
    const operation = this.tail.then(async () => {
      await this.api.remove();
      this.revision = 0;
      this.blocked = false;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
