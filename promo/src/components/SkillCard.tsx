import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO, SANS } from "../styles/fonts";
import { TEXT } from "../styles/colors";
import type { SkillData } from "../data/skills";
import { CATEGORY_COLORS } from "../data/skills";

type SkillCardProps = {
  skill: SkillData;
  delay: number;
};

export const SkillCard: React.FC<SkillCardProps> = ({ skill, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const categoryColor = CATEGORY_COLORS[skill.category] || TEXT;

  return (
    <div
      style={{
        opacity: progress,
        transform: `scale(${progress}) translateY(${(1 - progress) * 20}px)`,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "12px 16px",
        border: `1px solid rgba(255,255,255,0.1)`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 14,
          color: TEXT,
          fontWeight: 600,
        }}
      >
        {skill.name}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 11,
          color: categoryColor,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {skill.category}
      </div>
    </div>
  );
};
