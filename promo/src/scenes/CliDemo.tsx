import React from "react";
import { Terminal } from "../components/Terminal";
import { DARK, SUCCESS, DIM } from "../styles/colors";

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
          { text: "Installing 58 skills...", delay: 40, color: DIM },
          { text: "  golang-pro          installed", delay: 55, color: SUCCESS },
          { text: "  security-review     installed", delay: 63, color: SUCCESS },
          { text: "  typescript-advanced  installed", delay: 71, color: SUCCESS },
          { text: "  database-design     installed", delay: 79, color: SUCCESS },
          { text: "  ...and 54 more", delay: 87, color: DIM },
          { text: "", delay: 100 },
          { text: "arcana validate --all", delay: 110, color: undefined },
          { text: "  58 skills validated, 0 errors", delay: 135, color: SUCCESS },
          { text: "", delay: 145 },
          { text: "arcana doctor", delay: 155, color: undefined },
          { text: "  Claude Code    OK", delay: 175, color: SUCCESS },
          { text: "  Skills (58)    OK", delay: 182, color: SUCCESS },
          { text: "  Config         OK", delay: 189, color: SUCCESS },
          { text: "  Security       OK", delay: 196, color: SUCCESS },
        ]}
      />
    </div>
  );
};
