import { ui, banner } from "../utils/ui.js";

export async function mcpCommand(
  action: string,
  name: string | undefined,
  opts: { tool?: string; json?: boolean },
): Promise<void> {
  if (action === "list") {
    const { listRegistry } = await import("../mcp/registry.js");
    const servers = listRegistry();
    if (opts.json) {
      console.log(JSON.stringify(servers));
      return;
    }
    /* v8 ignore start */
    banner();
    console.log(ui.bold("  Available MCP Servers\n"));
    for (const s of servers) {
      console.log(`  ${ui.success(s.name)} ${s.description}`);
      console.log(ui.dim(`       ${s.command} ${s.args.join(" ")}`));
    }
    console.log();
    return;
    /* v8 ignore stop */
  }

  if (action === "install") {
    if (!name) {
      console.error("Usage: arcana mcp install <name>");
      process.exit(1);
    }
    const { installMcpServer } = await import("../mcp/install.js");
    const tool = (opts.tool ?? "claude") as "claude" | "cursor";
    const result = installMcpServer(name, tool, process.cwd());
    if (opts.json) {
      console.log(JSON.stringify(result));
      return;
    }
    /* v8 ignore start */
    if (result.installed) {
      console.log(`${ui.success("[OK]")} ${name} configured in ${result.path}`);
      if (result.error) console.log(ui.dim(`  Note: ${result.error}`));
    } else {
      console.log(`${ui.warn("[!!]")} ${result.error}`);
    }
    return;
    /* v8 ignore stop */
  }

  if (action === "remove") {
    if (!name) {
      console.error("Usage: arcana mcp remove <name>");
      process.exit(1);
    }
    const { removeMcpServer } = await import("../mcp/install.js");
    const tool = (opts.tool ?? "claude") as "claude" | "cursor";
    const ok = removeMcpServer(name, tool, process.cwd());
    if (opts.json) {
      console.log(JSON.stringify({ removed: ok, name }));
      return;
    }
    /* v8 ignore start */
    console.log(ok ? `${ui.success("[OK]")} Removed ${name}` : `${ui.warn("[!!]")} ${name} not found`);
    return;
    /* v8 ignore stop */
  }

  if (action === "status") {
    const { listConfiguredServers } = await import("../mcp/install.js");
    const tool = (opts.tool ?? "claude") as "claude" | "cursor";
    const servers = listConfiguredServers(tool, process.cwd());
    if (opts.json) {
      console.log(JSON.stringify({ tool, servers }));
      return;
    }
    /* v8 ignore start */
    banner();
    console.log(ui.bold(`  MCP Status (${tool})\n`));
    if (servers.length === 0) {
      console.log(ui.dim("  No MCP servers configured."));
    } else {
      for (const s of servers) {
        console.log(`  ${ui.success("[OK]")} ${s}`);
      }
    }
    console.log();
    return;
    /* v8 ignore stop */
  }

  console.error("Usage: arcana mcp <list|install|remove|status> [name]");
  process.exit(1);
}
