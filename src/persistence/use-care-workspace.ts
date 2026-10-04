import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkspace, type CareWorkspace } from '../shared/workspace';
import { persistenceApi, SaveQueue, PersistenceError } from './client';

export function useCareWorkspace() {
  const [workspace, setWorkspace] = useState(createWorkspace);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState('Only for this visit');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const failedAction = useRef<'save' | 'forget' | 'reset'>('save');
  const queue = useRef(new SaveQueue(persistenceApi)).current;
  const latest = useRef(workspace);
  latest.current = workspace;
  const saved = useRef('');
  const paused = useRef(false);
  const reloading = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialLoad = useRef<ReturnType<typeof persistenceApi.load> | undefined>(undefined);

  const acceptLoaded = useCallback((data: Awaited<ReturnType<typeof persistenceApi.load>>) => {
    queue.revision = data.revision;
    const state = data.state ?? createWorkspace();
    saved.current = JSON.stringify(state);
    latest.current = state;
    setWorkspace(state);
    setStatus(state.remember ? 'Saved for your next visit' : 'Only for this visit');
    setError(''); setLoadError(false); setLoading(false);
  }, [queue]);
  useEffect(() => {
    let active = true;
    initialLoad.current ??= persistenceApi.load();
    initialLoad.current.then(data => { if (active) acceptLoaded(data); }).catch(() => {
      if (active) { setLoading(false); setLoadError(true); }
    });
    return () => { active = false; };
  }, [acceptLoaded]);

  const save = useCallback(async (state: CareWorkspace) => {
    setStatus('Saving your changes…');
    try {
      await queue.save(state);
      saved.current = JSON.stringify(state);
      setError('');
      setStatus('Saved for your next visit');
    } catch (failure) {
      failedAction.current = 'save';
      setStatus('Changes not saved');
      setError(failure instanceof PersistenceError ? failure.message : 'Your changes have not been saved. Please try again.');
    }
  }, [queue]);
  useEffect(() => {
    if (loading || loadError || paused.current || !workspace.remember || !workspace.ready || JSON.stringify(workspace) === saved.current) return;
    timer.current = setTimeout(() => { void save(workspace); }, 350);
    return () => { clearTimeout(timer.current); };
  }, [workspace, loading, loadError, save]);
  // Browsers cannot guarantee completion on close. Warn only when consented
  // changes remain unsaved; never copy health data into localStorage.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.remember && JSON.stringify(latest.current) !== saved.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  const setField = useCallback(<K extends keyof CareWorkspace>(field: K, value: CareWorkspace[K] | ((previous: CareWorkspace[K]) => CareWorkspace[K])) => {
    setWorkspace(previous => ({ ...previous, [field]: typeof value === 'function' ? value(previous[field]) : value }));
  }, []);
  const changeMemory = useCallback(async (remember: boolean) => {
    if (remember) { paused.current = false; failedAction.current = 'save'; setField('remember', true); return; }
    paused.current = true; clearTimeout(timer.current); setBusy(true);
    try {
      await queue.remove();
      paused.current = false;
      setField('remember', false);
      saved.current = '';
      setError(''); setStatus('Only for this visit');
    } catch { failedAction.current = 'forget'; setError('Could not delete your saved care space. Please try again.'); }
    finally { setBusy(false); }
  }, [queue, setField]);
  const reset = useCallback(async () => {
    paused.current = true; clearTimeout(timer.current); setBusy(true);
    try {
      // No remote document exists for a user who never enabled memory.
      if (latest.current.remember || queue.revision > 0) await queue.remove();
      const state = createWorkspace();
      latest.current = state; saved.current = JSON.stringify(state); paused.current = false;
      setWorkspace(state); setResetKey(value => value + 1); setError(''); setStatus('Only for this visit');
      return true;
    } catch { failedAction.current = 'reset'; setError('Could not delete your saved care space. Please try again.'); return false; }
    finally { setBusy(false); }
  }, [queue]);
  const retry = useCallback(async () => {
    if (loadError) {
      if (reloading.current) return false;
      reloading.current = true;
      setLoading(true);
      try { acceptLoaded(await persistenceApi.load()); } catch { setLoading(false); }
      finally { reloading.current = false; }
    } else if (failedAction.current === 'forget') await changeMemory(false);
    else if (failedAction.current === 'reset') return reset();
    else { clearTimeout(timer.current); await save(latest.current); }
    return false;
  }, [loadError, acceptLoaded, save, changeMemory, reset]);
  return { workspace, setWorkspace, setField, loading, loadError, status, error, busy, resetKey, changeMemory, reset, retry };
}
