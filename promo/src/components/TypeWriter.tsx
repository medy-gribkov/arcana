import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { MONO } from "../styles/fonts";
import { AMBER } from "../styles/colors";

type TypeWriterProps = {
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
  fontSize?: number;
  color?: string;
};

export const TypeWriter: React.FC<TypeWriterProps> = ({
  text,
  startFrame = 0,
  charsPerFrame = 0.5,
  fontSize = 64,
  color = AMBER,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  const displayText = text.slice(0, charsToShow);
  const showCursor = elapsed % 30 < 20;

  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize,
        fontWeight: 700,
        color,
        whiteSpace: "pre",
      }}
    >
      {displayText}
      {charsToShow < text.length && showCursor && (
        <span style={{ opacity: 0.8 }}>|</span>
      )}
    </div>
  );
};
