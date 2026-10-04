import { createContext, useContext, useEffect, useRef, useState } from "react";

export const MascotActivity = createContext({ responding: false, setResponding: (_: boolean) => {} });
type Action = "idle" | "greeting" | "thinking";
type Phase = Action | "settling";
type Frame = { action: Action; index: number };
const sequences: Record<Phase, { frames: number[]; durations: number[]; action: Action }> = {
  idle: { action: "idle", frames: [0,1,2,3,4,5], durations: [1300,240,240,110,240,1100] },
  greeting: { action: "greeting", frames: [0,1,2,3,4,5], durations: [300,130,180,220,160,300] },
  thinking: { action: "thinking", frames: [0,1,2,3,2], durations: [180,150,1400,110,1400] },
  settling: { action: "thinking", frames: [4,5], durations: [150,200] },
};
let assetLoad: Promise<void> | undefined;
function preload() {
  return assetLoad ??= Promise.all((Object.keys(sequences).filter(k=>k!=="settling") as Action[]).map(action =>
    new Promise<void>(resolve => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = `/mascot/${action}.webp`;
    }),
  )).then(()=>{});
}

/** Artwork is image-generated; code only selects finished, aligned sprite frames. */
export default function Mascot({ small = false }: { small?: boolean }) {
  const { responding } = useContext(MascotActivity);
  const active = useRef(responding);
  active.current = responding;
  const element = useRef<HTMLSpanElement>(null);
  const wake = useRef<() => void>(() => {});
  useEffect(() => { wake.current(); }, [responding]);
  const [frame, setFrame] = useState<Frame>({ action: "idle", index: 0 });
  useEffect(() => {
    let disposed = false, visible = true, timer: ReturnType<typeof setTimeout>;
    let phase: Phase = "greeting", cursor = 0;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; });
    if (element.current) observer.observe(element.current);
    const tick = () => {
      if (disposed) return;
      if (preference.matches) { setFrame({ action: "idle", index: 0 }); return; }
      if (document.hidden || !visible) { timer = setTimeout(tick, 250); return; }
      // Move through authored recovery frames instead of changing sheets mid-pose.
      if (phase === "thinking" && !active.current) { phase = "settling"; cursor = 0; }
      if (phase === "idle" && active.current) { phase = "thinking"; cursor = 0; }
      const sequence = sequences[phase];
      setFrame({ action: sequence.action, index: sequence.frames[cursor] });
      const duration = sequence.durations[cursor];
      cursor++;
      if (cursor >= sequence.frames.length) {
        cursor = 0;
        if (phase === "thinking" && active.current) cursor = 2; // Hold the thoughtful pose with an occasional blink.
        else if (phase === "greeting" || phase === "settling") phase = active.current ? "thinking" : "idle";
      }
      timer = setTimeout(tick, duration);
    };
    wake.current = () => {
      if ((phase === "idle" && active.current) || (phase === "thinking" && !active.current)) { clearTimeout(timer); tick(); }
    };
    const motionChanged = () => { clearTimeout(timer); phase = "idle"; cursor = 0; tick(); };
    preference.addEventListener("change", motionChanged);
    void preload().then(tick);
    return () => { wake.current = () => {}; disposed = true; clearTimeout(timer); observer.disconnect(); preference.removeEventListener("change", motionChanged); };
  }, []);
  return <span ref={element} className={`mascot sprite-mascot ${small ? "small" : ""}`}
    role="img" aria-label="Baymax, your care companion" data-action={frame.action}
    style={{ backgroundImage: `url(/mascot/${frame.action}.webp)`, backgroundPosition: `${(frame.index%3)*50}% ${Math.floor(frame.index/3)*100}%` }} />;
}
