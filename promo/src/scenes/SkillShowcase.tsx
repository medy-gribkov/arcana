import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SkillCard } from "../components/SkillCard";
import { SKILLS } from "../data/skills";
import { DARK, AMBER, TEXT } from "../styles/colors";
import { MONO, SANS } from "../styles/fonts";

export const SkillShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const count = Math.min(
    Math.floor(interpolate(frame, [0, 5 * fps], [0, 59], {
      extrapolateRight: "clamp",
    })),
    59
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
        padding: 60,
      }}
    >
      {/* Counter */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: 72,
          fontWeight: 700,
          color: AMBER,
          marginBottom: 8,
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 20,
          color: TEXT,
          marginBottom: 40,
          opacity: 0.7,
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
          maxWidth: 1000,
        }}
      >
        {SKILLS.map((skill, i) => (
          <SkillCard key={skill.name} skill={skill} delay={i * 5} />
        ))}
      </div>
    </div>
  );
};
