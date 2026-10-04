import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, RefreshCw, Copy, Download } from 'lucide-react';
import type { AppleHealthStatus } from '../shared/apple-health';
import './apple-health.css';

const empty: AppleHealthStatus = { connected: false, lastSyncAt: null, daily: [] };
async function connection(method = 'GET') {
  const response = await fetch('/health/apple/connection', { method, credentials: 'same-origin' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not reach Apple Health sync.');
  return body;
}

export function AppleHealthConnection({ remember, saved }: { remember: boolean; saved: boolean }) {
  const memoryEnabled = useRef(remember);
  memoryEnabled.current = remember;
  const [status, setStatus] = useState(empty);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState(window.location.origin);
  const load = useCallback(async () => {
    try {
      const next = await connection();
      if (memoryEnabled.current) { setStatus(next); setError(''); }
    } catch (failure) {
      if (memoryEnabled.current) setError(failure instanceof Error ? failure.message : 'Could not reach Apple Health sync.');
    }
  }, []);
  useEffect(() => {
    if (!remember) { setStatus(empty); setKey(''); setError(''); return; }
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30_000);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [remember, load]);
  const pair = async () => {
    setBusy(true); setError(''); setCopied(false);
    try {
      const body = await connection('POST');
      if (memoryEnabled.current) { setKey(body.token); await load(); }
    } catch (failure) {
      if (memoryEnabled.current) setError(failure instanceof Error ? failure.message : 'Could not connect.');
    }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true);
    try { await connection('DELETE'); setKey(''); setStatus(empty); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not disconnect.'); }
    finally { setBusy(false); }
  };
  let endpoint = '';
  try {
    const url = new URL(origin);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) endpoint = `${url.origin}/health/apple/import`;
  } catch { /* The setup form shows its validation message. */ }
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { setError('Select and copy the setup fields below.'); }
  };
  const latest = status.daily[0];
  return <section className="panel apple-health-panel">
    <Heart className="green-text" size={30} />
    <h2>Apple Health</h2>
    <p>Bring your steps, sleep, exercise, and water into Baymax with an iPhone Shortcut.</p>
    <p className="notice">{status.connected
      ? status.lastSyncAt ? `Last synced ${new Date(status.lastSyncAt).toLocaleString()}` : 'Connected. Waiting for your first sync.'
      : 'Apple Health is not connected.'}</p>
    {latest && <dl className="apple-health-readings">
      {[
        ['Steps', latest.steps == null ? 'Not shared' : latest.steps.toLocaleString()],
        ['Exercise', latest.activeMinutes == null ? 'Not shared' : `${latest.activeMinutes} min`],
        ['Sleep', latest.sleepHours == null ? 'Not shared' : `${latest.sleepHours} h`],
        ['Water', latest.hydrationMl == null ? 'Not shared' : `${latest.hydrationMl} mL`],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <small>Latest readings: {latest.date}</small>
    </dl>}
    {!remember && <p className="fine">Enable Remember across visits below to save your health readings.</p>}
    {remember && !saved && <p className="fine">Waiting for your care space to finish saving.</p>}
    <div className="apple-health-actions">
      <button className="primary" disabled={!remember || !saved || busy} onClick={() => void pair()}>
        {status.connected ? 'Create a new connection key' : 'Connect Apple Health'}
      </button>
      {status.connected && <button className="outline" disabled={busy} onClick={() => void load()}><RefreshCw size={15} /> Refresh readings</button>}
    </div>
    {remember && key && <div className="apple-health-setup">
      <h3>Set up your Shortcut</h3>
      <p>Download the Shortcut on your iPhone. In its first three Text actions, paste the sync address, connection key, and time zone below.</p>
      <a className="outline" href="/shortcuts/Sync-with-Baymax.shortcut" download><Download size={15} /> Download Sync with Baymax</a>
      <label>Baymax address<input type="url" value={origin} onChange={event => setOrigin(event.target.value)} /></label>
      {!endpoint && <p role="alert">Enter a valid http or https address.</p>}
      <label>Sync address<input readOnly value={endpoint} /></label>
      <button className="text-btn" disabled={!endpoint} onClick={() => void copy(endpoint)}><Copy size={14} /> Copy sync address</button>
      <label>Connection key<input readOnly type="password" value={key} autoComplete="off" /></label>
      <button className="text-btn" onClick={() => void copy(key)}><Copy size={14} /> Copy connection key</button>
      <label>Time zone<input readOnly value={Intl.DateTimeFormat().resolvedOptions().timeZone} /></label>
      {copied && <p className="fine" role="status">Copied.</p>}
      <p className="fine">Keep your key private. It is shown only here and a new key disables the previous one. Use an address your iPhone can reach; localhost points to the phone itself.</p>
      <p>Run the Shortcut, approve the Health categories you want to share, and refresh these readings. It reads the last seven days and does not write to Apple Health.</p>
    </div>}
    {status.connected && <button className="text-btn" disabled={busy} onClick={() => void disconnect()}>Disconnect &amp; remove imported health data</button>}
    {error && <p className="notice" role="alert">{error}</p>}
    <p className="fine">Only recorded readings count. Device totals are kept separate to avoid double counting. Sync runs when you run the Shortcut; it is not a live connection.</p>
  </section>;
}
