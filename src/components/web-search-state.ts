export type SearchSource = {
  title: string;
  url: string;
  domain: string;
  publishedDate: string | null;
  highlights: string[];
};
export type WebSearchCardArgs =
  | { state: "loading" | "error" }
  | { state: "complete"; sources: SearchSource[] };

export type SearchCardPart = {
  type: "tool-call";
  toolName: "web_search";
  toolCallId: string;
  args: WebSearchCardArgs;
  argsText: string;
  result: { ready: boolean };
};

type StreamEvent = { type?: string; payload?: Record<string, unknown> };

function sourcesFromResult(result: unknown): SearchSource[] | undefined {
  if (!result || typeof result !== "object" || !("results" in result) || !Array.isArray(result.results)) return;
  return result.results.slice(0, 10).flatMap((source: unknown): SearchSource[] => {
    if (!source || typeof source !== "object" || !("url" in source) || typeof source.url !== "string") return [];
    try {
      const url = new URL(source.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return [];
      return [{
        url: url.href,
        domain: url.hostname.replace(/^www\./, ""),
        title: "title" in source && typeof source.title === "string" && source.title.trim() ? source.title : url.hostname,
        publishedDate: "publishedDate" in source && typeof source.publishedDate === "string" ? source.publishedDate : null,
        highlights: "highlights" in source && Array.isArray(source.highlights)
          ? source.highlights.filter((item): item is string => typeof item === "string").slice(0, 2)
          : [],
      }];
    } catch { return []; }
  });
}

/** Convert only Exa events; keep call IDs so updates replace their loading card. */
export function searchCardFromEvent({ type, payload }: StreamEvent): SearchCardPart | undefined {
  if (!payload || !["webSearchTool", "search-web"].includes(String(payload.toolName))) return;
  let args: WebSearchCardArgs;
  if (type === "tool-call") args = { state: "loading" };
  else if (type === "tool-error" || (type === "tool-result" && payload.isError)) args = { state: "error" };
  else if (type === "tool-result") {
    const sources = sourcesFromResult(payload.result);
    args = sources ? { state: "complete", sources } : { state: "error" };
  } else return;
  return {
    type: "tool-call",
    toolName: "web_search",
    toolCallId: typeof payload.toolCallId === "string" ? payload.toolCallId : "web-search",
    args,
    argsText: JSON.stringify(args),
    result: { ready: true },
  };
}
