#!/usr/bin/env node

import { createCli } from "./cli.js";
import { CliError } from "./utils/errors.js";
import { HttpError, RateLimitError } from "./utils/http.js";

const cli = createCli();

process.on("SIGINT", () => {
  console.log();
  process.exit(130);
});

try {
  await cli.parseAsync(process.argv);
} catch (err) {
  if (err instanceof RateLimitError) {
    console.error(`\n  ${err.message}\n`);
    process.exit(1);
  }
  if (err instanceof HttpError) {
    console.error(`\n  Network error: ${err.message}`);
    console.error(`  Run \`arcana doctor\` to diagnose.\n`);
    process.exit(1);
  }
  if (err instanceof CliError) {
    console.error(`\n  ${err.message}\n`);
    process.exit(err.exitCode);
  }
  // Unknown error
  if (err instanceof Error) {
    console.error(`\n  Unexpected error: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    console.error();
  } else {
    console.error(`\n  Unexpected error: ${String(err)}\n`);
  }
  process.exit(1);
}
