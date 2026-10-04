export type ComputerActionArgs = { metric: 'computer'; action: string; ok: boolean; summary: string };
export function ComputerActionCard({action,ok,summary}:ComputerActionArgs) {
  return <section className="care-card" aria-label="Baymax computer action">
    <p className="eyebrow">BAYMAX’S COMPUTER</p>
    <h3>{action.replaceAll('-', ' ')} · {ok ? 'Result ready' : 'Needs attention'}</h3>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:220,overflow:'auto'}}>{summary}</pre>
    <button className="outline" onClick={() => window.dispatchEvent(new Event('baymax-open-computer'))}>Open computer</button>
  </section>;
}
