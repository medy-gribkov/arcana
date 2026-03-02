import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { DARK, AMBER, TEXT, DIM } from "../styles/colors";
import { MONO, SANS } from "../styles/fonts";

export const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const installOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const urlOpacity = interpolate(frame, [1 * fps, 1.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const logoOpacity = interpolate(frame, [2 * fps, 2.8 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const madeWithOpacity = interpolate(frame, [3.2 * fps, 4 * fps], [0, 1], {
    extrapolateRight: "clamp",
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
        gap: 24,
      }}
    >
      <div
        style={{
          opacity: installOpacity,
          fontFamily: MONO,
          fontSize: 24,
          color: TEXT,
          backgroundColor: "rgba(255,255,255,0.06)",
          padding: "16px 32px",
          borderRadius: 8,
          border: `1px solid ${AMBER}`,
        }}
      >
        npm i -g @sporesec/arcana
      </div>

      <div
        style={{
          opacity: urlOpacity,
          fontFamily: SANS,
          fontSize: 18,
          color: DIM,
        }}
      >
        github.com/medy-gribkov/arcana
      </div>

      <div
        style={{
          opacity: logoOpacity,
          fontFamily: MONO,
          fontSize: 48,
          fontWeight: 700,
          color: AMBER,
          marginTop: 12,
          textShadow: "0 0 30px rgba(212,148,58,0.3)",
        }}
      >
        arcana
      </div>

      {/* Self-referential tagline */}
      <div
        style={{
          opacity: madeWithOpacity,
          fontFamily: SANS,
          fontSize: 14,
          color: DIM,
          marginTop: 16,
          letterSpacing: 1,
          textAlign: "center",
        }}
      >
        This video was built with arcana + remotion-best-practices
      </div>
    </div>
  );
};
