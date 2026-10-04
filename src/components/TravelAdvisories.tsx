import { ExternalLink, Globe2 } from "lucide-react";
import "./travel-advisories.css";

export type TravelSource = {
  title: string;
  url: string;
  domain: string;
  publishedDate: string | null;
  summary: string;
};

export type TravelResearch = {
  destination: string;
  advisories: TravelSource[];
  cityDetails: TravelSource[];
  error?: string;
};

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

/** Live Exa research shown above the brief: advisories first, then city notes. */
export function TravelAdvisories({ research, loading }: { research: TravelResearch | null; loading: boolean }) {
  if (!loading && !research) return null;
  const where = research?.destination ? ` for ${research.destination}` : "";
  return (
    <section className="travel-advisories" aria-label="Travel advisories" aria-busy={loading}>
      <span className="eyebrow"><Globe2 size={13} aria-hidden="true" /> LIVE WEB SEARCH · CDC &amp; TRAVEL ADVISORIES</span>
      <h3>Advisories and restrictions{where}</h3>
      {loading ? (
        <p role="status">Baymax is searching official sources…</p>
      ) : research && research.advisories.length ? (
        <SourceList sources={research.advisories} />
      ) : (
        <p role="status">Could not verify current advisories right now. Check CDC Travelers’ Health before you go.</p>
      )}
      {!loading && research && research.cityDetails.length > 0 && (
        <>
          <h4>Good to know in {research.destination}</h4>
          <SourceList sources={research.cityDetails} />
        </>
      )}
      <small className="travel-foot">Search by Exa. Verify with official sources before relying on this.</small>
    </section>
  );
}
