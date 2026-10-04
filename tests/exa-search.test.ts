import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { searchExa } from "../src/mastra/lib/exa-search.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.EXA_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.EXA_API_KEY;
  else process.env.EXA_API_KEY = originalKey;
});

test("missing credentials fail before sending a search", async () => {
  delete process.env.EXA_API_KEY;
  globalThis.fetch = async () => { throw new Error("Must not send request"); };
  await assert.rejects(searchExa({ query: "pharmacies in Madrid" }), /EXA_API_KEY/);
});

test("search returns citable sources and authenticates only on the server", async () => {
  process.env.EXA_API_KEY = "test-key";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.exa.ai/search");
    assert.equal(new Headers(options?.headers).get("x-api-key"), "test-key");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.query, "pharmacies in Madrid");
    assert.equal(body.numResults, 5);
    assert.equal(body.type, "auto");
    assert.ok(body.contents.highlights);
    assert.ok(options?.signal);
    return Response.json({ results: [{ title: "Pharmacy", url: "https://example.org", highlights: ["Open daily"], publishedDate: "2026-10-01" }] });
  };
  const result = await searchExa({ query: "pharmacies in Madrid" });
  assert.equal(result.results[0].url, "https://example.org");
  assert.deepEqual(result.results[0].highlights, ["Open daily"]);
  assert.equal(result.results[0].publishedDate, "2026-10-01");
});

test("provider errors do not expose response bodies or credentials", async () => {
  process.env.EXA_API_KEY = "test-key";
  globalThis.fetch = async () => new Response("private query and test-key", { status: 429 });
  await assert.rejects(searchExa({ query: "pharmacies" }), (error: Error) => {
    assert.match(error.message, /429/);
    assert.doesNotMatch(error.message, /private query|test-key/);
    return true;
  });
});

test("invalid input fails before any request", async () => {
  process.env.EXA_API_KEY = "test-key";
  globalThis.fetch = async () => { throw new Error("Must not send request"); };
  await assert.rejects(searchExa({ query: " " }), /query/i);
  await assert.rejects(searchExa({ query: "pharmacies", numResults: 100 }), /numResults/);
});

test("malformed provider responses fail instead of becoming fabricated sources", async () => {
  process.env.EXA_API_KEY = "test-key";
  globalThis.fetch = async () => Response.json({ unexpected: true });
  await assert.rejects(searchExa({ query: "pharmacies" }), /response/i);
});
