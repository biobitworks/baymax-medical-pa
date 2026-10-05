import React from 'react';
import {AbsoluteFill, Freeze, Sequence, useCurrentFrame} from 'remotion';
import {DemoChapter, Opening, scenes} from './LaunchVideo';

// Short highlights using each chapter's local timeline, at native 30 fps.
export const README_HERO_FRAMES = 540;
const HeroExcerpt: React.FC<{id: string; start: number}> = ({id, start}) => {
  const frame = useCurrentFrame();
  const index = scenes.findIndex(scene => scene.id === id);
  return <Freeze frame={start + frame}>{id === 'intro' ? <Opening/> : <DemoChapter scene={scenes[index]} index={index}/>}</Freeze>;
};
export const ReadmeHero: React.FC = () => (
  <AbsoluteFill>
    {[{id: 'intro', from: 0, start: 10, length: 75},
      {id: 'care', from: 75, start: 15, length: 150},
      {id: 'reminders', from: 225, start: 30, length: 150},
      {id: 'prescription', from: 375, start: 15, length: 165}]
      .map(({id, from, start, length}) => <Sequence key={id} from={from} durationInFrames={length}>
        <HeroExcerpt id={id} start={start}/>
      </Sequence>)}
  </AbsoluteFill>
);
