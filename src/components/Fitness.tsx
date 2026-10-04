import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, Bell, Check, ChevronLeft, Footprints, Heart, Settings2, Sparkles, X } from 'lucide-react';
import type { ActivityGoals, FitnessOverview, FitnessPreferences } from '../mastra/lib/fitness';
import './fitness.css';

export type SavedPreferences = FitnessPreferences & { onboarded?: boolean };
type DashboardData = FitnessOverview & { source?: 'demo' | 'apple_health' };
export const FITNESS_CHANGED = 'baymax-fitness-changed';
const PRESETS = [
  { steps: 5000, activeMinutes: 20, label: 'Start small', detail: 'Make room for movement' },
  { steps: 7500, activeMinutes: 30, label: 'A steady routine', detail: 'Build a steady habit' },
  { steps: 10000, activeMinutes: 40, label: 'More active days', detail: 'More time on your feet' },
];
export async function fitnessRequest<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/health/${path}`, body ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  if (!response.ok) throw new Error('Baymax couldn’t save or load your activity data. Please try again.');
  return response.json();
}
function changed(preferences: SavedPreferences) {
  window.dispatchEvent(new CustomEvent(FITNESS_CHANGED, { detail: preferences }));
}
function GoalOptions({ value, onChange }: { value: ActivityGoals | null; onChange: (goal: ActivityGoals) => void }) {
  const groupId = useId();
  return <div className="fitness-goal-options" role="radiogroup" aria-label="Daily activity goals">
    {PRESETS.map(goal => {
      const selected = value?.steps === goal.steps && value.activeMinutes === goal.activeMinutes;
      return <label key={goal.steps} className={`fitness-goal-option ${selected ? 'selected' : ''}`}>
        <input type="radio" name={groupId} checked={selected} onChange={() => onChange({ steps: goal.steps, activeMinutes: goal.activeMinutes })} />
        <span><b>{goal.label}</b><small>{goal.detail}</small><span className="fitness-goal-values"><span><Footprints size={16} /> {goal.steps.toLocaleString()} steps</span><span><Activity size={16} /> {goal.activeMinutes} min</span></span></span>
        <span className="fitness-choice-check" aria-hidden="true">{selected && <Check size={16} />}</span>
      </label>;
    })}
  </div>;
}

export function ActivityOnboarding({ initialName = 'Alex', initialPreferences, onComplete, onCancel, welcomeExtra }: {
  /** Rendered under the name field on the first step (e.g. a consent checkbox). */
  welcomeExtra?: ReactNode;
  initialName?: string; initialPreferences?: SavedPreferences;
  onComplete?: (preferences: SavedPreferences) => void; onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialPreferences?.name ?? initialName);
  const [goals, setGoals] = useState<ActivityGoals | null>(initialPreferences?.goals ?? null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');
  const [notificationChoice, setNotificationChoice] = useState<FitnessPreferences['notifications'] | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, [step, finished]);
  async function finish(allow: boolean) {
    if (!goals || busy) return;
    setBusy(true); setError('');
    let notifications: FitnessPreferences['notifications'] = notificationChoice ?? 'off';
    try {
      if (allow && !notificationChoice) {
        if (!('Notification' in window) || !window.isSecureContext) notifications = 'unavailable';
        else {
          const permission = await Notification.requestPermission();
          notifications = permission === 'granted' ? 'enabled' : 'off';
        }
        setNotificationChoice(notifications);
      } else if (!allow) notifications = 'off';
      const saved = await fitnessRequest<SavedPreferences>('preferences', { name: name.trim(), goals, notifications });
      changed(saved); setFinished(true); onComplete?.(saved);
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  if (finished) return <section className="fitness-onboarding fitness-complete" aria-live="polite"><span className="fitness-illustration"><Check size={40} /></span><h2 tabIndex={-1} ref={titleRef}>Your goals are ready, {name.trim()}.</h2><p>{goals?.steps.toLocaleString()} steps and {goals?.activeMinutes} active minutes a day. You can adjust these whenever you need.</p><button className="outline" onClick={() => { setFinished(false); setStep(2); }}>Adjust my goals</button></section>;
  return <section className="fitness-onboarding">
    <div className="fitness-onboarding-top"><span className="eyebrow">LET’S GET ACQUAINTED</span>{onCancel && <button className="icon" aria-label="Close onboarding" onClick={onCancel} disabled={busy}><X size={20} /></button>}</div>
    <div className="fitness-step-track" aria-label={`Step ${step + 1} of 4`}>{['Welcome', 'Movement', 'Goals', 'Reminders'].map((label, i) => <span key={label} className={i <= step ? 'active' : ''}><i />{label}</span>)}</div>
    <span className={`fitness-illustration step-${step}`}>{step === 0 ? <Heart size={42} /> : step === 1 ? <Activity size={42} /> : step === 2 ? <Footprints size={42} /> : <Bell size={42} />}</span>
    <h2 ref={titleRef} tabIndex={-1}>{['First, what should I call you?', 'Two ways to track movement.', 'Set a starting point.', 'Want a heads-up?'][step]}</h2>
    {step === 0 && <><p>I’m Baymax, your health PA. Let’s start with your name and a routine that works for you.</p><label>What should I call you?<input value={name} onChange={e => setName(e.target.value)} maxLength={30} autoComplete="given-name" /></label>{welcomeExtra}<p className="fine">You choose what to share. Your goals are saved to your account.</p></>}
    {step === 1 && <><p>Steps track time on your feet. Active minutes track the movement time recorded in your activity log.</p><div className="fitness-explain"><span><Footprints size={23} /><b>Steps</b><small>Walking, wherever it happens.</small></span><span><Activity size={23} /><b>Active minutes</b><small>Time spent being active.</small></span></div><p className="fine">Your dashboard currently uses sample activity. Device tracking isn’t connected yet.</p></>}
    {step === 2 && <><p>Pick a starting point. You can change it whenever you like.</p><GoalOptions value={goals} onChange={setGoals} /><p className="fine">These are optional activity goals, not a personalized exercise prescription.</p></>}
    {step === 3 && <><p>Choose whether this browser can show goal celebrations while Baymax is open.</p><div className="fitness-notification-preview"><span><Heart size={23} /></span><div><b>Baymax · daily goals</b><p>That’s both movement goals for today. Nicely done.</p></div></div><p className="fine">You can say no. Browser permission is optional; background reminders aren’t supported.</p></>}
    {error && <p className="fitness-error" role="alert">{error}</p>}
    <div className="fitness-onboarding-actions">
      {step > 0 && <button className="text-btn" disabled={busy} onClick={() => { setError(''); setStep(step - 1); }}><ChevronLeft size={16} /> Back</button>}
      {step < 3 ? <button className="primary" disabled={step === 0 ? !name.trim() : step === 2 && !goals} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16} /></button> : <div className="fitness-final-actions"><button className="outline" disabled={busy} onClick={() => void finish(false)}>Not now</button><button className="primary" disabled={busy} onClick={() => void finish(true)}>{busy ? 'Saving…' : notificationChoice ? 'Save preferences' : 'Allow notifications'} <Bell size={16} /></button></div>}
    </div>
  </section>;
}

function Ring({ value, target, radius, color }: { value: number; target: number; radius: number; color: string }) {
  const circumference = 2 * Math.PI * radius;
  return <><circle cx="110" cy="110" r={radius} fill="none" stroke={color} strokeOpacity=".12" strokeWidth="10" /><circle cx="110" cy="110" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, value / target)))} transform="rotate(-90 110 110)" /></>;
}
function ActivityRings({ steps, minutes, goals, small = false }: { steps: number; minutes: number; goals: ActivityGoals; small?: boolean }) {
  return <div className={`fitness-rings ${small ? 'small' : ''}`}><svg viewBox="0 0 220 220" role="img" aria-label={`${steps.toLocaleString()} of ${goals.steps.toLocaleString()} steps; ${minutes} of ${goals.activeMinutes} active minutes`}><Ring value={minutes} target={goals.activeMinutes} radius={94} color="#359780" /><Ring value={steps} target={goals.steps} radius={77} color="#4b74a4" /></svg>{!small && <div className="fitness-ring-center"><strong>{minutes}</strong><span>active minutes</span><b>{steps.toLocaleString()}</b><span>steps today</span></div>}</div>;
}
function Trend({ label, field, data }: { label: string; field: 'steps' | 'activeMinutes'; data: FitnessOverview }) {
  const days = [...data.daily].reverse();
  const target = field === 'steps' ? data.goals.steps : data.goals.activeMinutes;
  const max = Math.max(target, ...days.map(day => day[field]), 1);
  return <section className={`panel fitness-trend ${field}`}><div><h3>{label}</h3><strong>{data.today?.[field].toLocaleString() ?? '—'} <small>{field === 'steps' ? 'steps' : 'min'}</small></strong><p className="fine">Today · goal {target.toLocaleString()}</p></div><div className="fitness-bars" role="img" aria-label={days.map(day => `${day.date}: ${day[field]} ${label}`).join('; ')}><div className="fitness-target-line" style={{ bottom: `calc(22px + ${target / max * 76}px)` }} />{days.map(day => <div className="fitness-bar-column" key={day.date}><div className="fitness-bar-track"><span style={{ height: `${day[field] / max * 100}%` }} title={`${day.date}: ${day[field]}`}>{day[field] >= target && <Check size={10} />}</span></div><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</small></div>)}</div></section>;
}

export function FitnessDashboard({ initialData, compact = false }: { initialData?: DashboardData; compact?: boolean }) {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [goals, setGoals] = useState<ActivityGoals | null>(null);
  const [saving, setSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [preferences, setPreferences] = useState<SavedPreferences>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const celebratedDate = useRef('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await fitnessRequest<DashboardData & { preferences: SavedPreferences }>('fitness');
        if (active) { setData(result); setPreferences(result.preferences); setError(''); }
      } catch { if (active) setError('Your activity data is unavailable. Try again when Baymax is connected.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    const refresh = () => { void load(); };
    window.addEventListener(FITNESS_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(FITNESS_CHANGED, refresh); };
  }, [retry]);
  useEffect(() => { if (editing) dialogRef.current?.showModal(); }, [editing]);
  useEffect(() => {
    const today = data?.today;
    if (today?.achieved && preferences?.notifications === 'enabled' && 'Notification' in window && Notification.permission === 'granted' && celebratedDate.current !== today.date) {
      celebratedDate.current = today.date;
      try {
        new Notification('A little celebration from Baymax', { body: 'Both daily activity goals met today.', tag: `baymax-activity-${today.date}` });
      } catch { /* Some browsers grant permission but don’t support desktop notifications. */ }
    }
  }, [data, preferences]);
  async function saveGoals() {
    if (!goals) return;
    setSaving(true); setGoalError('');
    try {
      const saved = await fitnessRequest<SavedPreferences>('goals', goals);
      // Update immediately; the shared event refreshes other dashboard instances.
      setData(current => current ? { ...current, goals, weeklyTarget: goals.activeMinutes * 7, daily: current.daily.map(day => ({ ...day, achieved: day.steps >= goals.steps && day.activeMinutes >= goals.activeMinutes })), achievedDays: current.daily.filter(day => day.steps >= goals.steps && day.activeMinutes >= goals.activeMinutes).length, today: current.today ? { ...current.today, achieved: current.today.steps >= goals.steps && current.today.activeMinutes >= goals.activeMinutes } : null } : current);
      changed(saved); setEditing(false);
    } catch (err) { setGoalError(err instanceof Error ? err.message : 'Goals didn’t save. Try again.'); }
    finally { setSaving(false); }
  }
  if (loading && !data) return <section className="panel" role="status">Getting your activity ready…</section>;
  if (!data) return <section className="panel"><h2>Your activity is unavailable.</h2><p role="alert">{error}</p><button className="outline" onClick={() => { setLoading(true); setRetry(retry + 1); }}>Try again</button></section>;
  if (showSetup) return <ActivityOnboarding initialPreferences={preferences} onCancel={() => setShowSetup(false)} onComplete={() => setShowSetup(false)} />;
  const today = data.today;
  const week = [...data.daily].reverse();
  return <div className={`fitness-dashboard ${compact ? 'compact' : ''}`}>
    <div className="fitness-toolbar"><span className="data-source">{data.source === 'apple_health' ? 'Apple Health' : 'Sample data'}</span><button className="outline" onClick={() => { setGoals(data.goals); setGoalError(''); setEditing(true); }}><Settings2 size={15} /> Edit goals</button></div>
    {error && <p className="fitness-error" role="alert">{error} <button className="text-btn" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
    <section className="panel fitness-summary"><div className="fitness-ring-block"><ActivityRings steps={today?.steps ?? 0} minutes={today?.activeMinutes ?? 0} goals={data.goals} /><div className="fitness-legend"><span><Activity size={15} /> Active minutes</span><span><Footprints size={15} /> Steps</span></div></div><div className="fitness-summary-copy"><span className="fitness-date">Today</span><h2>{today?.achieved ? 'Today’s goals, met.' : today && today.activeMinutes < data.goals.activeMinutes ? `${data.goals.activeMinutes - today.activeMinutes} minutes to go.` : today ? `${Math.max(0, data.goals.steps - today.steps).toLocaleString()} steps to go.` : 'A fresh start.'}</h2><p>{today ? `You’ve logged ${today.activeMinutes} active minutes today. Your daily target is ${data.goals.activeMinutes}.` : 'No activity recorded today. Your readings will appear here.'}</p><p className="fine">Daily targets: {data.goals.steps.toLocaleString()} steps · {data.goals.activeMinutes} active minutes</p><p className="fine">{data.source === 'apple_health' ? 'From your paired iPhone via Apple Health.' : 'Sample activity · pair your iPhone to use Apple Health.'}</p></div></section>
    <div className="fitness-progress-grid"><section className="panel fitness-daily-goals"><h3>Days with both goals</h3><div className="fitness-week-rings"><div><strong>{data.achievedDays}<small>/{data.daily.length}</small></strong><p className="fine">days achieved</p></div><div className="fitness-week-days">{week.map(day => <div key={day.date} title={`${day.date}: ${day.steps} steps, ${day.activeMinutes} active minutes`}><ActivityRings steps={day.steps} minutes={day.activeMinutes} goals={data.goals} small /><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</small>{day.achieved && <Check className="fitness-day-check" size={12} />}</div>)}</div></div><p className="fine">A day counts when you meet both goals.</p></section><section className="panel fitness-weekly"><h3>Active minutes this week</h3><strong>{data.weeklyMinutes}<small> / {data.weeklyTarget} min</small></strong><progress value={Math.min(data.weeklyMinutes, data.weeklyTarget)} max={data.weeklyTarget} aria-label="Weekly active minutes" /><p className="fine">Last 7 days · your daily active-minute goal × 7.</p></section></div>
    <div className="fitness-section-heading"><h2>The past seven days</h2><span className="fine">Last 7 days</span></div><div className="fitness-progress-grid"><Trend label="Active minutes" field="activeMinutes" data={data} /><Trend label="Steps" field="steps" data={data} /></div>
    {!compact && <section className="fitness-coach"><span className="fitness-coach-icon"><Sparkles size={22} /></span><div><h3>A routine that fits.</h3><p>Change your goals or how you hear from Baymax.</p></div><button className="outline" onClick={() => setShowSetup(true)}>Change routine <ArrowRight size={15} /></button></section>}
    {editing && <dialog ref={dialogRef} className="modal-backdrop" aria-label="Choose your daily activity goals" onCancel={event => { event.preventDefault(); if (!saving) setEditing(false); }}><section className="modal fitness-goal-modal"><button className="close icon" aria-label="Close goal settings" disabled={saving} onClick={() => setEditing(false)}><X size={20} /></button><span className="eyebrow">DAILY ACTIVITY TARGETS</span><h2>Choose your daily goals.</h2><p>Choose a pace that fits your day. You can change it later.</p><GoalOptions value={goals} onChange={setGoals} />{goalError && <p role="alert" className="fitness-error">{goalError}</p>}<button className="primary" disabled={!goals || saving} onClick={() => void saveGoals()}>{saving ? 'Saving…' : 'Set my goals'} <Check size={16} /></button></section></dialog>}
  </div>;
}
