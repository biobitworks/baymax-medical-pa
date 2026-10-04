import assert from "node:assert/strict";
import test from "node:test";
import { BrowserComputer } from "../src/mastra/computer/browser.ts";

const id = "00000000-0000-4000-8000-000000000001";
const token = "a-private-worker-token-at-least-32-characters";
const config = { workerUrl: "http://127.0.0.1:8790", workerToken: token, sessionId: id };
const session = { id, title: "Example", url: "https://example.com/", status: "active" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("unconfigured browser reports disabled and never contacts a worker", async () => {
  const browser = new BrowserComputer({ sessionId: id }, async () => { throw new Error("should not fetch"); });
  assert.equal(browser.configured, false);
  assert.deepEqual(await browser.status(), { configured: false });
  await assert.rejects(browser.read(), /not configured/);
});

test("navigation uses only the configured UUID and authenticates server requests", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const responses = [json([{ ...session, id: "another-session" }]), json(session), json([session]), json(session), json([{ ...session, status: "closed" }]), json(session)];
  const browser = new BrowserComputer(config, async (url, init) => {
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
  const browser = new BrowserComputer(config, async () => json([{ ...session, cookies: "secret" }]));
  assert.deepEqual(await browser.status(), { configured: true, session });
});

test("invalid browser URLs are rejected before worker requests", async () => {
  let calls = 0;
  const browser = new BrowserComputer(config, async () => { calls++; return json([]); });
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
    const browser = new BrowserComputer(config, fetcher);
    const status = await browser.status();
    assert.equal(status.configured, true);
    assert.ok(status.error);
    assert.ok(!status.error.includes(token));
    await assert.rejects(browser.read(), (error: Error) => !error.message.includes(token) && !error.message.includes(config.workerUrl));
  }
});

test("reads, inputs, screenshots, and close share the same fixed session", async () => {
  const calls: string[] = [];
  const browser = new BrowserComputer(config, async (url, init) => {
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
  const browser = new BrowserComputer(config, async () => json({ error: { code: "INVALID_INPUT", message: token } }, 400));
  await assert.rejects(browser.input({ type: "evaluate", script: "something" }), /Unsupported browser input/);
});

test("Baymax type input translates to the upstream worker text input", async () => {
  const browser = new BrowserComputer(config, async (url, init) => {
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
  const browser = new BrowserComputer(config, async (_url, init) => {
    methods.push(init!.method!);
    return await new Promise<Response>((resolve) => { completeStatus = resolve; });
  });
  const navigation = browser.navigate("https://example.com/", controller.signal);
  controller.abort(new Error(token));
  completeStatus(json([session]));
  await assert.rejects(navigation, /cancelled before navigation/);
  assert.deepEqual(methods, ["GET"], "no navigation POST follows the aborted status request");
});

test("aborted browser input propagates cancellation and reports an uncertain outcome", async () => {
  const controller = new AbortController();
  const browser = new BrowserComputer(config, async (_url, init) => {
    return await new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error(token)), { once: true });
    });
  });
  const input = browser.input({ type: "click", x: 4, y: 5 }, controller.signal);
  controller.abort(new Error(token));
  await assert.rejects(input, (error: Error) => /outcome may be unknown/.test(error.message) && /Refresh before repeating/.test(error.message) && !error.message.includes(token));
});

test("already aborted browser operations never dispatch requests", async () => {
  const controller = new AbortController();
  controller.abort();
  let requests = 0;
  const browser = new BrowserComputer(config, async () => { requests++; return json(session); });
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
  const browser = new BrowserComputer(config, async (_url, init) => {
    return await new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error(token)), { once: true });
    });
  });
  const input = browser.input({ type: "click", x: 4, y: 5 });
  context.mock.timers.tick(30_000);
  await assert.rejects(input, /outcome may be unknown/);
});
