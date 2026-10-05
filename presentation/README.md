# Baymax — A little care, every day.

A three-minute, component-driven presentation with **full application mockups**,
including the navigation, conversation history, tool results, composer, profile,
and shared computer. All records and tool results in the deck are illustrative.
The deck does not call the live backend, send orders, generate real patient PDFs,
or send documents. The actual app is separate at `http://127.0.0.1:5184/`.

## Present in the browser

```bash
cd presentation
npm ci
npm run build:slides
```

Open `out/baymax-slides.html` in a browser. The single HTML file includes its
JavaScript, styles, mascot sprites and product images. It can be copied to another
computer and used offline. Rebuild after changing the presentation source.

For a local HTTP preview:

```bash
python3 -m http.server 3101 --directory out
```

Open `http://localhost:3101/baymax-slides.html`.

- The section picker and **← / →** choose one of seven sections.
- Each section plays at its scripted pace and loops until you advance.
- **Pause / Space** pauses or resumes; **Replay** restarts the section.
- The named action buttons jump to that moment and pause for inspection.
- **Narration / N** shows the supplied spoken script in large type, with screen actions in green.
- **Fullscreen / F** enters fullscreen; Escape exits.
- **Hide controls / H** hides the toolbar and notes for an unobstructed stage.
- `#slide=3` opens directly at Travel and medication.

The continuous `Baymax-Launch` Studio composition is exactly **180 seconds**.
Manual slide mode does not auto-advance; transitions and rehearsal pauses are
controlled by the presenter. No spoken audio has been synthesized.

## Story and timing

| Time | Section | Screen action |
| --- | --- | --- |
| 0:00–0:25 | Hook | Scattered records → travel context → Baymax title |
| 0:25–0:55 | Daily care | Today → Low → Save check-in → “How was my week?” → four health cards |
| 0:55–1:25 | Travel and medication | Sydney refill request → recorded metformin → unverified purchase plan → review |
| 1:25–1:50 | Doctor brief | Request a brief → medications, allergies, labs → edit a line → reviewed PDF state |
| 1:50–2:10 | Shared computer | Files → read doctor-visit.md → prepare visit-summary.md → take over → return control |
| 2:10–2:50 | Engineering | Mastra + Assistant UI → Neon + model routing → Exa + Apple Health → user review |
| 2:50–3:00 | Close | Installed-app mockup + reminder concept → Baymax and GitHub link |

The complete narration, timings and rehearsal beats live in
`src/story/story-data.ts`. All seven sections share the same data in Studio and
in the browser.

## Studio and source

```bash
npm run studio     # http://localhost:3100
npm run typecheck
```

- `Baymax-Slides`: select `slideNumber` 1–7 in Studio props; optional final-state hold.
- `Baymax-Launch`: the continuous three-minute story.
- `Story-Sections`: individual full-length sections for inspection.
- `Baymax-Readme-Hero`: the earlier 18-second README highlight composition.

Key files:

- `src/story/AppShell.tsx`: shared full-app navigation, chat and status UI.
- `src/story/CareScenes.tsx`: Today, weekly summary, refill review and doctor brief.
- `src/story/ComputerScene.tsx`: chat, files, terminal and control handoff.
- `src/story/TitleScenes.tsx`: hook, architecture, mobile concept and closing card.
- `src/story/StoryPresentation.tsx`: section and continuous composition.
- `src/BrowserSlides.tsx`: keyboard navigation, playback and narration controls.
- `scripts/build-slides.mjs`: self-contained HTML build.

## Demo boundaries

Use fictional records. Sample readings are labeled and missing sleep data stays
unknown. The Sydney pharmacy and price are illustrative; availability and
prescription requirements remain unverified. The shopping flow stops at purchase
preparation, without prescribing, substitution or an order. The brief and files
show simulated completion states; a user chooses recipients and sends documents
outside this mockup. The mobile reminder is a concept, not live push delivery.

Live Exa research in the actual app requires working authentication. The
engineering section follows the supplied narration: OpenAI directly in this
setup, Neon AI Gateway as another supported route, opted-in Neon persistence,
and an Apple Health Shortcut with a token-authenticated endpoint, hashed token
storage, and deduplication. The deck itself performs none of those integrations.

## README hero GIF

The existing hero has its own editable source in `src/ReadmeHero.tsx`.
To refresh it from this folder:

```bash
npx remotion render src/index.ts Baymax-Readme-Hero /tmp/baymax-readme-hero.mp4 --scale=0.5
ffmpeg -y -i /tmp/baymax-readme-hero.mp4 -filter_complex '[0:v]fps=12,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4' -loop 0 ../docs/media/baymax-hero.gif
```
