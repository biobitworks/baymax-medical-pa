import { z } from "zod";

export const exaSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(500).describe(
    "A general web search query. Never include names, contact details, user records, or identifiable health information.",
  ),
  numResults: z.number().int().min(1).max(10).default(5),
  includeDomains: z.array(z.string().trim().min(1).max(253)).max(10).optional()
    .describe("Optional domains to restrict sources, such as cdc.gov or nhs.uk"),
});

const sourceSchema = z.object({
  title: z.string().nullish().transform((title) => title ?? "Untitled source"),
  url: z.url().refine((url) => /^https?:\/\//i.test(url)),
  publishedDate: z.string().nullish().transform((date) => date ?? null),
  highlights: z.array(z.string()).default([]),
});

export const exaSearchOutputSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.url(),
    publishedDate: z.string().nullable(),
    highlights: z.array(z.string()),
  })),
});

/** Server-only search. Do not pass user profiles or private health records. */
export async function searchExa(
  input: z.input<typeof exaSearchInputSchema>,
  abortSignal?: AbortSignal,
) {
  const { query, numResults, includeDomains } = exaSearchInputSchema.parse(input);
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) throw new Error("Exa search is not configured. Set EXA_API_KEY in the server .env.");

  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults,
      ...(includeDomains?.length ? { includeDomains } : {}),
      contents: { highlights: { maxCharacters: 2000 } },
    }),
    signal: abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout,
  });

  // Do not echo provider response bodies: they can contain the search query.
  if (!response.ok) throw new Error(`Exa search failed (HTTP ${response.status}). Try again later or check the server's Exa credentials and quota.`);
  const parsed = z.object({ results: z.array(sourceSchema) }).safeParse(await response.json());
  if (!parsed.success) throw new Error("Exa returned an invalid search response.");
  return parsed.data;
}
