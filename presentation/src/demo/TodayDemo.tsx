import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Cue, InteractionProvider} from './Interaction';
import {MascotSprite} from './MascotSprite';
import {Water, Walk, Check, Plus} from './Icons';
import './today-demo.css';

const timing = {energy: 28, save: 65, saved: 78, water: 120, walk: 175, plan: 235, medications: 280, questions: 325};
const actions = {Good: timing.energy, 'Save check-in': timing.save, 'Add a glass': timing.water,
  'Log 10 min': timing.walk, 'Open plan': timing.plan, 'Review my medication list': timing.medications,
  'Write down my questions': timing.questions};

export function TodayDemo() {
  const f = useCurrentFrame();
  const water = f >= timing.water + 4 ? 4 : 3;
  const walked = f >= timing.walk + 4;
  const plan = f >= timing.plan + 4;
  const reviewed = f >= timing.medications + 4;
  const questions = f >= timing.questions + 4;
  const completed = Number(walked) + Number(reviewed) + Number(questions);
  const tasks = [{label: 'Take a 10-minute walk', detail: 'A little movement, at your pace.', done: walked},
    {label: 'Review my medication list', detail: 'Bring your current list to your doctor.', done: reviewed},
    {label: 'Write down my questions', detail: 'Make room for what you want to discuss.', done: questions}];
  return <InteractionProvider scene="today" step={0} frame={f} actions={actions}>
    <div className="today-film">
      <aside className="today-film-sidebar"><div className="today-film-brand"><span>•—•</span>baymax<b>.</b></div><small>YOUR HEALTH JOURNAL</small><nav>{['Today', 'Talk', 'Plan', 'Activity', 'Travel', 'Doctor brief', 'Computer'].map((label, i) => <div key={label} className={(plan ? label === 'Plan' : label === 'Today') ? 'active' : ''}><span>{['▦', '◯', '▤', '♧', '↗', '▧', '▱'][i]}</span>{label}</div>)}</nav><div className="today-film-signoff">On your side.<br/><em>Even when you forget.</em></div><div className="today-film-profile">J <span>Jordan<small>Your health profile</small></span></div></aside>
      <main className="today-film-main">
        <div className="today-film-topline"><span>{plan ? 'Your plan' : 'Today'}</span><span>YOUR DAILY CARE</span></div>
        <div className="today-film-content">
          <div className="today-film-heading"><span>{plan ? 'YOUR DOCTOR VISIT' : 'SUNDAY 4 OCTOBER'}</span><h2>{plan ? 'A few steps. Just for you.' : 'Good afternoon, Jordan.'}</h2><p>{plan ? 'A little preparation for your next appointment.' : 'Let’s make a bit of room for you.'}</p></div>
          {!plan ? <>
            <section className="today-film-checkin"><div><span>From Baymax <b>•</b></span><h3>Before you get on with your day.</h3><p>How’s your energy? I’ll keep that in mind.</p><div className="today-film-energies">{['Low', 'Okay', 'Good', 'Great'].map((value, i) => <button key={value} className={value === 'Good' && f >= timing.energy + 4 ? 'selected' : ''}><span>{['◔', '◑', '◕', '●'][i]}</span>{value}<Cue id={value}/></button>)}</div><button className="today-film-save" disabled={f < timing.energy + 4}>{f >= timing.saved ? '✓ Checked in' : f >= timing.save ? 'Saving…' : 'Save check-in ↗'}<Cue id="Save check-in"/></button></div><MascotSprite size={220}/></section>
            <div className="today-film-section"><h3>Today, so far</h3><span>Sample data + your entries</span></div>
            <section className="today-film-readings">
              <article className="today-film-reading water"><div className="today-film-label"><Water size={28}/> Water</div><div className="today-film-value">{water}<span> / 8</span></div><p>glasses</p><div className="today-film-ticks">{Array.from({length:8},(_,i)=><i key={i} className={i<water?'filled':''}/>)}</div><button><Plus size={22}/>Add a glass<Cue id="Add a glass"/></button></article>
              <article className="today-film-reading movement"><div className="today-film-label"><Walk size={28}/> Movement</div><div className="today-film-value">{walked ? 10 : 0}<span> / 30</span></div><p>minutes</p><div className="today-film-track"><i style={{width:walked?'33.333%':'0%'}}/></div><button>{walked ? <Check size={22}/> : <Plus size={22}/>} {walked ? 'Walk logged' : 'Log 10 min'}<Cue id="Log 10 min"/></button></article>
              <article className="today-film-reading plan"><div className="today-film-label"><Check size={28}/> Your plan</div><div className="today-film-value">{completed}<span> / 3</span></div><p>things done</p><div className="today-film-track"><i style={{width:`${completed/3*100}%`}}/></div><button>Open plan ↗<Cue id="Open plan"/></button></article>
            </section><p className="today-film-source">Your daily log. Device readings are kept separately.</p>
          </> : <div className="today-film-plan"><div className="today-film-progress"><span>YOUR PREPARATION</span><h3>{completed} of 3 steps complete</h3><div><i style={{width:`${completed/3*100}%`}}/></div></div><section className="today-film-tasks">{tasks.map(task=><button key={task.label} className={task.done ? 'done' : ''}><span className="today-film-checkbox">{task.done && <Check size={23}/>}</span><span><strong>{task.label}</strong><small>{task.detail}</small></span><Cue id={task.label}/></button>)}</section><div className="today-film-plan-note"><MascotSprite size={95}/><p>{completed === 3 ? 'A little more ready. A little less to carry.' : 'Your care, one small step at a time.'}</p></div></div>}
        </div>
      </main>
    </div>
  </InteractionProvider>;
}
