import chalk from "chalk";
import ora, { type Ora } from "ora";

if (process.env.NO_COLOR || process.env.TERM === "dumb") {
  chalk.level = 0;
}

const AMBER = chalk.hex("#d4943a");

export const ui = {
  brand: (text: string) => AMBER.bold(text),
  success: (text: string) => chalk.green(text),
  error: (text: string) => chalk.red(text),
  warn: (text: string) => chalk.yellow(text),
  dim: (text: string) => chalk.dim(text),
  bold: (text: string) => chalk.bold(text),
  cyan: (text: string) => chalk.cyan(text),
};

export function banner(): void {
  console.log();
  console.log(ui.brand("  arcana") + ui.dim(" - universal agent skill manager"));
  console.log();
}

export function spinner(text: string): Ora {
  return ora({ text, color: "yellow" });
}

export function noopSpinner() {
  return {
    start: () => {},
    stop: () => {},
    succeed: (_m: string) => {},
    info: (_m: string) => {},
    fail: (_m: string) => {},
    text: "",
    message: (_m: string) => {},
  };
}

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

function padWithAnsi(str: string, width: number): string {
  const visible = stripAnsi(str).length;
  const padding = Math.max(0, width - visible);
  return str + " ".repeat(padding);
}

export function table(rows: string[][]): void {
  if (rows.length === 0) return;

  const firstRow = rows[0];
  if (!firstRow) return;
  const colWidths = firstRow.map((_, colIdx) => Math.max(...rows.map((row) => stripAnsi(row[colIdx] ?? "").length)));

  for (const row of rows) {
    const line = row
      .map((cell, i) => padWithAnsi(cell, (colWidths[i] ?? 0) + 2))
      .join("")
      .trimEnd();
    console.log("  " + line);
  }
}

const NETWORK_PATTERNS = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ENETUNREACH", "EAI_AGAIN"];

export function getErrorHint(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const msg = err.message;
  if (NETWORK_PATTERNS.some((p) => msg.includes(p))) {
    return "Check your internet connection and try again.";
  }
  if (msg.includes("404") || msg.includes("Not Found")) {
    return "Skill not found. Run `arcana search <query>` to find skills.";
  }
  return undefined;
}

export function printErrorWithHint(err: unknown, showMessage = false): void {
  if (showMessage && err instanceof Error) {
    console.error(ui.dim(`  ${err.message}`));
  }
  const hint = getErrorHint(err);
  if (hint) console.error(ui.dim(`  Hint: ${hint}`));

  // Retry advice for transient errors
  if (err instanceof Error) {
    const msg = err.message;
    const isTransient = NETWORK_PATTERNS.some((p) => msg.includes(p)) || /\b(429|500|502|503|504)\b/.test(msg);
    if (isTransient) {
      console.error(ui.dim("  Try again in a moment, or check your connection."));
    }
  }
}

export function suggest(text: string): void {
  if (!process.stdout.isTTY) return;
  console.log(ui.dim("  Next: ") + text);
  console.log();
}

export function errorAndExit(message: string, hint?: string): never {
  console.error();
  console.error(ui.error("  Error: ") + message);
  if (hint) {
    console.error(ui.dim("  Hint: ") + hint);
  } else {
    console.error(ui.dim("  Hint: Run `arcana doctor` to diagnose"));
  }
  console.error();
  process.exit(1);
}
