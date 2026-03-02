import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SkillCard } from "../components/SkillCard";
import { SKILLS, TOTAL_SKILLS } from "../data/skills";
import { DARK, AMBER, TEXT } from "../styles/colors";
import { MONO, SANS } from "../styles/fonts";

export const SkillShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const count = Math.min(
    Math.floor(interpolate(frame, [0, 5 * fps], [0, TOTAL_SKILLS], {
      extrapolateRight: "clamp",
    })),
    TOTAL_SKILLS
  );

  const headerScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

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
        padding: 60,
      }}
    >
      {/* Counter */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: 80,
          fontWeight: 700,
          color: AMBER,
          marginBottom: 4,
          transform: `scale(${headerScale})`,
          textShadow: "0 0 40px rgba(212,148,58,0.3)",
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 22,
          color: TEXT,
          marginBottom: 40,
          opacity: 0.7,
          letterSpacing: 2,
        }}
      >
        battle-tested skills
      </div>

      {/* Grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
          maxWidth: 1100,
        }}
      >
        {SKILLS.map((skill, i) => (
          <SkillCard key={skill.name} skill={skill} delay={i * 4} />
        ))}
      </div>
    </div>
  );
};
