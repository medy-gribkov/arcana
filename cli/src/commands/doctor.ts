import { existsSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { ui, banner, suggest } from "../utils/ui.js";
import { getInstallDir, getDirSize, listSymlinks, isOrphanedProject } from "../utils/fs.js";
import type { DoctorCheck } from "../types.js";

function checkNodeVersion(): DoctorCheck {
  const major = parseInt(process.version.slice(1));
  if (major >= 18) {
    return { name: "Node.js", status: "pass", message: `${process.version}` };
  }
  return {
    name: "Node.js",
    status: "fail",
    message: `${process.version} (need 18+)`,
    fix: "Install Node.js 18 or later",
  };
}

function checkInstallDir(): DoctorCheck {
  const dir = getInstallDir();
  if (!existsSync(dir)) {
    return {
      name: "Skills directory",
      status: "warn",
      message: "~/.agents/skills/ not found",
      fix: "Run: arcana install --all",
    };
  }
  const skills = readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory());
  return { name: "Skills directory", status: "pass", message: `${skills.length} skills installed` };
}

function checkBrokenSymlinks(): DoctorCheck {
  const symlinks = listSymlinks();
  if (symlinks.length === 0) {
    return { name: "Symlinks", status: "pass", message: "No symlink directory" };
  }
  const broken = symlinks.filter((s) => s.broken).length;
  if (broken > 0) {
    return {
      name: "Symlinks",
      status: "warn",
      message: `${broken}/${symlinks.length} broken symlinks`,
      fix: "Run: arcana clean",
    };
  }
  return { name: "Symlinks", status: "pass", message: `${symlinks.length} symlinks ok` };
}

function checkGitConfig(): DoctorCheck {
  try {
    const name = execSync("git config user.name", { encoding: "utf-8" }).trim();
    const email = execSync("git config user.email", { encoding: "utf-8" }).trim();
    if (!name || !email) {
      return {
        name: "Git config",
        status: "warn",
        message: "Missing user.name or user.email",
        fix: 'git config --global user.name "Your Name"',
      };
    }
    return { name: "Git config", status: "pass", message: `${name} <${email}>` };
  } catch {
    return {
      name: "Git config",
      status: "warn",
      message: "Git not found",
      fix: "Install Git from https://git-scm.com",
    };
  }
}

function checkArcanaConfig(): DoctorCheck {
  const configPath = join(homedir(), ".arcana", "config.json");
  if (!existsSync(configPath)) {
    return { name: "Arcana config", status: "pass", message: "Using defaults" };
  }
  try {
    JSON.parse(readFileSync(configPath, "utf-8"));
    return { name: "Arcana config", status: "pass", message: "Valid config" };
  } catch {
    return { name: "Arcana config", status: "fail", message: "Invalid JSON", fix: "Run: arcana config reset" };
  }
}

const DISK_USAGE_THRESHOLD_MB = 500;

function checkDiskUsage(): DoctorCheck {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    return { name: "Disk usage", status: "pass", message: "No Claude project data" };
  }

  let totalSize = 0;
  let dirCount = 0;
  try {
    for (const entry of readdirSync(projectsDir)) {
      const full = join(projectsDir, entry);
      if (statSync(full).isDirectory()) {
        dirCount++;
        totalSize += getDirSize(full);
      }
    }
  } catch {
    /* skip */
  }

  const mb = (totalSize / (1024 * 1024)).toFixed(1);
  if (totalSize > DISK_USAGE_THRESHOLD_MB * 1024 * 1024) {
    return {
      name: "Disk usage",
      status: "warn",
      message: `${mb} MB across ${dirCount} projects (threshold: ${DISK_USAGE_THRESHOLD_MB} MB). Try: arcana clean`,
    };
  }
  return { name: "Disk usage", status: "pass", message: `${mb} MB across ${dirCount} projects` };
}

function checkSkillValidity(): DoctorCheck {
  const dir = getInstallDir();
  if (!existsSync(dir)) {
    return { name: "Skill health", status: "pass", message: "No skills to check" };
  }

  let total = 0;
  const missingMd: string[] = [];
  const badFrontmatter: string[] = [];

  for (const entry of readdirSync(dir)) {
    const skillDir = join(dir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    total++;
    const skillMd = join(skillDir, "SKILL.md");
    if (!existsSync(skillMd)) {
      missingMd.push(entry);
      continue;
    }
    try {
      const fd = openSync(skillMd, "r");
      const buf = Buffer.alloc(4);
      readSync(fd, buf, 0, 4, 0);
      closeSync(fd);
      if (!buf.toString("utf-8").startsWith("---")) badFrontmatter.push(entry);
    } catch {
      badFrontmatter.push(entry);
    }
  }

  const invalid = missingMd.length + badFrontmatter.length;
  if (invalid === 0) {
    return { name: "Skill health", status: "pass", message: `${total} skills valid` };
  }

  const details: string[] = [];
  let fix: string;
  if (missingMd.length > 0) {
    details.push(`${missingMd.length} missing SKILL.md (${missingMd.join(", ")})`);
    fix =
      missingMd.length === 1 ? `Run: arcana uninstall ${missingMd[0]}` : `Run: arcana uninstall ${missingMd.join(" ")}`;
  } else {
    fix = "Run: arcana validate --all --fix";
  }
  if (badFrontmatter.length > 0) {
    details.push(`${badFrontmatter.length} invalid frontmatter`);
  }

  return {
    name: "Skill health",
    status: "warn",
    message: `${invalid}/${total} skills have issues (${details.join("; ")})`,
    fix,
  };
}

function checkSkillSizes(): DoctorCheck {
  const dir = getInstallDir();
  if (!existsSync(dir)) {
    return { name: "Skill sizes", status: "pass", message: "No skills to check" };
  }

  const large: { name: string; kb: number }[] = [];
  let totalKB = 0;
  for (const entry of readdirSync(dir)) {
    const skillDir = join(dir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    const size = getDirSize(skillDir);
    const kb = size / 1024;
    totalKB += kb;
    if (kb > 50) large.push({ name: entry, kb });
  }

  if (large.length === 0) {
    return {
      name: "Skill sizes",
      status: "pass",
      message: `All skills under 50 KB (total: ${totalKB.toFixed(0)} KB, ~${Math.round((totalKB * 256) / 1000)}K tokens)`,
    };
  }

  large.sort((a, b) => b.kb - a.kb);
  const top3 = large
    .slice(0, 3)
    .map((s) => `${s.name} (${s.kb.toFixed(0)} KB)`)
    .join(", ");
  return {
    name: "Skill sizes",
    status: "warn",
    message: `${large.length} skills >50 KB (high token usage). Total: ${totalKB.toFixed(0)} KB (~${Math.round((totalKB * 256) / 1000)}K tokens). Largest: ${top3}`,
  };
}

function checkOrphanedProjects(): DoctorCheck {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    return { name: "Orphaned projects", status: "pass", message: "No project data" };
  }

  const orphans: { name: string; sizeMB: number }[] = [];
  for (const entry of readdirSync(projectsDir)) {
    const full = join(projectsDir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry === "memory" || entry.startsWith(".")) continue;
    if (isOrphanedProject(entry)) {
      orphans.push({ name: entry, sizeMB: getDirSize(full) / (1024 * 1024) });
    }
  }

  if (orphans.length === 0) {
    return { name: "Orphaned projects", status: "pass", message: "All project dirs have matching source" };
  }

  const totalMB = orphans.reduce((sum, o) => sum + o.sizeMB, 0).toFixed(1);
  return {
    name: "Orphaned projects",
    status: "warn",
    message: `${orphans.length} orphaned project dirs (${totalMB} MB). Source code no longer exists.`,
    fix: "Run: arcana clean",
  };
}

function checkSessionBloat(): DoctorCheck {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    return { name: "Session bloat", status: "pass", message: "No session data" };
  }

  const bloated: { project: string; file: string; sizeMB: number }[] = [];
  for (const project of readdirSync(projectsDir)) {
    const projDir = join(projectsDir, project);
    if (!statSync(projDir).isDirectory()) continue;
    for (const file of readdirSync(projDir)) {
      if (!file.endsWith(".jsonl")) continue;
      const stat = statSync(join(projDir, file));
      const mb = stat.size / (1024 * 1024);
      if (mb > 50) {
        bloated.push({ project, file, sizeMB: mb });
      }
    }
  }

  if (bloated.length === 0) {
    return { name: "Session bloat", status: "pass", message: "No session files >50 MB" };
  }

  bloated.sort((a, b) => b.sizeMB - a.sizeMB);
  const top = bloated[0]!;
  const totalMB = bloated.reduce((sum, b) => sum + b.sizeMB, 0).toFixed(0);
  return {
    name: "Session bloat",
    status: "warn",
    message: `${bloated.length} session files >50 MB (${totalMB} MB total). Largest: ${top.project} (${top.sizeMB.toFixed(0)} MB)`,
    fix: "Run: arcana clean --aggressive",
  };
}

function checkAuxiliaryBloat(): DoctorCheck {
  const claudeDir = join(homedir(), ".claude");
  const dirs = ["file-history", "debug", "shell-snapshots", "todos", "plans"] as const;
  let totalMB = 0;
  const bloated: string[] = [];

  for (const dirName of dirs) {
    const dir = join(claudeDir, dirName);
    if (!existsSync(dir)) continue;
    const sizeMB = getDirSize(dir) / (1024 * 1024);
    totalMB += sizeMB;
    if (sizeMB > 10) bloated.push(`${dirName} (${sizeMB.toFixed(0)} MB)`);
  }

  if (totalMB < 10) {
    return { name: "Auxiliary data", status: "pass", message: `${totalMB.toFixed(1)} MB across temp directories` };
  }

  return {
    name: "Auxiliary data",
    status: "warn",
    message: `${totalMB.toFixed(0)} MB in temp directories${bloated.length > 0 ? `. Bloated: ${bloated.join(", ")}` : ""}`,
    fix: "Run: arcana clean",
  };
}

export function runDoctorChecks(): DoctorCheck[] {
  return [
    checkNodeVersion(),
    checkInstallDir(),
    checkBrokenSymlinks(),
    checkSkillValidity(),
    checkSkillSizes(),
    checkGitConfig(),
    checkArcanaConfig(),
    checkDiskUsage(),
    checkOrphanedProjects(),
    checkSessionBloat(),
    checkAuxiliaryBloat(),
  ];
}

export async function doctorCommand(opts: { json?: boolean } = {}): Promise<void> {
  if (!opts.json) {
    banner();
    console.log(ui.bold("  Environment Health Check\n"));
  }

  const checks = runDoctorChecks();

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          checks: checks.map((c) => ({
            name: c.name,
            status: c.status,
            message: c.message,
            ...(c.fix ? { fix: c.fix } : {}),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const check of checks) {
    const icon =
      check.status === "pass" ? ui.success("[OK]") : check.status === "warn" ? ui.warn("[!!]") : ui.error("[XX]");

    console.log(`  ${icon} ${ui.bold(check.name)}: ${check.message}`);
    if (check.fix) {
      console.log(ui.dim(`    Fix: ${check.fix}`));
    }
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  console.log();

  if (fails > 0) {
    console.log(ui.error(`  ${fails} issue${fails > 1 ? "s" : ""} found`));
  } else if (warns > 0) {
    console.log(ui.warn(`  ${warns} warning${warns > 1 ? "s" : ""}`));
  } else {
    console.log(ui.success("  All checks passed"));
  }
  console.log();

  if (fails === 0 && warns === 0) {
    suggest("arcana list");
  }
}
