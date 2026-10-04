import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import type { createBrowserManager } from "../src/browser.ts";
import { createMutationQueue } from "../src/queue.ts";
import { createWorkerServer } from "../src/server.ts";

const id = "00000000-0000-4000-8000-000000000001";
const token = "test-worker-token-at-least-32-characters";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("settlement skips old queued mutations and drains the global create queue", async () => {
  const queue = createMutationQueue();
  const blocker = deferred();
  const started = deferred();
  const actions: string[] = [];
  const running = queue.serial("create", async () => {
    started.resolve();
    await blocker.promise;
    actions.push("running completed");
  });
  await started.promise;
  const ticket = queue.snapshot();
  const queuedCreate = queue.serial("create", () => queue.mutation(id, async () => { actions.push("old create"); }, undefined, ticket));
  const cancelled = assert.rejects(queuedCreate, /cancelled by a control handoff/);
  let settled = false;
  const barrier = queue.settle(id).then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  blocker.resolve();
  await Promise.all([running, cancelled, barrier]);
  assert.deepEqual(actions, ["running completed"]);
  await queue.mutation(id, async () => { actions.push("new owner"); });
  assert.deepEqual(actions, ["running completed", "new owner"]);
});

test("authenticated HTTP barrier awaits running work and rejects aborted queued clicks", async () => {
  const queue = createMutationQueue();
  const blocker = deferred();
  const started = deferred();
  const queued = deferred();
  const actions: string[] = [];
  const fixture = {
    mutationSnapshot: queue.snapshot,
    generation: (id: string) => ({ id, generation: queue.generation(id) }),
    settle: queue.settle,
    input: (sessionId: string, body: Record<string, unknown>, signal?: AbortSignal, ticket = queue.snapshot()) => {
      if (body.type === "click") queued.resolve();
      return queue.mutation(sessionId, async () => {
        if (body.type === "block") { started.resolve(); await blocker.promise; }
        actions.push(String(body.type));
        return { id: sessionId };
      }, signal, ticket);
    },
    close: async () => { await queue.drain(); },
  } as Awaited<ReturnType<typeof createBrowserManager>>;
  const worker = await createWorkerServer({ token, dataDir: "/unused-test-fixture" }, async () => fixture);
  await new Promise<void>((resolve) => worker.server.listen(0, "127.0.0.1", resolve));
  const address = worker.server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/sessions/${id}`;
  const post = (path: string, body = {}, signal?: AbortSignal) => fetch(`${url}/${path}`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body), signal,
  });
  try {
    const running = post("input", { type: "block" });
    await started.promise;
    const controller = new AbortController();
    const click = post("input", { type: "click" }, controller.signal);
    const cancelled = assert.rejects(click, /abort/i);
    await queued.promise;
    controller.abort();
    await cancelled;
    let settled = false;
    const barrier = post("settle").then(async (response) => {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { id, settled: true, generation: 1 });
      settled = true;
    });
    // Observe the production server receiving the barrier before releasing work.
    await new Promise<void>((resolve) => worker.server.once("request", () => resolve()));
    assert.equal(settled, false);
    blocker.resolve();
    assert.equal((await running).status, 200);
    await barrier;
    assert.deepEqual(actions, ["block"]);
    await queue.drain();
    assert.deepEqual(actions, ["block"], "no old click occurs after acknowledgement");
    assert.equal((await fetch(`${url}/settle`, { method: "POST" })).status, 401);
  } finally {
    blocker.resolve();
    await worker.close();
  }
});

test("a streamed pre-handoff body cannot adopt the next mutation generation", async () => {
  const queue = createMutationQueue();
  let mutations = 0;
  const fixture = {
    mutationSnapshot: queue.snapshot,
    generation: (id: string) => ({ id, generation: queue.generation(id) }),
    settle: queue.settle,
    input: (sessionId: string, _body: Record<string, unknown>, signal?: AbortSignal, ticket = queue.snapshot()) =>
      queue.mutation(sessionId, async () => { mutations++; return { id: sessionId }; }, signal, ticket),
    close: async () => { await queue.drain(); },
  } as Awaited<ReturnType<typeof createBrowserManager>>;
  const worker = await createWorkerServer({ token, dataDir: "/unused-test-fixture" }, async () => fixture);
  await new Promise<void>((resolve) => worker.server.listen(0, "127.0.0.1", resolve));
  const address = worker.server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/sessions/${id}`;
  const received = new Promise<void>((resolve) => worker.server.once("request", () => resolve()));
  let slow!: ReturnType<typeof request>;
  const outcome = new Promise<number>((resolve, reject) => {
    slow = request(`${base}/input`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    }, (response) => { response.resume(); resolve(response.statusCode!); });
    slow.on("error", reject);
    slow.write('{"type":');
  });
  try {
    await received;
    const response = await fetch(`${base}/settle`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    slow.end('"click"}');
    assert.equal(await outcome, 409);
    assert.equal(mutations, 0);
    // Simulate a POST dispatched by the previous owner but arriving after ack.
    const mutation = (generation: number) => fetch(`${base}/input`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-browser-mutation-generation": String(generation) },
      body: JSON.stringify({ type: "click" }),
    });
    assert.equal((await mutation(0)).status, 409);
    assert.equal(mutations, 0);
    assert.equal((await mutation(1)).status, 200);
    assert.equal(mutations, 1);
    assert.deepEqual(await (await fetch(`${base}/generation`, { headers: { authorization: `Bearer ${token}` } })).json(), { id, generation: 1 });
  } finally { slow.destroy(); await worker.close(); }
});

test("request abort alone skips queued mutations without interrupting dispatched work", async () => {
  const queue = createMutationQueue();
  const blocker = deferred();
  const started = deferred();
  const controller = new AbortController();
  const actions: string[] = [];
  const running = queue.mutation(id, async () => {
    started.resolve();
    await blocker.promise;
    actions.push("running");
  }, controller.signal);
  await started.promise;
  const queued = queue.mutation(id, async () => { actions.push("queued"); }, controller.signal);
  const cancelled = assert.rejects(queued, /operation was cancelled/);
  controller.abort();
  assert.deepEqual(actions, []);
  blocker.resolve();
  await Promise.all([running, cancelled]);
  assert.deepEqual(actions, ["running"]);
});
