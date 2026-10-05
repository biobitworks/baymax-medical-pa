import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import './overview-slides.css';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
function Mark({kind}:{kind:'shield'|'records'|'daily'|'refill'|'travel'|'brief'|'computer'}) {
  const paths = {
    shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
    records: <><path d="M5 3h10l4 4v14H5Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></>,
    daily: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
    refill: <><path d="m8 16 8-8M6 18a6 6 0 0 1 0-8l4-4a6 6 0 0 1 8 8l-4 4a6 6 0 0 1-8 0Z"/></>,
    travel: <><rect x="4" y="7" width="16" height="14" rx="3"/><path d="M8 7V3h8v4M12 11v6M9 14h6"/></>,
    brief: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="m3 6 9 7 9-7"/></>,
    computer: <><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5"/></>,
  };
  return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

export function PrivacySlide() {
  // This slide is mounted within the onboarding chapter after the upload beat.
  const frame = useCurrentFrame() - 200;
  const enter = interpolate(frame,[0,12],[0,1],clamp);
  return <AbsoluteFill className="canvas privacy-slide"><div className="privacy-slide-content" style={{opacity:enter,transform:`translateY(${(1-enter)*18}px)`}}><div className="privacy-symbol"><Mark kind="shield"/></div><div className="scene-kicker">YOUR MEDICAL DATA</div><h1>Your privacy<br/>comes first.</h1><p className="privacy-readiness">Working toward HIPAA readiness.</p><div className="privacy-promises"><span>You choose what to add.</span><span>You review what to share.</span></div><p className="privacy-status">Compliance review and deployment qualification are ongoing.</p></div></AbsoluteFill>;
}
const useCases = [
  {kind:'records',title:'Medical records'},
  {kind:'daily',title:'Daily care & reminders'},
  {kind:'refill',title:'Refills & supplies'},
  {kind:'travel',title:'Travel preparation'},
  {kind:'brief',title:'Doctor-ready briefs'},
  {kind:'computer',title:'A shared computer'},
] as const;
export function UseCasesSlide() {
  const frame = useCurrentFrame();
  return <AbsoluteFill className="canvas usecases-slide"><div className="scene-kicker">ONE PERSONAL MEDICAL AGENT</div><h1>A little help.<br/>Across your care.</h1><div className="usecases-grid">{useCases.map((item,i)=>{
    const enter=interpolate(frame,[i*3,i*3+10],[0,1],clamp);
    return <div className="usecase-tile" key={item.kind} style={{opacity:enter,transform:`translateY(${(1-enter)*14}px)`}}><span><Mark kind={item.kind}/></span><h2>{item.title}</h2></div>;
  })}</div></AbsoluteFill>;
}
