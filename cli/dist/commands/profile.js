import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "../utils/atomic.js";
import { validateSlug } from "../utils/validate.js";
function getProfilesPath() {
    return join(homedir(), ".arcana", "profiles.json");
}
function readProfiles() {
    const path = getProfilesPath();
    if (!existsSync(path))
        return {};
    try {
        return JSON.parse(readFileSync(path, "utf-8"));
    }
    catch {
        return {};
    }
}
function writeProfiles(profiles) {
    const dir = join(homedir(), ".arcana");
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    atomicWriteSync(getProfilesPath(), JSON.stringify(profiles, null, 2) + "\n");
}
export async function profileCommand(action, name, skills, opts) {
    const resolved = action ?? "list";
    switch (resolved) {
        case "list":
            return listProfiles(opts.json);
        case "create":
            return createProfile(name, skills, opts.json);
        case "delete":
            return deleteProfile(name, opts.json);
        case "show":
            return showProfile(name, opts.json);
        case "apply":
            return applyProfile(name, opts.json);
        default:
            console.error(`Unknown action: ${resolved}`);
            console.error("Valid actions: list, create, delete, show, apply");
            process.exit(1);
    }
}
function listProfiles(json) {
    const profiles = readProfiles();
    const names = Object.keys(profiles);
    if (json) {
        console.log(JSON.stringify({ profiles }));
        return;
    }
    if (names.length === 0) {
        console.log("No profiles defined.");
        console.log("Create one: arcana profile create <name> <skill1> <skill2> ...");
        return;
    }
    console.log(`${names.length} profile(s):\n`);
    for (const profileName of names) {
        const skillList = profiles[profileName];
        console.log(`  ${profileName.padEnd(20)} ${skillList.length} skill(s): ${skillList.join(", ")}`);
    }
    console.log();
}
function createProfile(name, skills, json) {
    if (!name) {
        if (json) {
            console.log(JSON.stringify({ error: "Profile name is required" }));
        }
        else {
            console.error("Profile name is required.");
            console.error("Usage: arcana profile create <name> <skill1> <skill2> ...");
        }
        process.exit(1);
    }
    try {
        validateSlug(name, "profile name");
    }
    catch (err) {
        if (json) {
            console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Invalid profile name" }));
        }
        else {
            console.error(err instanceof Error ? err.message : "Invalid profile name");
        }
        process.exit(1);
    }
    if (skills.length === 0) {
        if (json) {
            console.log(JSON.stringify({ error: "At least one skill is required" }));
        }
        else {
            console.error("At least one skill is required.");
            console.error("Usage: arcana profile create <name> <skill1> <skill2> ...");
        }
        process.exit(1);
    }
    for (const skill of skills) {
        try {
            validateSlug(skill, "skill name");
        }
        catch (err) {
            if (json) {
                console.log(JSON.stringify({ error: err instanceof Error ? err.message : `Invalid skill name: ${skill}` }));
            }
            else {
                console.error(err instanceof Error ? err.message : `Invalid skill name: ${skill}`);
            }
            process.exit(1);
        }
    }
    const profiles = readProfiles();
    if (profiles[name]) {
        if (json) {
            console.log(JSON.stringify({ error: `Profile "${name}" already exists` }));
        }
        else {
            console.error(`Profile "${name}" already exists. Delete it first or choose a different name.`);
        }
        process.exit(1);
    }
    profiles[name] = skills;
    writeProfiles(profiles);
    if (json) {
        console.log(JSON.stringify({ created: name, skills }));
    }
    else {
        console.log(`Created profile "${name}" with ${skills.length} skill(s): ${skills.join(", ")}`);
    }
}
function deleteProfile(name, json) {
    if (!name) {
        if (json) {
            console.log(JSON.stringify({ error: "Profile name is required" }));
        }
        else {
            console.error("Profile name is required.");
            console.error("Usage: arcana profile delete <name>");
        }
        process.exit(1);
    }
    const profiles = readProfiles();
    if (!profiles[name]) {
        if (json) {
            console.log(JSON.stringify({ error: `Profile "${name}" not found` }));
        }
        else {
            console.error(`Profile "${name}" not found.`);
        }
        process.exit(1);
    }
    delete profiles[name];
    writeProfiles(profiles);
    if (json) {
        console.log(JSON.stringify({ deleted: name }));
    }
    else {
        console.log(`Deleted profile "${name}".`);
    }
}
function showProfile(name, json) {
    if (!name) {
        if (json) {
            console.log(JSON.stringify({ error: "Profile name is required" }));
        }
        else {
            console.error("Profile name is required.");
            console.error("Usage: arcana profile show <name>");
        }
        process.exit(1);
    }
    const profiles = readProfiles();
    const skills = profiles[name];
    if (!skills) {
        if (json) {
            console.log(JSON.stringify({ error: `Profile "${name}" not found` }));
        }
        else {
            console.error(`Profile "${name}" not found.`);
        }
        process.exit(1);
    }
    if (json) {
        console.log(JSON.stringify({ name, skills }));
    }
    else {
        console.log(`Profile "${name}" (${skills.length} skill(s)):\n`);
        for (const skill of skills) {
            console.log(`  - ${skill}`);
        }
        console.log();
    }
}
async function applyProfile(name, json) {
    if (!name) {
        if (json) {
            console.log(JSON.stringify({ error: "Profile name is required" }));
        }
        else {
            console.error("Profile name is required.");
            console.error("Usage: arcana profile apply <name>");
        }
        process.exit(1);
    }
    const profiles = readProfiles();
    const skills = profiles[name];
    if (!skills) {
        if (json) {
            console.log(JSON.stringify({ error: `Profile "${name}" not found` }));
        }
        else {
            console.error(`Profile "${name}" not found.`);
        }
        process.exit(1);
    }
    if (skills.length === 0) {
        if (json) {
            console.log(JSON.stringify({ applied: name, installed: [], skipped: [], failed: [] }));
        }
        else {
            console.log(`Profile "${name}" has no skills.`);
        }
        return;
    }
    const { getProvider } = await import("../registry.js");
    const { installSkill, writeSkillMeta, isSkillInstalled } = await import("../utils/fs.js");
    const { loadConfig } = await import("../utils/config.js");
    const config = loadConfig();
    const provider = getProvider(config.defaultProvider);
    const installed = [];
    const skipped = [];
    const failed = [];
    for (const skillName of skills) {
        if (isSkillInstalled(skillName)) {
            skipped.push(skillName);
            continue;
        }
        try {
            const files = await provider.fetch(skillName);
            installSkill(skillName, files);
            const remote = await provider.info(skillName);
            writeSkillMeta(skillName, {
                version: remote?.version ?? "0.0.0",
                installedAt: new Date().toISOString(),
                source: provider.name,
                description: remote?.description,
                fileCount: files.length,
                sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
            });
            installed.push(skillName);
        }
        catch (err) {
            failed.push(skillName);
            if (!json && err instanceof Error) {
                console.error(`  Failed to install ${skillName}: ${err.message}`);
            }
        }
    }
    if (json) {
        console.log(JSON.stringify({ applied: name, installed, skipped, failed }));
    }
    else {
        console.log(`Applied profile "${name}":`);
        if (installed.length > 0)
            console.log(`  Installed: ${installed.join(", ")}`);
        if (skipped.length > 0)
            console.log(`  Skipped (already installed): ${skipped.join(", ")}`);
        if (failed.length > 0)
            console.log(`  Failed: ${failed.join(", ")}`);
        console.log();
    }
    if (failed.length > 0)
        process.exit(1);
}
