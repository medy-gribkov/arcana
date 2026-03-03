import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SKILLS, TOTAL_SKILLS, CATEGORY_COLORS } from "../data/skills";
import { DARK, AMBER, TEXT } from "../styles/colors";
import { MONO, SANS } from "../styles/fonts";

export const SkillShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const count = Math.min(
    Math.floor(interpolate(frame, [0, 4 * fps], [0, TOTAL_SKILLS], {
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
        padding: "40px 60px",
      }}
    >
      {/* Counter */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: 72,
          fontWeight: 700,
          color: AMBER,
          marginBottom: 2,
          transform: `scale(${headerScale})`,
          textShadow: "0 0 40px rgba(212,148,58,0.3)",
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 18,
          color: TEXT,
          marginBottom: 28,
          opacity: 0.7,
          letterSpacing: 2,
        }}
      >
        battle-tested skills
      </div>

      {/* Grid of all 58 skills */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          justifyContent: "center",
          maxWidth: 1400,
        }}
      >
        {SKILLS.map((skill, i) => {
          const progress = spring({
            frame: frame - i * 1.5,
            fps,
            config: { damping: 14, stiffness: 120 },
          });
          const catColor = CATEGORY_COLORS[skill.category] || TEXT;
          return (
            <div
              key={skill.name}
              style={{
                opacity: progress,
                transform: `scale(${progress})`,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 5,
                padding: "5px 8px",
                borderLeft: `2px solid ${catColor}`,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: TEXT,
                  fontWeight: 500,
                }}
              >
                {skill.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
