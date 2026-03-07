import { registerRule } from "../engine.js";

registerRule({
  name: "generic-cleanup",
  tools: [], // Empty = applies to all tools as fallback via engine
  compress(lines: string[]): string[] {
    // This rule is intentionally a no-op.
    // The engine's built-in pipeline (filter, group, truncate, dedup)
    // handles generic cleanup. This exists so custom generic rules
    // can be added later without restructuring.
    return lines;
  },
});
