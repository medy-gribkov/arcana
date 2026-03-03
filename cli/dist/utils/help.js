import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { ui } from "./ui.js";
import { getGroupedCommands } from "../command-registry.js";
const noColor = !!(process.env.NO_COLOR || process.env.TERM === "dumb");
function amberShade(hex, text) {
    if (noColor)
        return text;
    return chalk.hex(hex)(text);
}
const AMBER_HEXES = [
    "#e8a84c", // bright amber
    "#d4943a", // brand amber
    "#c0842f", // mid
    "#a87228", // darker
    "#8f6020", // dimmer
    "#755019", // darkest
];
const BANNER_LINES = [
    " █████╗ ██████╗  ██████╗ █████╗ ███╗   ██╗ █████╗ ",
    "██╔══██╗██╔══██╗██╔════╝██╔══██╗████╗  ██║██╔══██╗",
    "███████║██████╔╝██║     ███████║██╔██╗ ██║███████║",
    "██╔══██║██╔══██╗██║     ██╔══██║██║╚██╗██║██╔══██║",
    "██║  ██║██║  ██║╚██████╗██║  ██║██║ ╚████║██║  ██║",
    "╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝",
];
export function renderBanner() {
    if (noColor) {
        return BANNER_LINES.map((l) => `  ${l}`).join("\n");
    }
    return BANNER_LINES.map((line, i) => `  ${amberShade(AMBER_HEXES[i], line)}`).join("\n");
}
// Help groups: subset of registry for --help display (keeps output scannable)
const HELP_GROUPS = {
    "GETTING STARTED": ["init", "doctor"],
    SKILLS: ["list", "search", "info", "install", "update", "uninstall", "recommend"],
    DEVELOPMENT: ["create", "validate", "audit"],
    CONFIGURATION: ["config", "providers", "clean", "stats"],
};
const EXAMPLES = [
    "$ arcana install code-reviewer typescript golang",
    '$ arcana search "testing"',
    "$ arcana init --tool claude",
];
function padRight(str, width) {
    return str + " ".repeat(Math.max(0, width - str.length));
}
export function buildCustomHelp(version) {
    const lines = [];
    lines.push("");
    lines.push(renderBanner());
    lines.push("");
    lines.push(`  ${ui.bold("Supercharge any AI coding agent.")}${" ".repeat(20)}${ui.dim(`v${version}`)}`);
    lines.push("");
    lines.push(`  ${ui.dim("USAGE")}`);
    lines.push("    arcana <command> [options]");
    const allCommands = getGroupedCommands();
    const allFlat = Object.values(allCommands).flat();
    for (const [group, names] of Object.entries(HELP_GROUPS)) {
        lines.push("");
        lines.push(`  ${ui.dim(group)}`);
        for (const name of names) {
            const entry = allFlat.find((c) => c.name === name);
            if (!entry)
                continue;
            lines.push(`    ${ui.cyan(padRight(entry.usage, 22))}${ui.dim(entry.description)}`);
        }
    }
    lines.push("");
    lines.push(`  ${ui.dim("EXAMPLES")}`);
    for (const ex of EXAMPLES) {
        lines.push(`    ${ui.cyan(ex)}`);
    }
    lines.push("");
    lines.push(`  ${ui.dim("LEARN MORE")}`);
    lines.push(`    arcana <command> --help          ${ui.dim("Show help for a command")}`);
    lines.push(`    ${ui.dim("https://github.com/medy-gribkov/arcana")}`);
    lines.push("");
    return lines.join("\n");
}
const FIRST_RUN_FLAG = join(homedir(), ".arcana", ".initialized");
export function isFirstRun() {
    return !existsSync(FIRST_RUN_FLAG);
}
export function markInitialized() {
    const dir = join(homedir(), ".arcana");
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(FIRST_RUN_FLAG, new Date().toISOString(), "utf-8");
}
export function showWelcome(version) {
    console.log();
    console.log(renderBanner());
    console.log();
    p.intro(chalk.hex("#d4943a").bold(`arcana v${version}`));
    p.log.step(chalk.bold("Welcome! Arcana is a universal skill manager for AI coding agents."));
    p.log.info("Skills extend your agent (Claude, Cursor, Codex, etc.) with expert knowledge.");
    p.log.info("They install on-demand and only load when relevant, not all at once.");
    console.log();
}
