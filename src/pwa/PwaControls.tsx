import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './pwa.css';

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installError, setInstallError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const checkInstalled = () => setInstalled(standalone.matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
      setDismissed(false);
      setInstallError(false);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    checkInstalled();
    standalone.addEventListener('change', checkInstalled);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      standalone.removeEventListener('change', checkInstalled);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => { if (showHelp) dialog.current?.showModal(); }, [showHelp]);

  async function install() {
    if (!installPrompt) { setShowHelp(true); return; }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      setInstallError(true);
    } finally {
      setInstallPrompt(null);
    }
  }

  if (!import.meta.env.PROD) return null;
  return <>
    {needRefresh ? <aside className="pwa-banner" aria-label="Baymax update">
      <p><strong>A fresh Baymax is ready.</strong><br />Updating reloads the app and clears your current session.</p>
      <div className="pwa-actions">
        <button className="pwa-primary" onClick={() => void updateServiceWorker(true)}>Update now</button>
        <button onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    </aside> : !installed && !dismissed && (installPrompt || isIOS) ? <aside className="pwa-banner pwa-install" aria-label="Install Baymax on your device">
      <button className="pwa-primary" onClick={() => void install()}><Download size={16} />Install Baymax</button>
      <button className="pwa-dismiss" aria-label="Dismiss install suggestion" onClick={() => setDismissed(true)}><X size={18} /></button>
    </aside> : null}
    {installError && !dismissed && <aside className="pwa-banner" role="status">
      <p>Installation couldn’t open. Try the install option in your browser’s menu.</p>
      <button onClick={() => { setInstallError(false); setDismissed(true); }}>Dismiss</button>
    </aside>}
    {showHelp && <dialog ref={dialog} className="pwa-dialog" aria-labelledby="pwa-help-title" onCancel={() => setShowHelp(false)}>
      <h2 id="pwa-help-title">Install Baymax</h2>
      <p>In Safari, open the Share menu, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</p>
      <button className="pwa-primary" onClick={() => setShowHelp(false)}>Done</button>
    </dialog>}
  </>;
}
