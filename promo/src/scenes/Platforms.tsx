import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { PLATFORMS } from "../data/skills";
import { DARK, AMBER, TEXT } from "../styles/colors";
import { SANS, MONO } from "../styles/fonts";

export const Platforms: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: DARK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        gap: 20,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 24,
          color: TEXT,
          opacity: 0.6,
          marginBottom: 20,
        }}
      >
        Works everywhere
      </div>
      {PLATFORMS.map((platform, i) => {
        const progress = spring({
          frame: frame - i * 8,
          fps,
          config: { damping: 14 },
        });
        return (
          <div
            key={platform}
            style={{
              fontFamily: MONO,
              fontSize: 32,
              fontWeight: 600,
              color: AMBER,
              opacity: progress,
              transform: `translateX(${(1 - progress) * 100}px)`,
            }}
          >
            {platform}
          </div>
        );
      })}
    </div>
  );
};
