import { compress, compressionStats, recordCompression } from "../compress/index.js";

export async function compressCommand(
  command: string[],
  opts: { stdin?: boolean; tool?: string; json?: boolean },
): Promise<void> {
  let input: string;
  if (opts.stdin) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    input = Buffer.concat(chunks).toString("utf-8");
  } else if (command.length > 0) {
    const { execSync } = await import("node:child_process");
    try {
      input = execSync(command.join(" "), {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err) {
      input = (err as { stdout?: string; stderr?: string }).stdout ?? "" + ((err as { stderr?: string }).stderr ?? "");
    }
  } else {
    console.error("Usage: arcana compress <command> or echo ... | arcana compress --stdin --tool git");
    process.exit(1);
    return;
  }

  const tool = opts.tool ?? command[0] ?? "unknown";
  const compressed = compress(input, tool);
  const stats = compressionStats(input, compressed);
  recordCompression(tool, stats.originalTokens, stats.compressedTokens);

  if (opts.json) {
    console.log(JSON.stringify(stats));
  } else {
    process.stdout.write(compressed);
  }
}
