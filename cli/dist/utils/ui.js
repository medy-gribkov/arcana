import chalk from "chalk";
import ora from "ora";
if (process.env.NO_COLOR || process.env.TERM === "dumb") {
    chalk.level = 0;
}
const AMBER = chalk.hex("#d4943a");
export const ui = {
    brand: (text) => AMBER.bold(text),
    success: (text) => chalk.green(text),
    error: (text) => chalk.red(text),
    warn: (text) => chalk.yellow(text),
    dim: (text) => chalk.dim(text),
    bold: (text) => chalk.bold(text),
    cyan: (text) => chalk.cyan(text),
};
export function banner() {
    console.log();
    console.log(ui.brand("  arcana") + ui.dim(" - universal agent skill manager"));
    console.log();
}
export function spinner(text) {
    return ora({ text, color: "yellow" });
}
export function noopSpinner() {
    return {
        start: () => { },
        stop: () => { },
        succeed: (_m) => { },
        info: (_m) => { },
        fail: (_m) => { },
        text: "",
        message: (_m) => { },
    };
}
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
function stripAnsi(str) {
    return str.replace(ANSI_REGEX, "");
}
function padWithAnsi(str, width) {
    const visible = stripAnsi(str).length;
    const padding = Math.max(0, width - visible);
    return str + " ".repeat(padding);
}
export function table(rows) {
    if (rows.length === 0)
        return;
    const firstRow = rows[0];
    if (!firstRow)
        return;
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
export function getErrorHint(err) {
    if (!(err instanceof Error))
        return undefined;
    const msg = err.message;
    if (NETWORK_PATTERNS.some((p) => msg.includes(p))) {
        return "Check your internet connection and try again.";
    }
    if (msg.includes("404") || msg.includes("Not Found")) {
        return "Skill not found. Run `arcana search <query>` to find skills.";
    }
    return undefined;
}
export function printErrorWithHint(err, showMessage = false) {
    if (showMessage && err instanceof Error) {
        console.error(ui.dim(`  ${err.message}`));
    }
    const hint = getErrorHint(err);
    if (hint)
        console.error(ui.dim(`  Hint: ${hint}`));
    // Retry advice for transient errors
    if (err instanceof Error) {
        const msg = err.message;
        const isTransient = NETWORK_PATTERNS.some((p) => msg.includes(p)) || /\b(429|500|502|503|504)\b/.test(msg);
        if (isTransient) {
            console.error(ui.dim("  Try again in a moment, or check your connection."));
        }
    }
}
export function suggest(text) {
    if (!process.stdout.isTTY)
        return;
    console.log(ui.dim("  Next: ") + text);
    console.log();
}
export function errorAndExit(message, hint) {
    console.error();
    console.error(ui.error("  Error: ") + message);
    if (hint) {
        console.error(ui.dim("  Hint: ") + hint);
    }
    else {
        console.error(ui.dim("  Hint: Run `arcana doctor` to diagnose"));
    }
    console.error();
    process.exit(1);
}
