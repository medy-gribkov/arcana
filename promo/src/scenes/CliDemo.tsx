import React from "react";
import { Terminal } from "../components/Terminal";
import { DARK } from "../styles/colors";
import { SUCCESS, DIM } from "../styles/colors";

export const CliDemo: React.FC = () => {
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
      <Terminal
        lines={[
          { text: "arcana install --all", delay: 10, color: undefined },
          { text: "Installing 59 skills...", delay: 40, color: DIM },
          { text: "  golang-pro          installed", delay: 60, color: SUCCESS },
          { text: "  security-review     installed", delay: 70, color: SUCCESS },
          { text: "  typescript-advanced  installed", delay: 80, color: SUCCESS },
          { text: "  database-design     installed", delay: 90, color: SUCCESS },
          { text: "  ...and 55 more", delay: 100, color: DIM },
          { text: "", delay: 120 },
          { text: "arcana doctor", delay: 130, color: undefined },
          { text: "  Claude Code    OK", delay: 160, color: SUCCESS },
          { text: "  Skills (59)    OK", delay: 170, color: SUCCESS },
          { text: "  Config         OK", delay: 180, color: SUCCESS },
        ]}
      />
    </div>
  );
};
