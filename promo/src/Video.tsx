import React from "react";
import { Sequence } from "remotion";
import { Intro } from "./scenes/Intro";
import { SkillShowcase } from "./scenes/SkillShowcase";
import { CliDemo } from "./scenes/CliDemo";
import { Platforms } from "./scenes/Platforms";
import { CallToAction } from "./scenes/CallToAction";

// 30fps, 900 frames = 30 seconds
// Scene 1: Intro       0-150   (5s)
// Scene 2: Skills    150-390   (8s)
// Scene 3: CLI       390-600   (7s)
// Scene 4: Platforms 600-750   (5s)
// Scene 5: CTA       750-900   (5s)

export const Video: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={150}>
      <Intro />
    </Sequence>
    <Sequence from={150} durationInFrames={240}>
      <SkillShowcase />
    </Sequence>
    <Sequence from={390} durationInFrames={210}>
      <CliDemo />
    </Sequence>
    <Sequence from={600} durationInFrames={150}>
      <Platforms />
    </Sequence>
    <Sequence from={750} durationInFrames={150}>
      <CallToAction />
    </Sequence>
  </>
);
