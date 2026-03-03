import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteSync } from "../utils/atomic.js";
import { isSkillInstalled, readSkillMeta } from "../utils/fs.js";
import { validateSlug } from "../utils/validate.js";
const TEAM_DIR = ".arcana";
const TEAM_FILE = "team.json";
function getTeamConfigPath() {
    return join(process.cwd(), TEAM_DIR, TEAM_FILE);
}
function readTeamConfig() {
    const configPath = getTeamConfigPath();
    if (!existsSync(configPath))
        return null;
    try {
        const raw = readFileSync(configPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeTeamConfig(config) {
    const dir = join(process.cwd(), TEAM_DIR);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    atomicWriteSync(getTeamConfigPath(), JSON.stringify(config, null, 2) + "\n", 0o644);
}
function output(json, message) {
    if (!json) {
        console.log(message);
    }
}
export async function teamCommand(action, skill, opts) {
    if (action === "init") {
        return teamInit(opts);
    }
    if (action === "sync") {
        return teamSync(opts);
    }
    if (action === "add") {
        if (!skill) {
            if (opts.json) {
                console.log(JSON.stringify({ error: "Skill name required for add" }));
            }
            else {
                console.error("Error: Skill name required. Usage: arcana team add <skill>");
            }
            process.exit(1);
        }
        return teamAdd(skill, opts);
    }
    if (action === "remove") {
        if (!skill) {
            if (opts.json) {
                console.log(JSON.stringify({ error: "Skill name required for remove" }));
            }
            else {
                console.error("Error: Skill name required. Usage: arcana team remove <skill>");
            }
            process.exit(1);
        }
        return teamRemove(skill, opts);
    }
    if (action === undefined) {
        return teamList(opts);
    }
    if (opts.json) {
        console.log(JSON.stringify({ error: `Unknown action: ${action}` }));
    }
    else {
        console.error(`Error: Unknown action "${action}". Valid actions: init, sync, add, remove`);
    }
    process.exit(1);
}
function teamInit(opts) {
    const configPath = getTeamConfigPath();
    if (existsSync(configPath)) {
        if (opts.json) {
            console.log(JSON.stringify({ error: "Team config already exists", path: configPath }));
        }
        else {
            console.error(`Error: ${configPath} already exists.`);
        }
        process.exit(1);
    }
    const config = {
        skills: [],
        updatedAt: new Date().toISOString(),
    };
    writeTeamConfig(config);
    if (opts.json) {
        console.log(JSON.stringify({ created: configPath }));
    }
    else {
        console.log(`Created ${configPath}`);
        console.log("Add skills with: arcana team add <skill-name>");
    }
}
async function teamSync(opts) {
    const config = readTeamConfig();
    if (!config) {
        if (opts.json) {
            console.log(JSON.stringify({ error: "No team config found. Run: arcana team init" }));
        }
        else {
            console.error("Error: No team config found. Run: arcana team init");
        }
        process.exit(1);
    }
    if (config.skills.length === 0) {
        if (opts.json) {
            console.log(JSON.stringify({ installed: [], skipped: [], message: "No skills in team config" }));
        }
        else {
            console.log("No skills listed in team config.");
        }
        return;
    }
    const { installSkill } = await import("../utils/fs.js");
    const installed = [];
    const skipped = [];
    const failed = [];
    for (const entry of config.skills) {
        if (isSkillInstalled(entry.name)) {
            skipped.push(entry.name);
            continue;
        }
        try {
            validateSlug(entry.name, "skill name");
        }
        catch (_err) {
            output(opts.json, `Invalid skill name: ${entry.name}`);
            failed.push(entry.name);
            continue;
        }
        // installSkill requires files, but for sync we re-fetch from provider
        // Lazy import the registry to avoid circular deps at module load
        try {
            const { getProvider } = await import("../registry.js");
            const { loadConfig } = await import("../utils/config.js");
            const { updateLockEntry } = await import("../utils/integrity.js");
            const { writeSkillMeta } = await import("../utils/fs.js");
            const providerName = entry.source ?? loadConfig().defaultProvider;
            const provider = getProvider(providerName);
            const files = await provider.fetch(entry.name);
            installSkill(entry.name, files);
            const remote = await provider.info(entry.name);
            const version = remote?.version ?? entry.version ?? "0.0.0";
            writeSkillMeta(entry.name, {
                version,
                installedAt: new Date().toISOString(),
                source: provider.name,
                description: remote?.description,
                fileCount: files.length,
                sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
            });
            updateLockEntry(entry.name, version, provider.name, files);
            installed.push(entry.name);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "unknown error";
            output(opts.json, `Failed to install ${entry.name}: ${msg}`);
            failed.push(entry.name);
        }
    }
    if (opts.json) {
        console.log(JSON.stringify({ installed, skipped, failed }));
    }
    else {
        console.log(`Sync complete: ${installed.length} installed, ${skipped.length} skipped, ${failed.length} failed`);
    }
    if (failed.length > 0)
        process.exit(1);
}
function teamAdd(skill, opts) {
    try {
        validateSlug(skill, "skill name");
    }
    catch (err) {
        if (opts.json) {
            console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Invalid skill name" }));
        }
        else {
            console.error(err instanceof Error ? err.message : "Invalid skill name");
        }
        process.exit(1);
    }
    const config = readTeamConfig();
    if (!config) {
        if (opts.json) {
            console.log(JSON.stringify({ error: "No team config found. Run: arcana team init" }));
        }
        else {
            console.error("Error: No team config found. Run: arcana team init");
        }
        process.exit(1);
    }
    const exists = config.skills.find((s) => s.name === skill);
    if (exists) {
        if (opts.json) {
            console.log(JSON.stringify({ error: `${skill} is already in team config` }));
        }
        else {
            console.error(`Error: ${skill} is already in team config.`);
        }
        process.exit(1);
    }
    const entry = { name: skill };
    // If skill is installed locally, read meta for version/source
    const meta = readSkillMeta(skill);
    if (meta) {
        if (meta.version)
            entry.version = meta.version;
        if (meta.source)
            entry.source = meta.source;
    }
    config.skills.push(entry);
    config.updatedAt = new Date().toISOString();
    writeTeamConfig(config);
    if (opts.json) {
        console.log(JSON.stringify({ added: entry }));
    }
    else {
        console.log(`Added ${skill} to team config.`);
    }
}
function teamRemove(skill, opts) {
    const config = readTeamConfig();
    if (!config) {
        if (opts.json) {
            console.log(JSON.stringify({ error: "No team config found. Run: arcana team init" }));
        }
        else {
            console.error("Error: No team config found. Run: arcana team init");
        }
        process.exit(1);
    }
    const idx = config.skills.findIndex((s) => s.name === skill);
    if (idx < 0) {
        if (opts.json) {
            console.log(JSON.stringify({ error: `${skill} is not in team config` }));
        }
        else {
            console.error(`Error: ${skill} is not in team config.`);
        }
        process.exit(1);
    }
    config.skills.splice(idx, 1);
    config.updatedAt = new Date().toISOString();
    writeTeamConfig(config);
    if (opts.json) {
        console.log(JSON.stringify({ removed: skill }));
    }
    else {
        console.log(`Removed ${skill} from team config.`);
    }
}
function teamList(opts) {
    const config = readTeamConfig();
    if (!config) {
        if (opts.json) {
            console.log(JSON.stringify({ error: "No team config found. Run: arcana team init" }));
        }
        else {
            console.error("Error: No team config found. Run: arcana team init");
        }
        process.exit(1);
    }
    if (opts.json) {
        console.log(JSON.stringify({ skills: config.skills, updatedAt: config.updatedAt }));
        return;
    }
    if (config.skills.length === 0) {
        console.log("No skills in team config. Add one with: arcana team add <skill>");
        return;
    }
    console.log(`Team skills (${config.skills.length}):`);
    for (const entry of config.skills) {
        const parts = [entry.name];
        if (entry.version)
            parts.push(`v${entry.version}`);
        if (entry.source)
            parts.push(`(${entry.source})`);
        const installed = isSkillInstalled(entry.name);
        if (installed)
            parts.push("[installed]");
        console.log(`  ${parts.join("  ")}`);
    }
}
