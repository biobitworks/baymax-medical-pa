import assert from "node:assert/strict";
import test from "node:test";
import { BrowserComputer } from "../src/mastra/computer/browser.ts";

const id = "00000000-0000-4000-8000-000000000001";
const token = "a-private-worker-token-at-least-32-characters";
const config = { workerUrl: "http://127.0.0.1:8790", workerToken: token, sessionId: id };
const session = { id, title: "Example", url: "https://example.com/", status: "active" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function configuredBrowser(fetcher: typeof fetch) {
  return new BrowserComputer(config, async (url, init) => {
    if (String(url).endsWith("/generation")) return json({ id, generation: 0 });
    return fetcher(url, init);
  });
}

test("unconfigured browser reports disabled and never contacts a worker", async () => {
  const browser = new BrowserComputer({ sessionId: id }, async () => { throw new Error("should not fetch"); });
  assert.equal(browser.configured, false);
  assert.deepEqual(await browser.status(), { configured: false });
  await assert.rejects(browser.read(), /not configured/);
});

test("navigation uses only the configured UUID and authenticates server requests", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const responses = [json([{ ...session, id: "another-session" }]), json(session), json([session]), json(session), json([{ ...session, status: "closed" }]), json(session)];
  const browser = configuredBrowser( async (url, init) => {
    calls.push({ url: String(url), init });
    return responses.shift()!;
  });
  await browser.navigate("https://example.com/");
  await browser.navigate("https://example.com/next");
  await browser.navigate("https://example.com/reopen");
  assert.equal(calls[1].url, `${config.workerUrl}/sessions`);
  assert.deepEqual(JSON.parse(calls[1].init!.body as string), { id, url: "https://example.com/" });
  assert.equal(calls[3].url, `${config.workerUrl}/sessions/${id}/navigate`);
  assert.deepEqual(JSON.parse(calls[3].init!.body as string), { url: "https://example.com/next" });
  assert.equal(JSON.parse(calls[5].init!.body as string).id, id);
  for (const call of calls) {
    assert.equal(new Headers(call.init?.headers).get("authorization"), `Bearer ${token}`);
    assert.equal(call.init?.redirect, "error");
    assert.ok(call.init?.signal instanceof AbortSignal);
  }
  assert.equal(new Headers(calls[1].init?.headers).get("content-type"), "application/json");
});

test("status returns only the configured session metadata", async () => {
  const browser = configuredBrowser( async () => json([{ ...session, cookies: "secret" }]));
  assert.deepEqual(await browser.status(), { configured: true, session });
});

test("invalid browser URLs are rejected before worker requests", async () => {
  let calls = 0;
  const browser = configuredBrowser( async () => { calls++; return json([]); });
  for (const url of ["bad url", "file:///etc/passwd", "javascript:alert(1)", "https://user:secret@example.com", "https://example.com:8080", `https://example.com/${"x".repeat(8192)}`]) {
    await assert.rejects(browser.navigate(url), /Only public HTTP/);
  }
  assert.equal(calls, 0);
});

test("worker rejection and transport errors never leak credentials or response text", async () => {
  for (const fetcher of [
    async () => json({ error: { code: "BLOCKED_URL", message: token } }, 400),
    async () => json({ error: { code: "INVENTED", message: token } }, 500),
    async () => { throw new Error(`request ${config.workerUrl}: ${token}`); },
  ]) {
    const browser = configuredBrowser( fetcher);
    const status = await browser.status();
    assert.equal(status.configured, true);
    assert.ok(status.error);
    assert.ok(!status.error.includes(token));
    await assert.rejects(browser.read(), (error: Error) => !error.message.includes(token) && !error.message.includes(config.workerUrl));
  }
});

test("reads, inputs, screenshots, and close share the same fixed session", async () => {
  const calls: string[] = [];
  const browser = configuredBrowser( async (url, init) => {
    const path = String(url);
    calls.push(path);
    if (path.endsWith("/read")) return json({ title: "Example", url: session.url, text: "Visible text", truncated: false });
    if (path.endsWith("/screenshot")) return new Response(new Uint8Array([137, 80, 78, 71]));
    if (path.endsWith("/input")) assert.deepEqual(JSON.parse(init!.body as string), { type: "click", x: 4, y: 5 });
    return json(session);
  });
  assert.equal((await browser.read()).text, "Visible text");
  await browser.input({ type: "click", x: 4, y: 5 });
  assert.deepEqual(await browser.screenshot(), new Uint8Array([137, 80, 78, 71]));
  await browser.close();
  assert.ok(calls.every((path) => path.startsWith(`${config.workerUrl}/sessions/${id}/`)));
});

test("unsupported input is validated by the worker and safely reported", async () => {
  const browser = configuredBrowser( async () => json({ error: { code: "INVALID_INPUT", message: token } }, 400));
  await assert.rejects(browser.input({ type: "evaluate", script: "something" }), /Unsupported browser input/);
});

test("Baymax type input translates to the upstream worker text input", async () => {
  const browser = configuredBrowser( async (url, init) => {
    assert.equal(String(url), `${config.workerUrl}/sessions/${id}/input`);
    assert.deepEqual(JSON.parse(init!.body as string), { type: "text", text: "Hello browser" });
    return json(session);
  });
  const input = { type: "type", text: "Hello browser" };
  await browser.input(input);
  assert.equal(input.type, "type", "the shared API input is not mutated");
});

test("cancellation during delayed status prevents navigation dispatch", async () => {
  const controller = new AbortController();
  const methods: string[] = [];
  let completeStatus!: (response: Response) => void;
  const browser = configuredBrowser( async (_url, init) => {
    methods.push(init!.method!);
    return await new Promise<Response>((resolve) => { completeStatus = resolve; });
  });
  const navigation = browser.navigate("https://example.com/", controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort(new Error(token));
  completeStatus(json([session]));
  await assert.rejects(navigation, /cancelled before navigation/);
  assert.deepEqual(methods, ["GET"], "no navigation POST follows the aborted status request");
});

test("aborted browser input propagates cancellation and reports an uncertain outcome", async () => {
  const controller = new AbortController();
  const browser = configuredBrowser( async (_url, init) => {
    return await new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error(token)), { once: true });
    });
  });
  const input = browser.input({ type: "click", x: 4, y: 5 }, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort(new Error(token));
  await assert.rejects(input, (error: Error) => /outcome may be unknown/.test(error.message) && /Refresh before repeating/.test(error.message) && !error.message.includes(token));
});

test("already aborted browser operations never dispatch requests", async () => {
  const controller = new AbortController();
  controller.abort();
  let requests = 0;
  const browser = configuredBrowser( async () => { requests++; return json(session); });
  assert.match((await browser.status(controller.signal)).error!, /cancelled/);
  for (const operation of [
    () => browser.navigate("https://example.com/", controller.signal),
    () => browser.read(controller.signal),
    () => browser.input({ type: "key", key: "Enter" }, controller.signal),
    () => browser.screenshot(controller.signal),
    () => browser.close(controller.signal),
  ]) await assert.rejects(operation(), /cancelled/);
  assert.equal(requests, 0);
});

test("browser input deadline aborts the request and reports an uncertain outcome", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = configuredBrowser( async (_url, init) => {
    return await new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error(token)), { once: true });
    });
  });
  const input = browser.input({ type: "click", x: 4, y: 5 });
  await new Promise((resolve) => setImmediate(resolve));
  context.mock.timers.tick(30_000);
  await assert.rejects(input, /outcome may be unknown/);
});

test("settlement requires a matching worker acknowledgement and preserves the session", async () => {
  let finish!: (response: Response) => void;
  const browser = configuredBrowser( async (url, init) => {
    assert.equal(String(url), `${config.workerUrl}/sessions/${id}/settle`);
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${token}`);
    return await new Promise<Response>((resolve) => { finish = resolve; });
  });
  let acknowledged = false;
  const settlement = browser.settle().then(() => { acknowledged = true; });
  await Promise.resolve();
  assert.equal(acknowledged, false);
  finish(json({ id, settled: true, generation: 1 }));
  await settlement;
  assert.equal(acknowledged, true);
  await new BrowserComputer({ sessionId: id }, async () => { throw new Error("must not fetch"); }).settle();
});

test("failed or malformed settlement is reported with a fixed safe handoff error", async () => {
  for (const body of [{ id, settled: false, generation: 1 }, { id: "another", settled: true, generation: 1 }, { id, settled: true }, { id, settled: true, generation: 0 }]) {
    const browser = configuredBrowser( async () => json(body));
    await assert.rejects(browser.settle(), /handoff could not be confirmed/);
  }
  const browser = configuredBrowser( async () => { throw new Error(token); });
  await assert.rejects(browser.settle(), (error: Error) => /Retry taking control/.test(error.message) && !error.message.includes(token));
});

test("settlement deadline aborts transport without acknowledging ownership", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = configuredBrowser( async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(new Error(token)), { once: true });
  }));
  const settlement = browser.settle();
  context.mock.timers.tick(30_000);
  await assert.rejects(settlement, /handoff could not be confirmed/);
});

test("all browser mutations send a generation captured before dispatch", async () => {
  let generation = 7;
  let active = true;
  const posts: { path: string; generation: string | null }[] = [];
  const browser = new BrowserComputer(config, async (url, init) => {
    const path = String(url);
    if (path.endsWith("/generation")) return json({ id, generation: generation++ });
    if (path.endsWith("/sessions") && init?.method === "GET") return json(active ? [session] : []);
    posts.push({ path, generation: new Headers(init?.headers).get("x-browser-mutation-generation") });
    return json(session);
  });
  await browser.input({ type: "key", key: "Enter" });
  await browser.close();
  await browser.navigate("https://example.com/");
  active = false;
  await browser.navigate("https://example.com/");
  assert.deepEqual(posts.map((item) => item.generation), ["7", "8", "9", "10"]);
  assert.ok(posts[0].path.endsWith("/input"));
  assert.ok(posts[1].path.endsWith("/close"));
  assert.ok(posts[2].path.endsWith("/navigate"));
  assert.ok(posts[3].path.endsWith("/sessions"));
});

test("navigation keeps its prepared generation across delayed status and a settlement", async () => {
  let completeStatus!: (response: Response) => void;
  let generation = 4;
  let sentGeneration: string | null = null;
  const browser = new BrowserComputer(config, async (url, init) => {
    const path = String(url);
    if (path.endsWith("/generation")) return json({ id, generation });
    if (path.endsWith("/sessions")) return await new Promise<Response>((resolve) => { completeStatus = resolve; });
    if (path.endsWith("/settle")) return json({ id, settled: true, generation: ++generation });
    sentGeneration = new Headers(init?.headers).get("x-browser-mutation-generation");
    return json({ error: { code: "OPERATION_CANCELLED" } }, 409);
  });
  const navigation = browser.navigate("https://example.com/");
  const rejected = assert.rejects(navigation, /browser worker/);
  await new Promise((resolve) => setImmediate(resolve));
  await browser.settle();
  completeStatus(json([session]));
  await rejected;
  assert.equal(sentGeneration, "4", "late navigation cannot acquire the new owner generation");
});

test("aborted generation preparation never dispatches a browser mutation", async () => {
  const controller = new AbortController();
  let finish!: (response: Response) => void;
  const calls: string[] = [];
  const browser = new BrowserComputer(config, async (url) => {
    calls.push(String(url));
    return await new Promise<Response>((resolve) => { finish = resolve; });
  });
  const input = browser.input({ type: "click", x: 4, y: 5 }, controller.signal);
  const rejected = assert.rejects(input, /cancelled/);
  controller.abort();
  finish(json({ id, generation: 2 }));
  await rejected;
  assert.deepEqual(calls, [`${config.workerUrl}/sessions/${id}/generation`]);
});
