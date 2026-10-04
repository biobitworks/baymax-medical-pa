import { useState } from 'react';
import { ArrowUpRight, Check, Droplets, Footprints, Plus } from 'lucide-react';
import Mascot from '../Mascot';
import type { CareWorkspace } from '../shared/workspace';

type Energy = CareWorkspace['energy'];
export function Today({ workspace, onWater, onToggle, onCheckin, onNavigate }: {
  workspace: CareWorkspace;
  onWater: () => void;
  onToggle: (label: string) => void;
  onCheckin: (energy: Energy) => Promise<boolean>;
  onNavigate: (page: string) => void;
}) {
  const { energy, water, activeMinutes, done, planItems, goal, date, week } = workspace;
  const [choice, setChoice] = useState<Energy>(energy);
  const [saving, setSaving] = useState(false);
  const completed = planItems.filter(item => done.includes(item.label)).length;
  const minutes = activeMinutes + (done.includes('Take a 10-minute walk') ? 10 : 0);
  const checkedIn = !!energy && choice === energy;
  const eventDate = new Date(`${date}T12:00:00`);
  const save = async () => {
    if (!choice || saving) return;
    setSaving(true);
    try { await onCheckin(choice); } finally { setSaving(false); }
  };
  return <div className="today-journal">
    <section className="daily-checkin" aria-labelledby="checkin-question">
      <div className="checkin-note">
        <div className="checkin-author"><Mascot small /><span>From Baymax<span className="note-dot" aria-hidden="true" /></span></div>
        <h2 id="checkin-question">Before you get on with your day.</h2>
        <p>How’s your energy? I’ll keep that in mind.</p>
      </div>
      <div className="checkin-response">
        <div className="energy-choices" role="group" aria-label="Your energy today">
          {(['Low', 'Okay', 'Good', 'Great'] as const).map((value, index) => <button key={value} type="button" aria-pressed={choice === value} disabled={saving} onClick={() => setChoice(value)}>
            <span className={`energy-mark energy-mark-${index}`} aria-hidden="true">{['◔', '◑', '◕', '●'][index]}</span>{value}
          </button>)}
        </div>
        <button className={`checkin-save ${checkedIn ? 'is-saved' : ''}`} disabled={!choice || saving || checkedIn} onClick={() => void save()}>
          {checkedIn ? <><Check size={16} /> Checked in</> : saving ? 'Saving…' : <>Save check-in <ArrowUpRight size={16} /></>}
        </button>
      </div>
    </section>

    <div className="journal-section-title"><h2>Today, so far</h2><span className="data-source">Sample data + your entries</span></div>
    <section className="daily-readings" aria-label="Today's readings">
      <article className="daily-reading water-reading">
        <div className="reading-label"><Droplets size={17} /><span>Water</span></div>
        <p className="reading-value">{water}<span> / 8</span></p><span className="reading-unit">glasses</span>
        <div className="reading-track water-ticks" aria-label={`${water} of 8 glasses`}>{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < water ? 'filled' : ''} />)}</div>
        <button className="reading-action" onClick={onWater} disabled={water >= 8} aria-label="Add one glass of water"><Plus size={15} /> {water >= 8 ? 'Goal reached' : 'Add a glass'}</button>
      </article>
      <article className="daily-reading movement-reading">
        <div className="reading-label"><Footprints size={17} /><span>Movement</span></div>
        <p className="reading-value">{minutes}<span> / 30</span></p><span className="reading-unit">minutes</span>
        <div className="reading-track"><i style={{ width: `${Math.min(100, minutes / 30 * 100)}%` }} /></div>
        <button className="reading-action" aria-pressed={done.includes('Take a 10-minute walk')} onClick={() => onToggle('Take a 10-minute walk')}>
          {done.includes('Take a 10-minute walk') ? <><Check size={15} /> Walk logged</> : <><Plus size={15} /> Log 10 min</>}
        </button>
      </article>
      <article className="daily-reading plan-reading">
        <div className="reading-label"><Check size={17} /><span>Your plan</span></div>
        <p className="reading-value">{completed}<span> / {planItems.length}</span></p><span className="reading-unit">things done</span>
        <div className="reading-track"><i style={{ width: `${planItems.length ? completed / planItems.length * 100 : 0}%` }} /></div>
        <button className="reading-action" onClick={() => onNavigate('Your plan')}>Open plan <ArrowUpRight size={15} /></button>
      </article>
    </section>
    <div className="journal-source-note"><span>Your daily log. Device readings are kept separately.</span><button onClick={() => onNavigate('Privacy & preferences')}>Apple Health <ArrowUpRight size={13} /></button></div>

    <div className="journal-columns">
      <section className="journal-tasks" aria-labelledby="next-steps-title">
        <div className="journal-section-title"><h2 id="next-steps-title">A few things for you</h2><button onClick={() => onNavigate('Your plan')} className="text-btn">Full plan <ArrowUpRight size={14} /></button></div>
        {planItems.slice(0, 3).map(item => <button className="journal-task" key={item.label} aria-pressed={done.includes(item.label)} onClick={() => onToggle(item.label)}>
          <span className={`check ${done.includes(item.label) ? 'checked' : ''}`}>{done.includes(item.label) && <Check size={13} />}</span>
          <span className={done.includes(item.label) ? 'struck' : ''}>{item.label}{item.when && <small>{item.when}</small>}</span>
        </button>)}
      </section>
      <aside className="journal-next">
        <span className="eyebrow">ON YOUR CALENDAR</span>
        <p className="calendar-date">{Number.isNaN(eventDate.getTime()) ? date : eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
        <h2>{goal || 'Make room for what matters.'}</h2>
        <button className="text-btn" onClick={() => onNavigate('Your plan')}>See your preparation <ArrowUpRight size={15} /></button>
        <button className="calendar-travel" onClick={() => onNavigate('Travel care')}>Travelling? Get your care ready. <ArrowUpRight size={14} /></button>
      </aside>
    </div>
    {week.length > 0 && <section className="journal-week">
      <div className="journal-section-title"><h2>The past seven days</h2><span><i className="legend-water" /> Water <i className="legend-movement" /> Movement</span></div>
      <div className="journal-week-bars">{week.slice(-7).map(day => <div className="journal-day" key={day.date}>
        <div className="journal-day-tracks"><span style={{ height: `${Math.min(100, day.hydrationMl / 2000 * 100)}%` }} title={`${day.hydrationMl} mL water`} /><span style={{ height: `${Math.min(100, day.activeMinutes / 30 * 100)}%` }} title={`${day.activeMinutes} minutes of movement`} /></div>
        <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</small>
      </div>)}</div>
      <p className="fine">Daily targets: 8 glasses of water and 30 minutes of movement.</p>
    </section>}
  </div>;
}
