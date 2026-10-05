import React from "react";
import {
  AbsoluteFill,
  Freeze,
  useCurrentFrame,
  type CalculateMetadataFunction,
} from "remotion";
import { z } from "zod";
import { StoryScene } from "./story/StoryPresentation";
import { storySlides, STORY_FPS } from "./story/story-data";
export const slides = storySlides.map((slide) => ({
  ...slide,
  duration: slide.seconds * STORY_FPS,
}));
export const slideDeckSchema = z.object({
  slideNumber: z
    .number()
    .int()
    .min(1)
    .max(slides.length)
    .describe(slides.map((s, i) => `${i + 1}: ${s.title}`).join(" · ")),
  holdSeconds: z
    .number()
    .min(0)
    .max(15)
    .describe("Hold the final state before the selected section loops."),
  showSlideNumber: z.boolean(),
});
export type SlideDeckProps = z.infer<typeof slideDeckSchema>;
export function resolveSlide(props: SlideDeckProps) {
  const index = Math.max(
    0,
    Math.min(slides.length - 1, Math.round(props.slideNumber) - 1),
  );
  return { slide: slides[index], index };
}
export const slideDeckMetadata: CalculateMetadataFunction<SlideDeckProps> = ({
  props,
}) => ({
  durationInFrames:
    resolveSlide(props).slide.duration +
    Math.round(props.holdSeconds * STORY_FPS),
});
export function SlideDeck(props: SlideDeckProps) {
  const frame = useCurrentFrame();
  const { slide, index } = resolveSlide(props);
  return (
    <AbsoluteFill>
      <Freeze frame={Math.min(frame, slide.duration - 1)}>
        <StoryScene id={slide.id} />
      </Freeze>
      {props.showSlideNumber && (
        <div
          style={{
            position: "absolute",
            right: 24,
            bottom: 8,
            color: "#71806a",
            fontFamily: "Arial",
            fontSize: 16,
            background: "#f8f8eee6",
            padding: "3px 8px",
            borderRadius: 6,
          }}
        >
          {index + 1} / {slides.length}
        </div>
      )}
    </AbsoluteFill>
  );
}
