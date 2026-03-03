import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { homedir } from "node:os";
import type { ArcanaConfig, ProviderConfig } from "../types.js";
import { ui } from "./ui.js";
import { atomicWriteSync } from "./atomic.js";

const CONFIG_PATH = join(homedir(), ".arcana", "config.json");

/** Matches owner/repo slug format (e.g. "medy-gribkov/arcana") */
const SLUG_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

const DEFAULT_CONFIG: ArcanaConfig = {
  defaultProvider: "arcana",
  installDir: join(homedir(), ".agents", "skills"),
  providers: [
    {
      name: "arcana",
      type: "github",
      url: "medy-gribkov/arcana",
      enabled: true,
    },
  ],
};

function cloneConfig(config: ArcanaConfig): ArcanaConfig {
  return { ...config, providers: config.providers.map((p) => ({ ...p })) };
}

/** Validate config and return warnings for invalid fields. */
export function validateConfig(config: ArcanaConfig): string[] {
  const warnings: string[] = [];

  // Validate providers have valid owner/repo slugs
  for (const p of config.providers) {
    if (p.type === "github" && !SLUG_RE.test(p.url)) {
      warnings.push(`Provider "${p.name}" has invalid URL "${p.url}". Expected owner/repo format.`);
    }
  }

  // Validate installDir is absolute
  if (!isAbsolute(config.installDir)) {
    warnings.push(`installDir "${config.installDir}" is not an absolute path.`);
  }

  // Validate defaultProvider matches a configured provider or valid slug
  const providerNames = config.providers.map((p) => p.name);
  if (!providerNames.includes(config.defaultProvider) && !SLUG_RE.test(config.defaultProvider)) {
    warnings.push(
      `defaultProvider "${config.defaultProvider}" doesn't match any configured provider and isn't a valid slug.`,
    );
  }

  return warnings;
}

export function loadConfig(): ArcanaConfig {
  if (!existsSync(CONFIG_PATH)) {
    return applyEnvOverrides(cloneConfig(DEFAULT_CONFIG));
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const loaded = JSON.parse(raw) as Partial<ArcanaConfig>;
    const config: ArcanaConfig = {
      ...DEFAULT_CONFIG,
      ...loaded,
      providers: loaded.providers ?? DEFAULT_CONFIG.providers.map((p) => ({ ...p })),
    };
    return applyEnvOverrides(config);
  } catch {
    console.error(ui.warn("  Warning: Config file is corrupted, using defaults"));
    return applyEnvOverrides(cloneConfig(DEFAULT_CONFIG));
  }
}

function applyEnvOverrides(base: ArcanaConfig): ArcanaConfig {
  const config = { ...base, providers: base.providers };
  const envInstallDir = process.env.ARCANA_INSTALL_DIR;
  if (envInstallDir) {
    if (!isAbsolute(envInstallDir)) {
      console.error(ui.warn("  Warning: ARCANA_INSTALL_DIR must be an absolute path. Ignoring."));
    } else {
      config.installDir = envInstallDir;
    }
  }
  const envProvider = process.env.ARCANA_DEFAULT_PROVIDER;
  if (envProvider) {
    const trimmed = envProvider.trim();
    if (trimmed.length === 0) {
      console.error(ui.warn("  Warning: ARCANA_DEFAULT_PROVIDER is empty. Ignoring."));
    } else if (!SLUG_RE.test(trimmed) && !config.providers.some((p) => p.name === trimmed)) {
      console.error(ui.warn(`  Warning: ARCANA_DEFAULT_PROVIDER "${trimmed}" is not a valid slug. Ignoring.`));
    } else {
      config.defaultProvider = trimmed;
    }
  }
  return config;
}

export function saveConfig(config: ArcanaConfig): void {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  atomicWriteSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", 0o600);
}

export function addProvider(provider: ProviderConfig): void {
  const config = loadConfig();
  const existing = config.providers.findIndex((p) => p.name === provider.name);
  if (existing >= 0) {
    config.providers[existing] = provider;
  } else {
    config.providers.push(provider);
  }
  saveConfig(config);
}

export function removeProvider(name: string): boolean {
  const config = loadConfig();
  const idx = config.providers.findIndex((p) => p.name === name);
  if (idx < 0) return false;
  config.providers.splice(idx, 1);
  saveConfig(config);
  return true;
}
