# Care companion sprite assets

Original ivory-and-sage care robot, generated with built-in image generation using the asset-first workflow from [Agent Sprite Forge](https://github.com/0x0funky/agent-sprite-forge).

Three separate six-pose sheets: idle, greeting, thinking. Each uses the same scale profile, transparent background, 224px square canvas, and sole-based horizontal alignment. The app displays a one-shot greeting, idle breath/blink, held thinking pose, then authored recovery frames. Reduced motion uses a still frame. Hidden elements pause playback.

`public/mascot/qc.json` records strict processor checks. All 18 frames passed; no empty, edge-touching, or clamped frames. Cross-action measured scale drift was 4.5% for greeting and 3.3% for thinking, within the 8% gate. These are stylized pose animations, not interpolated 60-fps character rigs.

`design/baymax-sprite-preview.gif` shows the artwork at presentation size and 78px header size. The original procedural SVG preview is superseded.

Validation: frontend TypeScript and production Vite build. Full-project typechecking is separately blocked by unavailable Mastra dependencies in this workspace. Live browser integration has not been verified in this restricted session.
