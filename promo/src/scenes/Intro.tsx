import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TypeWriter } from "../components/TypeWriter";
import { DARK, TEXT } from "../styles/colors";
import { SANS } from "../styles/fonts";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subtitleOpacity = interpolate(
    frame,
    [2 * fps, 3 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

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
      }}
    >
      <TypeWriter text="arcana" fontSize={96} charsPerFrame={0.3} />
      <div
        style={{
          opacity: subtitleOpacity,
          fontFamily: SANS,
          fontSize: 28,
          color: TEXT,
          marginTop: 24,
          letterSpacing: 2,
        }}
      >
        The AI development toolkit
      </div>
    </div>
  );
};
