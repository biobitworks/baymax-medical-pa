import { ExternalLink, Globe2 } from "lucide-react";
import "./travel-advisories.css";

export type TravelSource = {
  title: string;
  url: string;
  domain: string;
  publishedDate: string | null;
  summary: string;
};

export type ResearchPanel = { status: "loading" | "done"; sources: TravelSource[] };
export type TravelResearch = {
  destination: string;
  cdc: ResearchPanel;
  smartraveller: ResearchPanel;
  city: ResearchPanel;
};
export const loadingResearch = (destination: string): TravelResearch => ({
  destination,
  cdc: { status: "loading", sources: [] },
  smartraveller: { status: "loading", sources: [] },
  city: { status: "loading", sources: [] },
});

function SourceList({ sources }: { sources: TravelSource[] }) {
  return (
    <ul className="travel-sources">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            <span>{s.title}</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <small>{s.domain}{s.publishedDate ? ` · ${s.publishedDate.slice(0, 10)}` : ""}</small>
          {s.summary && <p>{s.summary}</p>}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, panel, empty }: { title: string; panel: ResearchPanel; empty: string }) {
  return (
    <div className="travel-section" aria-busy={panel.status === "loading"}>
      <h4>{title}</h4>
      {panel.status === "loading" ? (
        <p role="status">Searching…</p>
      ) : panel.sources.length ? (
        <SourceList sources={panel.sources} />
      ) : (
        <p role="status">{empty}</p>
      )}
    </div>
  );
}

/** Live Exa research shown above the brief. Each section fills in as its own search finishes. */
export function TravelAdvisories({ research }: { research: TravelResearch | null }) {
  if (!research) return null;
  return (
    <section className="travel-advisories" aria-label="Travel advisories">
      <span className="eyebrow"><Globe2 size={13} aria-hidden="true" /> LIVE WEB SEARCH · ADVISORIES &amp; DESTINATION</span>
      <h3>Advisories and restrictions for {research.destination}</h3>
      <Section title="CDC and official travel notices" panel={research.cdc} empty="Could not verify current CDC notices right now. Check CDC Travelers’ Health before you go." />
      <Section title="Smartraveller (Australian government)" panel={research.smartraveller} empty="No Smartraveller advice found. Check smartraveller.gov.au." />
      <Section title={`Good to know in ${research.destination}`} panel={research.city} empty="No destination details found." />
      <small className="travel-foot">Search by Exa. Verify with official sources before relying on this.</small>
    </section>
  );
}
