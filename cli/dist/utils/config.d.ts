import type { ArcanaConfig, ProviderConfig } from "../types.js";
/** Validate config and return warnings for invalid fields. */
export declare function validateConfig(config: ArcanaConfig): string[];
export declare function loadConfig(): ArcanaConfig;
export declare function saveConfig(config: ArcanaConfig): void;
export declare function addProvider(provider: ProviderConfig): void;
export declare function removeProvider(name: string): boolean;
