// Re-export compression engine and load all rules
export { compress, compressionStats, registerRule } from "./engine.js";
export { recordCompression, getCompressionStats, resetCompressionStats } from "./tracker.js";
export { installHook, removeHook, isHookInstalled } from "./hook.js";

// Load built-in rules (side-effect imports)
import "./rules/git.js";
import "./rules/npm.js";
import "./rules/tsc.js";
import "./rules/test-runner.js";
import "./rules/generic.js";
