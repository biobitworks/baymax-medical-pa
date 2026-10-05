import React from "react";
import { Composition, Folder } from "remotion";
import { StoryPresentation, StoryScene } from "./story/StoryPresentation";
import { STORY_DURATION, STORY_FPS, storySlides } from "./story/story-data";
import { ReadmeHero, README_HERO_FRAMES } from "./ReadmeHero";
import { SlideDeck, slideDeckSchema, slideDeckMetadata } from "./SlideDeck";
export const VideoRoot: React.FC = () => (
  <>
    <Composition
      id="Baymax-Slides"
      component={SlideDeck}
      schema={slideDeckSchema}
      defaultProps={{ slideNumber: 1, holdSeconds: 0, showSlideNumber: false }}
      calculateMetadata={slideDeckMetadata}
      durationInFrames={750}
      fps={STORY_FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Baymax-Launch"
      component={StoryPresentation}
      durationInFrames={STORY_DURATION}
      fps={STORY_FPS}
      width={1920}
      height={1080}
    />
    <Folder name="Story-Sections">
      {storySlides.map((slide, index) => (
        <Composition
          key={slide.id}
          id={`${String(index + 1).padStart(2, "0")}-${slide.id}`}
          component={StoryScene}
          defaultProps={{ id: slide.id }}
          durationInFrames={slide.seconds * STORY_FPS}
          fps={STORY_FPS}
          width={1920}
          height={1080}
        />
      ))}
    </Folder>
    <Composition
      id="Baymax-Readme-Hero"
      component={ReadmeHero}
      durationInFrames={README_HERO_FRAMES}
      fps={STORY_FPS}
      width={1920}
      height={1080}
    />
  </>
);
