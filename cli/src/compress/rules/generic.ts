import { registerRule } from "../engine.js";

registerRule({
  name: "generic-cleanup",
  tools: [], // Empty = applies to all tools as fallback via engine
  /* v8 ignore next 3 -- intentional no-op placeholder */
  compress(lines: string[]): string[] {
    return lines;
  },
});
