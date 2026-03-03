import * as p from "@clack/prompts";
import chalk from "chalk";
import { runDoctorChecks } from "../commands/doctor.js";
import { handleCancel } from "./helpers.js";

export async function checkHealth(): Promise<void> {
  const checks = runDoctorChecks();

  p.log.step(chalk.bold("Environment Health Check"));

  for (const check of checks) {
    const icon =
      check.status === "pass" ? chalk.green("OK") : check.status === "warn" ? chalk.yellow("!!") : chalk.red("XX");
    p.log.info(`${icon}  ${chalk.bold(check.name)}: ${check.message}`);
    if (check.fix) p.log.info(chalk.dim(`    Fix: ${check.fix}`));
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;

  if (fails > 0) {
    p.log.error(`${fails} issue${fails > 1 ? "s" : ""} found`);
  } else if (warns > 0) {
    p.log.warn(`${warns} warning${warns > 1 ? "s" : ""}`);
  } else {
    p.log.success("All checks passed");
    return;
  }

  // Offer fixes once
  const fixChecks = checks.filter((c) => c.fix && c.status !== "pass");
  if (fixChecks.length === 0) return;

  const fixOptions = fixChecks.map((c) => {
    const cmd = c.fix!.replace(/^Run:\s*/, "");
    return { value: cmd, label: `Run: ${cmd}`, hint: c.name };
  });

  const fixAction = await p.select({
    message: "Run a fix?",
    options: [...fixOptions, { value: "__skip", label: "Skip" }],
  });
  handleCancel(fixAction);

  if (fixAction !== "__skip") {
    const cmd = fixAction as string;
    const SAFE_PREFIXES = ["arcana ", "git config "];
    if (!SAFE_PREFIXES.some((pre) => cmd.startsWith(pre))) {
      p.log.warn(`Skipped unsafe command: ${cmd}`);
    } else {
      p.log.info(chalk.dim(`Running: ${cmd}`));
      try {
        const { execSync } = await import("node:child_process");
        execSync(cmd, { stdio: "inherit" });
      } catch {
        // Non-zero exit expected for some commands
      }
    }
    p.log.info(chalk.dim("Run health check again to verify."));
  }
}
