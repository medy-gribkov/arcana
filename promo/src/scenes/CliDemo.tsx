import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { DARK, AMBER, TEXT, DIM, SUCCESS } from "../styles/colors";
import { MONO } from "../styles/fonts";

const BANNER_LINES = [
  " █████╗ ██████╗  ██████╗ █████╗ ███╗   ██╗ █████╗ ",
  "██╔══██╗██╔══██╗██╔════╝██╔══██╗████╗  ██║██╔══██╗",
  "███████║██████╔╝██║     ███████║██╔██╗ ██║███████║",
  "██╔══██║██╔══██╗██║     ██╔══██║██║╚██╗██║██╔══██║",
  "██║  ██║██║  ██║╚██████╗██║  ██║██║ ╚████║██║  ██║",
  "╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝",
];

const AMBER_SHADES = ["#e8a84c", "#d4943a", "#c0842f", "#a87228", "#8f6020", "#755019"];

type Line = {
  text: string;
  color: string;
  delay: number;
  indent?: number;
  isCommand?: boolean;
  isBanner?: boolean;
};

const LINES: Line[] = [
  // Command 1: install --all
  { text: "arcana install --all", color: TEXT, delay: 10, isCommand: true },
  { text: "", color: TEXT, delay: 30 },
  // Banner renders
  ...BANNER_LINES.map((line, i) => ({
    text: line,
    color: AMBER_SHADES[i] || AMBER,
    delay: 35 + i * 3,
    isBanner: true,
  })),
  { text: "", color: TEXT, delay: 56 },
  { text: "◆  Install all skills", color: TEXT, delay: 60 },
  { text: "│", color: DIM, delay: 65 },
  { text: "◇  Fetching medy-gribkov/arcana...", color: DIM, delay: 68 },
  { text: "│", color: DIM, delay: 72 },
  { text: "●  Installing 58 skills ━━━━━━━━━━━━━━━━━━━━ 100%", color: SUCCESS, delay: 76 },
  { text: "│", color: DIM, delay: 95 },
  { text: "│  ✓ golang-pro          ✓ security-review", color: SUCCESS, delay: 98, indent: 0 },
  { text: "│  ✓ typescript          ✓ database-design", color: SUCCESS, delay: 101, indent: 0 },
  { text: "│  ✓ docker-kubernetes   ✓ ci-cd-pipelines", color: SUCCESS, delay: 104, indent: 0 },
  { text: "│  ...and 52 more", color: DIM, delay: 107, indent: 0 },
  { text: "│", color: DIM, delay: 112 },
  { text: "└  Next: arcana doctor", color: AMBER, delay: 115 },
  { text: "", color: TEXT, delay: 125 },
  // Command 2: doctor
  { text: "arcana doctor", color: TEXT, delay: 130, isCommand: true },
  { text: "", color: TEXT, delay: 145 },
  { text: "◆  Environment Health Check", color: TEXT, delay: 148 },
  { text: "│", color: DIM, delay: 152 },
  { text: "│  ✓ Claude Code     detected", color: SUCCESS, delay: 155 },
  { text: "│  ✓ Skills (58)     installed", color: SUCCESS, delay: 160 },
  { text: "│  ✓ Config          valid", color: SUCCESS, delay: 165 },
  { text: "│  ✓ Security        clean", color: SUCCESS, delay: 170 },
  { text: "│  ✓ Lockfile        verified", color: SUCCESS, delay: 175 },
  { text: "│", color: DIM, delay: 180 },
  { text: "└  All checks passed", color: SUCCESS, delay: 183 },
];

export const CliDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: DARK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          opacity,
          backgroundColor: "#1a1a2e",
          borderRadius: 12,
          padding: 28,
          width: 960,
          fontFamily: MONO,
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Title bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#ffbd2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#28c840" }} />
        </div>

        {/* Lines */}
        {LINES.map((line, i) => {
          if (frame < line.delay) return null;
          const lineFrame = frame - line.delay;
          const charsToShow = line.isBanner
            ? line.text.length
            : Math.min(Math.floor(lineFrame * 2), line.text.length);

          return (
            <div key={i} style={{ color: line.color, whiteSpace: "pre" }}>
              {line.isCommand && <span style={{ color: AMBER }}>$ </span>}
              {line.text.slice(0, charsToShow)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
