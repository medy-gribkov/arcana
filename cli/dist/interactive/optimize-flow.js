import * as p from "@clack/prompts";
import chalk from "chalk";
import { getTotalTokenBudget, AMBER, handleCancel } from "./helpers.js";
export async function optimizeInteractive() {
    const budget = getTotalTokenBudget();
    const barWidth = 30;
    const maxTokens = 200_000;
    const pct = Math.min(100, Math.round((budget.totalTokens / maxTokens) * 100));
    const filled = Math.round((pct / 100) * barWidth);
    const bar = AMBER("█".repeat(filled)) + chalk.dim("░".repeat(barWidth - filled));
    const lines = [];
    lines.push(`${bar}  ${pct}% of 200K context window`);
    lines.push("");
    lines.push(`${chalk.bold(String(budget.count))} skills installed, ${chalk.bold(String(budget.totalKB))} KB total (~${(budget.totalTokens / 1000).toFixed(0)}K tokens)`);
    if (budget.skills.length > 0) {
        lines.push("");
        lines.push(chalk.dim("Largest skills:"));
        for (const s of budget.skills.slice(0, 7)) {
            const pctOfTotal = budget.totalTokens > 0 ? Math.round((s.tokens / budget.totalTokens) * 100) : 0;
            lines.push(`  ${s.name.padEnd(32)} ${String(s.kb).padStart(4)} KB  ${String(pctOfTotal).padStart(3)}%`);
        }
    }
    p.note(lines.join("\n"), "Token Budget");
    const action = await p.select({
        message: "What next?",
        options: [
            { value: "full", label: "Run full optimization report" },
            { value: "__back", label: "Back" },
        ],
    });
    handleCancel(action);
    if (action === "full") {
        const { optimizeCommand } = await import("../commands/optimize.js");
        await optimizeCommand({ json: false });
    }
}
