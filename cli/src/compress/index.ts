// Re-export compression engine and load all rules
export { compress, compressionStats, registerRule } from "./engine.js";
export { recordCompression, getCompressionStats, resetCompressionStats } from "./tracker.js";

// Load built-in rules (side-effect imports).
// Static imports are required for esbuild compatibility.
import "./rules/git.js";
import "./rules/npm.js";
import "./rules/tsc.js";
import "./rules/test-runner.js";
import "./rules/generic.js";
