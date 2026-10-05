import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Cue, InteractionProvider} from './Interaction';
import {MascotSprite} from './MascotSprite';
import './computer-demo.css';

// One shared schedule controls navigation, handoff, editing, and cursor cues.
export const computerTiming = {
  send: 30, browse: 60, terminal: 155, written: 220, files: 245,
  takeOver: 325, userControl: 335, edit: 360, save: 408, returnControl: 460,
};
const t = computerTiming;
const actions = {'Send request': t.send, Terminal: t.terminal, Files: t.files,
  'Take over': t.takeOver, 'Edit note': t.edit, 'Save file': t.save, 'Return control': t.returnControl};
const request = 'Find a doctor-visit checklist and save a note I can edit.';
const extraNote = 'Ask when to schedule my follow-up.';
const note = '# My doctor visit\n\n- Bring my medication list\n- Note my symptoms\n- Write down my questions';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

function ToolIcon({kind}: {kind: 'Browser' | 'Terminal' | 'Files'}) {
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'Browser' ? <><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5"/></> : kind === 'Terminal' ? <><path d="m4 5 6 7-6 7M13 19h7"/></> : <path d="M3 7V5h6l2 3h10v12H3Z"/>}
  </svg>;
}

export function ComputerDemo() {
  const f = useCurrentFrame();
  const tab = f < t.terminal + 4 ? 'Browser' : f < t.files + 4 ? 'Terminal' : 'Files';
  const manual = f >= t.userControl && f < t.returnControl + 5;
  const settling = f >= t.takeOver && f < t.userControl;
  const saved = f >= t.save + 5;
  const addition = extraNote.slice(0, Math.max(0, Math.floor((f - t.edit) * 1.2)));
  const enter = interpolate(f, [0, 12], [0, 1], clamp);

  return <InteractionProvider scene="computer" step={0} frame={f} actions={actions}>
    <div className="shared-demo" style={{opacity: enter}}>
      <header className="shared-headline"><div className="scene-kicker">BAYMAX’S COMPUTER</div><h2>A little help. You stay in control.</h2></header>
      <div className="shared-layout">
        <aside className="shared-chat">
          <div className="shared-chat-brand"><MascotSprite size={72}/><strong>Baymax</strong></div>
          {f >= t.send + 4 && <div className="shared-request">{request}</div>}
          {f >= t.browse && <div className="shared-answer">I’ll find a useful guide and prepare your visit note.</div>}
          {f >= t.written && <div className="shared-artifact"><ToolIcon kind="Files"/><div><strong>visit-notes.txt</strong><span>Saved in your workspace</span></div></div>}
          {f >= t.files + 4 && <p className="shared-review-prompt">Take over to add anything you want to discuss.</p>}
          {f >= t.returnControl + 5 && <div className="shared-done">✓ Your updated note is saved.</div>}
          <div className="shared-composer"><span>{f < t.send + 4 ? request.slice(0, Math.floor(f * 2.1)) : 'Tell Baymax what you need…'}</span><button aria-label="Send request">↑<Cue id="Send request"/></button></div>
        </aside>
        <section className="shared-workspace">
          <div className="shared-workspace-label"><ToolIcon kind="Browser"/>Baymax’s computer <span>Session unlocked</span></div>
          <div className="shared-frame">
            <div className="shared-window">
              <div className="shared-window-bar"><div className="shared-window-dots"><i/><i/><i/></div><span>{tab === 'Browser' ? 'medlineplus.gov' : tab === 'Terminal' ? 'Terminal · /workspace' : '/workspace/visit-notes.txt'}</span></div>
              {tab === 'Browser' && (f < t.browse ? <div className="shared-welcome"><MascotSprite size={180}/><h3>A space to work together.</h3><p>Browser. Terminal. Files.</p></div> : <div className="shared-webpage"><div className="shared-web-source">MedlinePlus <span>Health information</span></div><h3>Talking With<br/>Your Doctor</h3><p>Get ready for your appointment.</p><ul><li>List your medicines and allergies.</li><li>Describe symptoms and changes.</li><li>Bring questions you want to ask.</li></ul><small>medlineplus.gov/talkingwithyourdoctor.html</small></div>)}
              {tab === 'Terminal' && <div className="shared-terminal"><div className="shared-terminal-label">COMMAND HISTORY <span>{f >= t.written ? 'Exit 0' : 'Running'}</span></div><pre>{'$ cat > visit-notes.txt <<\'NOTE\'\n' + note + '\nNOTE'}</pre>{f >= t.written && <p>✓ /workspace/visit-notes.txt</p>}</div>}
              {tab === 'Files' && <div className="shared-files"><div className="shared-file-title"><ToolIcon kind="Files"/><strong>visit-notes.txt</strong><span>{saved ? 'Saved' : manual ? 'Editing' : 'Read only'}</span></div><div className={`shared-note ${manual ? 'is-editable' : ''}`}><pre>{note}{addition && '\n- ' + addition}</pre>{manual && !saved && <Cue id="Edit note"/>}</div><div className="shared-file-footer"><span>{saved ? 'All changes saved' : 'Your appointment checklist'}</span><button disabled={!manual} className={saved ? 'is-saved' : ''}>Save file<Cue id="Save file"/></button></div></div>}
            </div>
            <nav className="shared-dock">{(['Browser', 'Terminal', 'Files'] as const).map(kind => <button key={kind} className={tab === kind ? 'is-active' : ''}><ToolIcon kind={kind}/>{kind}<Cue id={kind}/></button>)}</nav>
          </div>
          <div className={`shared-handoff ${manual ? 'is-manual' : ''}`}><span><i/>{settling ? 'Finishing handoff…' : manual ? 'You have control' : 'Baymax has control'}</span><button>{manual ? 'Return control' : 'Take over'}<Cue id={manual ? 'Return control' : 'Take over'}/></button></div>
        </section>
      </div>
    </div>
  </InteractionProvider>;
}
