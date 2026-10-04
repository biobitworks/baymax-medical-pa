import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Monitor, Terminal, Folder, Lock, RefreshCw, Play, Square, ArrowUp, FileText } from 'lucide-react';
import { computerRequest, getComputerCapability, lockComputer, unlockComputer } from '../computer/client';
import './computer.css';

type Receipt = { id: string; command: string; cwd: string; stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; interrupted: boolean; truncated: boolean; createdAt: string };
type BrowserSession = { id: string; title: string; url: string; status: string };
type Status = { enabled: boolean; terminal: { state: 'missing' | 'stopped' | 'running' | 'unavailable'; error?: string }; browser: { configured: boolean; session?: BrowserSession; error?: string }; receipts: Receipt[] };
type Entry = { name: string; path: string; type: 'directory' | 'file' | 'symlink'; size: number };
type Directory = { path: string; entries: Entry[] };
type Tab = 'Browser' | 'Terminal' | 'Files';

export function Computer() {
  const [unlocked, setUnlocked] = useState(Boolean(getComputerCapability()));
  const [accessKey, setAccessKey] = useState('');
  const [tab, setTab] = useState<Tab>('Browser');
  const [status, setStatus] = useState<Status>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('/workspace');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [directory, setDirectory] = useState<Directory>({ path: '/workspace', entries: [] });
  const [directoryPath, setDirectoryPath] = useState('/workspace');
  const [filePath, setFilePath] = useState('/workspace/note.txt');
  const [fileText, setFileText] = useState('');
  const [fileOpen, setFileOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [url, setUrl] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [pageRead, setPageRead] = useState<{ title: string; url: string; text: string; truncated: boolean }>();
  const [inputText, setInputText] = useState('');
  const [key, setKey] = useState('Enter');
  const imageUrl = useRef('');
  const generation = useRef(0);
  const running = status?.terminal.state === 'running';

  function clearImage() {
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = '';
    setScreenshot('');
  }
  function lock() {
    generation.current++;
    lockComputer(); setUnlocked(false); setAccessKey(''); setStatus(undefined);
    setReceipts([]); setPageRead(undefined); setFileText(''); setFileOpen(false); setDirty(false); setNotice(''); clearImage();
  }
  async function loadStatus() {
    const data = await computerRequest<Status>('/computer/status');
    setStatus(data); setReceipts(data.receipts);
    if (data.browser.session) setUrl(data.browser.session.url);
    return data;
  }
  async function action<T>(actionName: string, fields: Record<string, unknown> = {}) {
    return computerRequest<T>('/computer/actions', { action: actionName, ...fields });
  }
  async function refreshScreenshot() {
    const version = generation.current;
    const blob = await computerRequest<Blob>('/computer/screenshot');
    if (version !== generation.current) return;
    const next = URL.createObjectURL(blob);
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = next; setScreenshot(next);
  }
  async function listFiles(path = directoryPath) {
    const data = await action<Directory>('list', { path });
    setDirectory(data); setDirectoryPath(data.path);
  }
  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (failure) {
      const message = failure instanceof Error ? failure.message : 'The computer could not complete that action.';
      // An uncertain action can stop the sandbox; reconcile without replaying it.
      if (getComputerCapability()) { try { await loadStatus(); } catch { /* Keep the original action error. */ } }
      if (!getComputerCapability()) lock();
      setError(message);
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (unlocked) void perform(async () => { await loadStatus(); });
    return () => { generation.current++; if (imageUrl.current) URL.revokeObjectURL(imageUrl.current); };
  }, [unlocked]);
  useEffect(() => {
    if (!unlocked) return;
    const timer = window.setInterval(() => {
      if (!getComputerCapability()) { lock(); setError('Computer access expired. Unlock it again.'); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [unlocked]);
  useEffect(() => {
    if (tab === 'Files' && running && unlocked) void perform(async () => { await listFiles(); });
  }, [tab, running, unlocked]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const keyToUse = accessKey;
    setAccessKey('');
    await perform(async () => { await unlockComputer(keyToUse); setUnlocked(true); });
  }
  async function controlBrowser(input: Record<string, unknown>) {
    await action('browser-input', { input });
    await loadStatus();
    await refreshScreenshot();
  }
  function clickScreenshot(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1279, Math.max(0, Math.floor((event.clientX - bounds.left) / bounds.width * 1280)));
    const y = Math.min(799, Math.max(0, Math.floor((event.clientY - bounds.top) / bounds.height * 800)));
    void perform(async () => { await controlBrowser({ type: 'click', x, y }); });
  }

  return <section className="computer-view" aria-label="Baymax computer">
    <header className="computer-heading"><div><span className="computer-eyebrow">SHARED WORKSPACE</span><h2>Baymax’s computer</h2><p>A browser, terminal, and files you can use together.</p></div>{unlocked && <button className="computer-secondary" disabled={busy} onClick={() => void perform(async () => { try { await computerRequest('/computer/session', undefined, 'DELETE'); } finally { lock(); } })}><Lock size={15} />Lock computer</button>}</header>
    {error && <div className="computer-error" role="alert">{error}</div>}
    {notice && <div className="computer-notice" role="status">{notice}</div>}
    {!unlocked ? <div className="computer-unlock"><Monitor size={32} /><h3>Unlock your shared computer</h3><p>Enter the private access key configured on your Baymax server. Access lasts for this session and lets Baymax use the same browser and workspace.</p><form onSubmit={unlock}><label htmlFor="computer-access-key">Computer access key</label><input id="computer-access-key" type="password" autoComplete="off" value={accessKey} onChange={e => setAccessKey(e.target.value)} required /><button disabled={busy || !accessKey.trim()}>{busy ? 'Unlocking…' : 'Unlock computer'}</button></form><details><summary>Server setup</summary><p>Enable the computer and configure its private access key on the server. Terminal and files require Docker; browser controls require the configured browser worker. Ask the server owner for the access key.</p></details></div> : <>
      <div className="computer-toolbar"><span className={`computer-state ${running ? 'is-running' : ''}`}><i />{status ? `Terminal ${status.terminal.state}` : 'Checking computer…'}</span><div><button className="computer-secondary" disabled={busy} onClick={() => void perform(async () => { await loadStatus(); })}><RefreshCw size={14} />Refresh status</button><button disabled={busy || !status?.enabled || status.terminal.state === 'unavailable'} onClick={() => void perform(async () => { await action(running ? 'stop' : 'start'); await loadStatus(); if (!running && tab === 'Files') await listFiles(); setNotice(running ? 'Computer stopped. Workspace files are preserved.' : 'Computer started.'); })}>{running ? <Square size={14} /> : <Play size={14} />}{running ? 'Stop computer' : 'Start computer'}</button></div></div>
      {status?.enabled === false && <p className="computer-error">The computer is disabled on this server. Enable it in server configuration to continue.</p>}
      {status?.terminal.error && <p className="computer-error">{status.terminal.error}</p>}
      {status?.browser.error && <p className="computer-error" role="alert">{status.browser.error}</p>}
      <div className="computer-tabs" role="tablist" aria-label="Computer tools">{(['Browser', 'Terminal', 'Files'] as Tab[]).map((name, index) => <button key={name} id={`computer-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`computer-panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = (index + (e.key === 'ArrowRight' ? 1 : 2)) % 3; const nextTab = (['Browser', 'Terminal', 'Files'] as Tab[])[next]; setTab(nextTab); document.getElementById(`computer-tab-${nextTab}`)?.focus(); } }}>{name === 'Browser' ? <Monitor size={16} /> : name === 'Terminal' ? <Terminal size={16} /> : <Folder size={16} />}{name}</button>)}</div>
      <div className="computer-panel" id={`computer-panel-${tab}`} role="tabpanel" aria-labelledby={`computer-tab-${tab}`} aria-busy={busy}>
        {tab === 'Terminal' && <><p className="computer-help">Commands run in the isolated Linux computer. The /workspace folder persists when you stop it. Commands stop after 30 seconds.</p><form className="computer-command" onSubmit={e => { e.preventDefault(); void perform(async () => { const receipt = await action<Receipt>('command', { command, cwd, operationId: crypto.randomUUID() }); setReceipts(prev => [receipt, ...prev.filter(r => r.id !== receipt.id)]); setCommand(''); await loadStatus(); }); }}><label>Working directory<input value={cwd} onChange={e => setCwd(e.target.value)} required /></label><label>Terminal command<textarea value={command} onChange={e => setCommand(e.target.value)} placeholder="ls -la /workspace" spellCheck={false} required /></label><button disabled={busy || !running || !command.trim()}>{busy ? 'Working…' : 'Run command'}</button></form>{!running && <p className="computer-help">Start the computer to run commands.</p>}<h3>Command history</h3>{receipts.length ? <div className="computer-receipts">{receipts.map(receipt => <article key={receipt.id} className="computer-receipt"><div><code>$ {receipt.command}</code><span>{receipt.timedOut ? 'Timed out' : receipt.interrupted ? 'Interrupted' : receipt.exitCode === null ? 'Exit unknown' : `Exit ${receipt.exitCode}`}</span></div><small>{receipt.cwd} · {new Date(receipt.createdAt).toLocaleString()}</small>{receipt.stdout && <pre>{receipt.stdout}</pre>}{receipt.stderr && <pre className="computer-stderr">{receipt.stderr}</pre>}{!receipt.stdout && !receipt.stderr && <p>No output.</p>}{receipt.truncated && <p>Output was truncated.</p>}{(receipt.timedOut || receipt.interrupted || receipt.exitCode === null) && <p>The command may have changed files. Check the workspace before running it again.</p>}</article>)}</div> : <p className="computer-empty">No command receipts yet.</p>}</>}
        {tab === 'Files' && <><p className="computer-help">Browse and edit UTF-8 text files up to 256 KiB in the computer’s workspace.</p><form className="computer-address" onSubmit={e => { e.preventDefault(); void perform(async () => { await listFiles(); }); }}><label className="computer-grow">Directory<input value={directoryPath} onChange={e => setDirectoryPath(e.target.value)} /></label><button disabled={busy || !running}>Open directory</button><button type="button" className="computer-secondary" aria-label="Parent directory" disabled={busy || !running || directory.path === '/workspace'} onClick={() => void perform(async () => { await listFiles(directory.path.split('/').slice(0, -1).join('/') || '/workspace'); })}><ArrowUp size={16} /></button></form><div className="computer-files"><div className="computer-file-list"><strong>{directory.path}</strong>{directory.entries.length ? directory.entries.map(entry => <button className="computer-file-entry" key={entry.path} disabled={busy || !running || entry.type === 'symlink'} aria-label={`Open ${entry.name}`} onClick={() => { if (dirty && !window.confirm('Discard unsaved file changes?')) return; void perform(async () => { if (entry.type === 'directory') await listFiles(entry.path); else { const data = await action<{ path: string; text: string }>('read', { path: entry.path }); setFilePath(data.path); setFileText(data.text); setFileOpen(true); setDirty(false); } }); }}>{entry.type === 'directory' ? <Folder size={15} /> : <FileText size={15} />}<span>{entry.name}</span><small>{entry.type === 'directory' ? 'Folder' : entry.type === 'symlink' ? 'Link' : `${entry.size} B`}</small></button>) : <p className="computer-empty">{running ? 'This directory is empty.' : 'Start the computer to browse files.'}</p>}</div><form className="computer-file-editor" onSubmit={e => { e.preventDefault(); void perform(async () => { await action('write', { path: filePath, text: fileText }); setFileOpen(true); setDirty(false); await listFiles(); setNotice('File saved.'); }); }}><label>File path<input value={filePath} onChange={e => { setFilePath(e.target.value); setDirty(true); }} placeholder="/workspace/note.txt" required /></label><label>File contents<textarea value={fileText} onChange={e => { setFileText(e.target.value); setDirty(true); }} spellCheck={false} disabled={!running || busy} /></label><div className="computer-editor-actions"><button disabled={!running || busy || !filePath.trim() || (!dirty && fileOpen)}>Save file</button><button type="button" className="computer-secondary" disabled={!running || busy} onClick={() => { if (dirty && !window.confirm('Discard unsaved file changes?')) return; setFileOpen(false); setFilePath(`${directory.path}/new-file.txt`); setFileText(''); setDirty(true); }}>New file</button><span>{dirty ? 'Unsaved changes' : fileOpen ? 'Saved' : 'Create a text file'}</span></div></form></div><form className="computer-address" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const path = new FormData(form).get('folder'); void perform(async () => { await action('mkdir', { path }); await listFiles(); form.reset(); setNotice('Folder created.'); }); }}><label className="computer-grow">New folder path<input name="folder" placeholder={`${directory.path}/documents`} required /></label><button className="computer-secondary" disabled={!running || busy}>Create folder</button></form></>}
        {tab === 'Browser' && <>{status && !status.browser.configured ? <div className="computer-empty"><Monitor size={28} /><h3>Browser worker unavailable</h3><p>Configure the browser worker on your Baymax server to open pages here.</p></div> : <><form className="computer-address" onSubmit={e => { e.preventDefault(); void perform(async () => { await action('browse', { url }); setPageRead(undefined); await loadStatus(); await refreshScreenshot(); }); }}><label className="computer-grow">Browser address<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" required /></label><button disabled={busy || !status?.browser.configured}>Go</button><button type="button" className="computer-secondary" disabled={busy || status?.browser.session?.status !== 'active'} aria-label="Refresh browser screenshot" onClick={() => void perform(async () => { await refreshScreenshot(); })}><RefreshCw size={16} /></button></form>{status?.browser.session && <div className="computer-browser-meta"><span>{status.browser.session.title || status.browser.session.url}</span><button className="computer-secondary" disabled={busy} onClick={() => void perform(async () => { await action('browser-close'); clearImage(); setPageRead(undefined); await loadStatus(); })}>Close browser</button></div>}{screenshot ? <button className="computer-screen" aria-label="Browser screenshot, click to interact" disabled={busy} onClick={clickScreenshot}><img src={screenshot} alt="Current browser page" draggable={false} /></button> : <div className="computer-screen-empty"><Monitor size={32} /><p>{status?.browser.session ? 'Refresh the screenshot to see the current page.' : 'Open a public website to begin.'}</p></div>}<p className="computer-help">Click the screenshot to interact. Use the controls below to type, press keys, or scroll the shared browser.</p><form className="computer-address" onSubmit={e => { e.preventDefault(); void perform(async () => { await controlBrowser({ type: 'type', text: inputText }); setInputText(''); }); }}><label className="computer-grow">Text to type<input value={inputText} onChange={e => setInputText(e.target.value)} /></label><button disabled={busy || status?.browser.session?.status !== 'active' || !inputText}>Type text</button></form><div className="computer-browser-controls"><label>Browser key<select value={key} onChange={e => setKey(e.target.value)}>{['Enter', 'Tab', 'Escape', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map(name => <option key={name}>{name}</option>)}</select></label><button className="computer-secondary" disabled={busy || status?.browser.session?.status !== 'active'} onClick={() => void perform(async () => { await controlBrowser({ type: 'key', key }); })}>Press key</button><button className="computer-secondary" disabled={busy || status?.browser.session?.status !== 'active'} onClick={() => void perform(async () => { await controlBrowser({ type: 'scroll', deltaY: -600 }); })}>Scroll up</button><button className="computer-secondary" disabled={busy || status?.browser.session?.status !== 'active'} onClick={() => void perform(async () => { await controlBrowser({ type: 'scroll', deltaY: 600 }); })}>Scroll down</button><button className="computer-secondary" disabled={busy || status?.browser.session?.status !== 'active'} onClick={() => void perform(async () => { setPageRead(await action('browser-read')); })}>Read page</button></div>{pageRead && <article className="computer-page-read"><h3>{pageRead.title || 'Page text'}</h3><small>{pageRead.url}</small><pre>{pageRead.text}</pre>{pageRead.truncated && <p>Page text was truncated.</p>}</article>}</>}</>}
      </div>
    </>}
  </section>;
}
