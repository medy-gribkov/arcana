import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig, saveConfig } from "../utils/config.js";
import { ui, banner, table } from "../utils/ui.js";
import { clearProviderCache } from "../registry.js";

const VALID_KEYS = ["defaultProvider", "installDir"] as const;
type ConfigKey = (typeof VALID_KEYS)[number];

export async function configCommand(
  action: string | undefined,
  value: string | undefined,
  opts?: { json?: boolean },
): Promise<void> {
  if (!opts?.json) {
    banner();
  }

  // arcana config list (or no args)
  if (!action || action === "list") {
    const config = loadConfig();

    if (opts?.json) {
      console.log(JSON.stringify({ config }));
      return;
    }

    console.log(ui.bold("  Configuration\n"));
    const envInstallDir = process.env.ARCANA_INSTALL_DIR;
    const envProvider = process.env.ARCANA_DEFAULT_PROVIDER;
    const rows: string[][] = [
      [
        ui.dim("defaultProvider"),
        config.defaultProvider + (envProvider ? ` ${ui.warn("(overridden by ARCANA_DEFAULT_PROVIDER)")}` : ""),
      ],
      [
        ui.dim("installDir"),
        config.installDir + (envInstallDir ? ` ${ui.warn("(overridden by ARCANA_INSTALL_DIR)")}` : ""),
      ],
      [ui.dim("providers"), config.providers.map((p) => p.name).join(", ")],
    ];
    table(rows);
    console.log();
    const configPath = join(homedir(), ".arcana", "config.json");
    console.log(ui.dim(`  Config file: ${configPath}`));
    console.log(ui.dim(`  ${existsSync(configPath) ? "Custom config" : "Using defaults"}`));
    console.log();
    return;
  }

  // arcana config path
  if (action === "path") {
    if (value && !opts?.json) {
      console.log(ui.warn(`  'path' does not take a value (ignoring "${value}")`));
    }
    const configPath = join(homedir(), ".arcana", "config.json");
    if (opts?.json) {
      console.log(JSON.stringify({ path: configPath, exists: existsSync(configPath) }));
    } else {
      console.log(`  ${configPath}`);
      console.log(ui.dim(`  ${existsSync(configPath) ? "Custom config" : "Using defaults (file does not exist)"}`));
      console.log();
    }
    return;
  }

  // arcana config reset
  if (action === "reset") {
    const configPath = join(homedir(), ".arcana", "config.json");
    const existed = existsSync(configPath);
    if (existed) {
      try {
        rmSync(configPath, { force: true });
      } catch (err) {
        if (opts?.json) {
          console.log(
            JSON.stringify({
              action: "reset",
              success: false,
              error: err instanceof Error ? err.message : "Failed to remove config",
            }),
          );
        } else {
          console.log(ui.error(`  Failed to reset config: ${err instanceof Error ? err.message : "unknown error"}`));
          console.log();
        }
        process.exit(1);
      }
      clearProviderCache();
    }
    if (opts?.json) {
      console.log(JSON.stringify({ action: "reset", success: true, existed }));
    } else {
      console.log(existed ? ui.success("  Config reset to defaults") : ui.dim("  Already using defaults"));
      console.log();
    }
    return;
  }

  // arcana config <key> [value]
  if (!VALID_KEYS.includes(action as ConfigKey)) {
    if (opts?.json) {
      console.log(JSON.stringify({ error: `Unknown config key: ${action}`, validKeys: [...VALID_KEYS] }));
    } else {
      console.log(ui.error(`  Unknown config key: ${action}`));
      console.log(ui.dim(`  Valid keys: ${VALID_KEYS.join(", ")}`));
      console.log();
    }
    process.exit(1);
  }

  const config = loadConfig();
  const key = action as ConfigKey;

  if (value === undefined) {
    // Get value
    if (opts?.json) {
      console.log(JSON.stringify({ action: "get", key, value: config[key] }));
    } else {
      console.log(`  ${key} = ${config[key]}`);
      console.log();
    }
    return;
  }

  // Set value
  if (key === "installDir") {
    if (value === "") {
      console.log(ui.error("  installDir cannot be empty"));
      console.log();
      process.exit(1);
    }
    const { isAbsolute } = await import("node:path");
    if (!isAbsolute(value)) {
      console.log(ui.warn(`  Warning: "${value}" is not an absolute path`));
    }
  }
  if (key === "defaultProvider") {
    const providerNames = config.providers.map((p) => p.name);
    if (!providerNames.includes(value)) {
      console.log(
        ui.error(`  Provider '${value}' not configured. Add it first with: arcana providers --add owner/repo`),
      );
      console.log();
      process.exit(1);
    }
  }
  (config as unknown as Record<string, unknown>)[key] = value;
  saveConfig(config);
  if (opts?.json) {
    console.log(JSON.stringify({ action: "set", key, value }));
  } else {
    console.log(ui.success(`  Set ${key} = ${value}`));
    console.log();
  }
}
