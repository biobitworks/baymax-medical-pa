import { WorkerError } from "./errors.ts";

export function checkCancellation(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new WorkerError("OPERATION_CANCELLED", "The browser operation was cancelled.", 409);
}

/** Serial browser operations plus an acknowledgement barrier for ownership changes. */
export function createMutationQueue() {
  const queues = new Map<string, Promise<unknown>>();
  const generations = new Map<string, number>();
  const snapshot = () => new Map(generations);
  async function serial<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const next = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(fn);
    queues.set(id, next);
    try { return await next; }
    finally { if (queues.get(id) === next) queues.delete(id); }
  }
  function mutation<T>(id: string, fn: () => Promise<T>, signal?: AbortSignal, ticket = snapshot()) {
    return serial(id, async () => {
      checkCancellation(signal);
      if ((ticket.get(id) ?? 0) !== (generations.get(id) ?? 0))
        throw new WorkerError("OPERATION_CANCELLED", "The browser operation was cancelled by a control handoff.", 409);
      // Once dispatched, await the real browser operation even if HTTP disconnects.
      return fn();
    });
  }
  async function settle(id: string) {
    generations.set(id, (generations.get(id) ?? 0) + 1);
    // A create may still be waiting outside the session queue. First drain that
    // global queue, then append a barrier behind every enqueued session job.
    await serial("create", async () => {});
    await serial(id, async () => {});
    return { id, settled: true as const, generation: generations.get(id)! };
  }
  return { snapshot, generation: (id: string) => generations.get(id) ?? 0, serial, mutation, settle, drain: () => Promise.allSettled([...queues.values()]) };
}
