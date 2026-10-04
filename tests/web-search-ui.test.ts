import assert from "node:assert/strict";
import { test } from "node:test";
import { searchCardFromEvent } from "../src/components/web-search-state.ts";

test("search calls immediately create a loading card with a stable call id", () => {
  const card = searchCardFromEvent({ type: "tool-call", payload: { toolName: "webSearchTool", toolCallId: "search-1" } });
  assert.equal(card?.toolCallId, "search-1");
  assert.equal(card?.args.state, "loading");
});

test("search results replace the loading card and retain source metadata", () => {
  const card = searchCardFromEvent({ type: "tool-result", payload: { toolName: "webSearchTool", toolCallId: "search-1", result: { results: [{ title: "Official guidance", url: "https://www.cdc.gov/travel", highlights: ["Plan ahead"], publishedDate: "2026-10-01" }] } } });
  assert.equal(card?.toolCallId, "search-1");
  assert.equal(card?.args.state, "complete");
  if (card?.args.state === "complete") {
    assert.equal(card.args.sources[0].domain, "cdc.gov");
    assert.equal(card.args.sources[0].title, "Official guidance");
    assert.equal(card.args.sources[0].publishedDate, "2026-10-01");
  }
});

test("empty results produce an empty card rather than invented sources", () => {
  const card = searchCardFromEvent({ type: "tool-result", payload: { toolName: "search-web", result: { results: [] } } });
  assert.equal(card?.args.state, "complete");
  if (card?.args.state === "complete") assert.equal(card.args.sources.length, 0);
});

test("unsafe source URLs are excluded from clickable results", () => {
  const card = searchCardFromEvent({ type: "tool-result", payload: { toolName: "webSearchTool", result: { results: [{ title: "Unsafe", url: "javascript:alert(1)" }, { title: "Local file", url: "file:///tmp/private" }] } } });
  if (card?.args.state !== "complete") assert.fail("Expected complete state");
  assert.equal(card.args.sources.length, 0);
});

test("tool failures produce generic error cards without echoing private errors", () => {
  const card = searchCardFromEvent({ type: "tool-error", payload: { toolName: "webSearchTool", error: "secret credentials" } });
  assert.equal(card?.args.state, "error");
  assert.doesNotMatch(JSON.stringify(card), /secret credentials/);
});

test("malformed results produce an error card", () => {
  assert.equal(searchCardFromEvent({ type: "tool-result", payload: { toolName: "webSearchTool", result: { error: "search failed" } } })?.args.state, "error");
});

test("other tools do not create search cards", () => {
  assert.equal(searchCardFromEvent({ type: "tool-result", payload: { toolName: "dailyMetricsTool", result: {} } }), undefined);
});
