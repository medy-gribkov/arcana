import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { MONO } from "../styles/fonts";
import { DARK, TEXT, AMBER, DIM, SUCCESS } from "../styles/colors";

type TerminalLine = {
  text: string;
  color?: string;
  delay: number; // frames before this line appears
};

type TerminalProps = {
  lines: TerminalLine[];
  prompt?: string;
};

export const Terminal: React.FC<TerminalProps> = ({
  lines,
  prompt = "$ ",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        backgroundColor: "#1a1a2e",
        borderRadius: 12,
        padding: 32,
        width: 900,
        fontFamily: MONO,
        fontSize: 18,
        lineHeight: 1.8,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#ff5f57" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#ffbd2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#28c840" }} />
      </div>

      {/* Lines */}
      {lines.map((line, i) => {
        if (frame < line.delay) return null;
        const lineFrame = frame - line.delay;
        const charsToShow = Math.min(
          Math.floor(lineFrame * 1.5),
          line.text.length
        );
        const isCommand = line.text.startsWith("arcana") || line.text.startsWith("npm");

        return (
          <div key={i} style={{ color: line.color || TEXT }}>
            {isCommand && (
              <span style={{ color: AMBER }}>{prompt}</span>
            )}
            {line.text.slice(0, charsToShow)}
          </div>
        );
      })}
    </div>
  );
};
