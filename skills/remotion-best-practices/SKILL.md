---
name: remotion-best-practices
description: Video creation in React using Remotion. Covers animations, compositions, audio sync, text effects, 3D integration with Three.js, and rendering. Use when building dynamic video generators, editing timelines, or optimizing Remotion renders.
metadata:
  tags: remotion, video, react, animation, composition
---

You are a Remotion expert. All animations must be frame-driven via `useCurrentFrame()`. CSS transitions and Tailwind animation classes are FORBIDDEN in Remotion, they will not render correctly.

## When to use

- Building programmatic videos with React
- Creating animated intros, demos, promo videos
- Generating data-driven video content
- Working with captions, charts, or text animations

## Core Pattern

Every Remotion component follows this structure:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const MyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const opacity = interpolate(frame, [0, 1.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = spring({ frame, fps, config: { damping: 12 } });

  return (
    <div style={{ opacity, transform: `scale(${scale})` }}>
      Content here
    </div>
  );
};
```

**Always use seconds * fps**, never raw frame numbers:
```tsx
// BAD
const opacity = interpolate(frame, [0, 45], [0, 1]);

// GOOD
const opacity = interpolate(frame, [0, 1.5 * fps], [0, 1]);
```

## Composition Setup

```tsx
// src/Root.tsx
import { Composition } from "remotion";
import { MyVideo, MyVideoProps } from "./MyVideo";

export const RemotionRoot = () => (
  <Composition
    id="MyVideo"
    component={MyVideo}
    durationInFrames={30 * 30} // 30s at 30fps
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ title: "Demo" } satisfies MyVideoProps}
  />
);
```

Use `type` for props (not `interface`) to ensure `defaultProps` type safety.

## Sequencing Scenes

```tsx
import { Sequence } from "remotion";

export const MyVideo: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={150}>
      <Intro />
    </Sequence>
    <Sequence from={150} durationInFrames={240}>
      <MainContent />
    </Sequence>
    <Sequence from={390} durationInFrames={150}>
      <Outro />
    </Sequence>
  </>
);
```

Inside each `<Sequence>`, `useCurrentFrame()` resets to 0. Design components to start at frame 0.

## Animation Patterns

**Spring** (natural motion, 0 to 1):
```tsx
const scale = spring({ frame, fps, config: { mass: 1, damping: 10, stiffness: 100 } });
```

**Interpolate** (map frame range to value range):
```tsx
const translateY = interpolate(frame, [0, 2 * fps], [50, 0], {
  extrapolateRight: "clamp",
  easing: Easing.out(Easing.cubic),
});
```

**Staggered items:**
```tsx
{items.map((item, i) => {
  const delay = i * 5; // 5 frame stagger
  const progress = spring({ frame: frame - delay, fps });
  return (
    <div key={i} style={{ opacity: progress, transform: `translateY(${(1 - progress) * 20}px)` }}>
      {item}
    </div>
  );
})}
```

## Audio

```tsx
import { Audio, interpolate } from "remotion";
import { staticFile } from "remotion";

<Audio
  src={staticFile("music.mp3")}
  startFrom={30}           // trim start (frames)
  endAt={300}              // trim end (frames)
  volume={(f) =>
    interpolate(f, [0, 30], [0, 1], { extrapolateRight: "clamp" })
  }
/>
```

## Assets

Always use `staticFile()` for local assets in `public/`:
```tsx
// BAD
<Img src="/logo.png" />

// GOOD
import { staticFile } from "remotion";
<Img src={staticFile("logo.png")} />
```

For Google Fonts:
```tsx
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont();
```

## Anti-patterns

BAD:
```tsx
// CSS transition (won't render in video)
<div style={{ transition: "opacity 0.3s" }}>

// Tailwind animate class (won't render)
<div className="animate-bounce">

// Raw frame numbers (unreadable)
const x = interpolate(frame, [0, 90], [0, 100]);

// useEffect for animation (breaks determinism)
useEffect(() => { setOpacity(1); }, []);
```

GOOD:
```tsx
// Frame-driven opacity
const opacity = interpolate(frame, [0, 3 * fps], [0, 1], {
  extrapolateRight: "clamp",
});

// Spring for natural motion
const scale = spring({ frame, fps });

// All state derived from frame, never useState for animation
```

## Rendering

```bash
# Preview
npx remotion preview

# Render to MP4
npx remotion render MyVideo out/video.mp4

# Render specific frames
npx remotion render MyVideo --frames=0-150 out/preview.mp4

# Render as GIF
npx remotion render MyVideo out/video.gif --image-format=png
```

## Deep Dive References

For detailed patterns, load the relevant rule file:

| Topic | File |
|-------|------|
| Compositions, stills, folders | [rules/compositions.md](rules/compositions.md) |
| Interpolation and springs | [rules/timing.md](rules/timing.md) |
| Scene transitions | [rules/transitions.md](rules/transitions.md) |
| Text animations | [rules/text-animations.md](rules/text-animations.md) |
| Captions and subtitles | [rules/subtitles.md](rules/subtitles.md) |
| Charts and data viz | [rules/charts.md](rules/charts.md) |
| 3D with Three.js | [rules/3d.md](rules/3d.md) |
| Video embedding | [rules/videos.md](rules/videos.md) |
| Audio and sound | [rules/audio.md](rules/audio.md) |
| Parametrizable videos (Zod) | [rules/parameters.md](rules/parameters.md) |
| TailwindCSS setup | [rules/tailwind.md](rules/tailwind.md) |
| Maps (Mapbox) | [rules/maps.md](rules/maps.md) |
| Transparent video export | [rules/transparent-videos.md](rules/transparent-videos.md) |
