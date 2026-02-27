import { writeFileSync, renameSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";

export function atomicWriteSync(filePath: string, content: string, mode = 0o644): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tmpPath = join(dir, `.${process.pid}.${randomBytes(16).toString("hex")}.tmp`);
  try {
    writeFileSync(tmpPath, content, { encoding: "utf-8", mode });
    renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* cleanup best-effort */
    }
    throw err;
  }
}
