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

const blocked = [
  ["email", "Pharmacies near alice@example.invalid for a refill"],
  ["phone", "Please call 415-555-0142 about pharmacy opening times"],
  ["patient-id", "Find guidance for patient ID MED-0042"],
  ["first-person", "I take a medication for my allergy; find local pharmacies"],
  ["percent-encoded-email", "Pharmacies near alice%40example.invalid"],
  ["multi-line", "Pharmacies in Madrid\npatient records follow"],
];

for (const [name, query] of blocked) {
  test("no Exa egress for synthetic " + name, async () => {
    process.env.EXA_API_KEY = "synthetic-test-key";
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("MUST_NOT_CALL"); };
    await assert.rejects(
      searchExa({ query }),
      (err: Error) => {
        assert.match(err.message, /general|de-identified/i);
        assert.ok(!err.message.includes("alice@"));
        assert.ok(!err.message.includes("415-555"));
        return true;
      },
    );
    assert.equal(calls, 0);
  });
}

test("no Exa egress with malformed or identifying domain filter", async () => {
  process.env.EXA_API_KEY = "synthetic-test-key";
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("MUST_NOT_CALL"); };
  await assert.rejects(
    searchExa({ query: "pharmacies in Madrid", includeDomains: ["alice@example.invalid"] }),
    /domain filters/i,
  );
  assert.equal(calls, 0);
});

test("generic pharmacy guidance reaches mocked transport, with no extra data", async () => {
  process.env.EXA_API_KEY = "synthetic-test-key";
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    calls++;
    assert.equal(url, "https://api.exa.ai/search");
    const body = JSON.parse(String(opts?.body));
    assert.equal(body.query, "pharmacies in Madrid");
    assert.deepEqual(body.includeDomains, ["cdc.gov"]);
    assert.equal(body.numResults, 5);
    assert.equal(body.type, "auto");
    assert.ok(!("profile" in body));
    assert.ok(!("healthRecords" in body));
    return Response.json({results: []});
  };
  const result = await searchExa({query: "pharmacies in Madrid", includeDomains: ["cdc.gov"]});
  assert.deepEqual(result.results, []);
  assert.equal(calls, 1);
});
