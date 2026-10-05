import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { DailyScene, TravelScene, BriefScene } from "./CareScenes";
import { ComputerScene } from "./ComputerScene";
import { HookScene, EngineeringScene, CloseScene } from "./TitleScenes";
import { STORY_FPS, storySlides, type StoryId } from "./story-data";
import "./story.css";
export function StoryScene({ id }: { id: StoryId }) {
  const s = useCurrentFrame() / STORY_FPS;
  const components = {
    hook: HookScene,
    daily: DailyScene,
    travel: TravelScene,
    brief: BriefScene,
    computer: ComputerScene,
    engineering: EngineeringScene,
    close: CloseScene,
  };
  const Scene = components[id];
  return (
    <AbsoluteFill className="baymax-story">
      <Scene seconds={s} />
    </AbsoluteFill>
  );
}
export function StoryPresentation() {
  let start = 0;
  return (
    <AbsoluteFill>
      {storySlides.map((slide) => {
        const from = start;
        start += slide.seconds * STORY_FPS;
        return (
          <Sequence
            key={slide.id}
            from={from}
            durationInFrames={slide.seconds * STORY_FPS}
            name={slide.title}
          >
            <StoryScene id={slide.id} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
