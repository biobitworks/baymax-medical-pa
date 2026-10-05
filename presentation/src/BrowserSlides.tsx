import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { SlideDeck, slides } from "./SlideDeck";
import { STORY_FPS as FPS } from "./story/story-data";
import "./browser-slides.css";
const readSlide = () => {
  const value = Number(location.hash.replace("#slide=", ""));
  return Number.isInteger(value) && value >= 1 && value <= slides.length
    ? value
    : 1;
};
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function BrowserSlides() {
  const [slide, setSlide] = useState(readSlide),
    [playing, setPlaying] = useState(true),
    [hidden, setHidden] = useState(false),
    [notes, setNotes] = useState(false),
    [frame, setFrame] = useState(0);
  const player = useRef<PlayerRef>(null),
    current = slides[slide - 1];
  const go = (value: number) => {
    const next = Math.max(1, Math.min(slides.length, value));
    location.hash = `slide=${next}`;
    setSlide(next);
  };
  const seek = (second: number) => {
    player.current?.pause();
    player.current?.seekTo(second * FPS);
    setFrame(second * FPS);
  };
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  useEffect(() => {
    const hash = () => setSlide(readSlide());
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    setFrame(0);
    setPlaying(true);
    const update = (event: { detail: { frame: number } }) =>
        setFrame(event.detail.frame),
      play = () => setPlaying(true),
      pause = () => setPlaying(false);
    p.addEventListener("frameupdate", update);
    p.addEventListener("play", play);
    p.addEventListener("pause", pause);
    return () => {
      p.removeEventListener("frameupdate", update);
      p.removeEventListener("play", play);
      p.removeEventListener("pause", pause);
    };
  }, [slide]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName))
      )
        return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === " " && event.target instanceof HTMLButtonElement)
        return;
      const actions: Record<string, () => void> = {
        ArrowRight: () => go(slide + 1),
        PageDown: () => go(slide + 1),
        ArrowLeft: () => go(slide - 1),
        PageUp: () => go(slide - 1),
        Home: () => go(1),
        End: () => go(slides.length),
        " ": () => player.current?.toggle(),
        f: fullscreen,
        h: () => setHidden((v) => !v),
        n: () => setNotes((v) => !v),
      };
      if (actions[event.key]) {
        event.preventDefault();
        actions[event.key]();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [slide]);
  const activeBeat = current.beats.reduce(
    (index, beat, i) => (frame >= beat.second * FPS ? i : index),
    0,
  );
  return (
    <main className={`browser-deck ${notes && !hidden ? "with-notes" : ""}`}>
      <div className="slide-stage">
        <Player
          key={slide}
          ref={player}
          component={SlideDeck}
          inputProps={{
            slideNumber: slide,
            holdSeconds: 0,
            showSlideNumber: false,
          }}
          durationInFrames={current.duration}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={FPS}
          autoPlay
          loop
          controls={false}
          clickToPlay={false}
          style={{ width: "100%" }}
        />
      </div>
      {notes && !hidden && (
        <aside className="presenter-notes" aria-label="Presenter notes">
          <div className="notes-heading">
            <span>{current.time}</span>
            <strong>{current.title}</strong>
            <button onClick={() => setNotes(false)} aria-label="Close notes">
              ×
            </button>
          </div>
          <div className="notes-scroll">
            <p className="notes-action">{current.action}</p>
            {current.narration.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <small>
              Use fictional records. Live research requires working Exa
              authentication. This presentation uses deterministic mock results.
            </small>
          </div>
        </aside>
      )}
      <nav
        className={`presenter-controls ${hidden ? "controls-hidden" : ""}`}
        aria-label="Presentation controls"
      >
        <div className="presenter-row">
          <button
            onClick={() => go(slide - 1)}
            disabled={slide === 1}
            aria-label="Previous slide"
          >
            ←
          </button>
          <label>
            Section{" "}
            <select
              aria-label="Slide number"
              value={slide}
              onChange={(event) => go(Number(event.target.value))}
            >
              {slides.map((item, index) => (
                <option key={item.id} value={index + 1}>
                  {index + 1}. {item.title} · {item.time}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => go(slide + 1)}
            disabled={slide === slides.length}
            aria-label="Next slide"
          >
            →
          </button>
          <button onClick={() => player.current?.toggle()}>
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => {
              player.current?.seekTo(0);
              player.current?.play();
            }}
          >
            Replay
          </button>
          <button onClick={() => setNotes((v) => !v)} aria-pressed={notes}>
            Narration
          </button>
          <button onClick={fullscreen}>Fullscreen</button>
          <button onClick={() => setHidden(true)}>Hide controls</button>
        </div>
        <div className="presenter-beats">
          {current.beats.map((beat, i) => (
            <button
              key={beat.label}
              className={i === activeBeat ? "active" : ""}
              onClick={() => seek(beat.second)}
            >
              {beat.label}
            </button>
          ))}
          <span>
            {clock(frame / FPS)} / {clock(current.seconds)}
          </span>
        </div>
        <small>
          ← → sections · Space pause · N narration · F fullscreen · H controls ·
          Each section loops until you advance
        </small>
      </nav>
      {hidden && (
        <button
          className="show-controls"
          onClick={() => setHidden(false)}
          aria-label="Show presentation controls"
        >
          Controls
        </button>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<BrowserSlides />);
