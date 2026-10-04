import { ExternalLink, Search } from "lucide-react";
import type { WebSearchCardArgs } from "./web-search-state";
import "./web-search-card.css";

function publicationDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function WebSearchCard({ args }: { args: WebSearchCardArgs }) {
  const sources = args.state === "complete" ? args.sources : [];
  return (
    <section className="agent-card web-search-card" aria-label="Web search sources" aria-busy={args.state === "loading"}>
      <div className="agent-card-top">
        <Search size={16} aria-hidden="true" />
        <span>WEB SOURCES</span>
        <span className="agent-status">{args.state === "loading" ? "Searching" : args.state === "error" ? "Unavailable" : `${sources.length} ${sources.length === 1 ? "source" : "sources"}`}</span>
      </div>
      {args.state === "loading" ? (
        <p role="status">Looking for useful sources…</p>
      ) : args.state === "error" ? (
        <p role="status">I couldn’t complete that search. Please try asking again.</p>
      ) : sources.length === 0 ? (
        <p role="status">No sources found. Try a broader question or a different location.</p>
      ) : (
        <ol className="web-search-sources">
          {sources.map((source, index) => {
            const date = publicationDate(source.publishedDate);
            return (
              <li key={`${source.url}-${index}`}>
                <a className="web-search-title" href={source.url} target="_blank" rel="noopener noreferrer">
                  <span>{source.title}</span><ExternalLink size={14} aria-hidden="true" />
                  <span className="web-search-sr-only"> (opens in a new tab)</span>
                </a>
                <div className="web-search-meta">
                  <span>{source.domain}</span>
                  {date && <time dateTime={source.publishedDate ?? undefined}>{date}</time>}
                </div>
                {source.highlights.length > 0 && <p className="web-search-excerpt">{source.highlights.join(" ")}</p>}
              </li>
            );
          })}
        </ol>
      )}
      <div className="web-search-footer">Search by Exa</div>
    </section>
  );
}
