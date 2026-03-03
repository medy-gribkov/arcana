import { readFileSync, existsSync } from "node:fs";
import { getProvider } from "../registry.js";
import { installSkill, writeSkillMeta } from "../utils/fs.js";
import { loadConfig } from "../utils/config.js";
import { updateLockEntry } from "../utils/integrity.js";
import { validateSlug } from "../utils/validate.js";
function parseManifest(raw) {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.skills)) {
        throw new Error("Invalid manifest: expected object with 'skills' array");
    }
    const obj = parsed;
    const skills = obj.skills.map((entry, i) => {
        if (typeof entry !== "object" || entry === null) {
            throw new Error(`Invalid manifest entry at index ${i}`);
        }
        const e = entry;
        if (typeof e.name !== "string" || e.name.length === 0) {
            throw new Error(`Invalid manifest entry at index ${i}: missing name`);
        }
        return {
            name: e.name,
            version: typeof e.version === "string" ? e.version : undefined,
            source: typeof e.source === "string" ? e.source : undefined,
            description: typeof e.description === "string" ? e.description : undefined,
        };
    });
    return { skills };
}
export async function importCommand(file, opts) {
    if (!existsSync(file)) {
        if (opts.json) {
            console.log(JSON.stringify({ error: `File not found: ${file}` }));
        }
        else {
            console.error(`Error: File not found: ${file}`);
        }
        process.exit(1);
    }
    let manifest;
    try {
        const raw = readFileSync(file, "utf-8");
        manifest = parseManifest(raw);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to parse manifest";
        if (opts.json) {
            console.log(JSON.stringify({ error: msg }));
        }
        else {
            console.error(`Error: ${msg}`);
        }
        process.exit(1);
    }
    if (manifest.skills.length === 0) {
        if (opts.json) {
            console.log(JSON.stringify({ installed: [], skipped: [], failed: [], message: "No skills in manifest" }));
        }
        else {
            console.log("No skills found in manifest.");
        }
        return;
    }
    const config = loadConfig();
    const installed = [];
    const skipped = [];
    const failed = [];
    const errors = {};
    for (const entry of manifest.skills) {
        // Validate skill name
        try {
            validateSlug(entry.name, "skill name");
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Invalid skill name";
            failed.push(entry.name);
            errors[entry.name] = msg;
            if (!opts.json) {
                console.error(`Skipping ${entry.name}: ${msg}`);
            }
            continue;
        }
        // Check if already installed (skip unless --force)
        const { isSkillInstalled } = await import("../utils/fs.js");
        if (isSkillInstalled(entry.name) && !opts.force) {
            skipped.push(entry.name);
            continue;
        }
        // Fetch and install
        try {
            const providerName = entry.source ?? config.defaultProvider;
            const provider = getProvider(providerName);
            const files = await provider.fetch(entry.name);
            installSkill(entry.name, files);
            const remote = await provider.info(entry.name);
            const version = remote?.version ?? entry.version ?? "0.0.0";
            writeSkillMeta(entry.name, {
                version,
                installedAt: new Date().toISOString(),
                source: provider.name,
                description: remote?.description ?? entry.description,
                fileCount: files.length,
                sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
            });
            updateLockEntry(entry.name, version, provider.name, files);
            installed.push(entry.name);
            if (!opts.json) {
                console.log(`Installed ${entry.name}`);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "unknown error";
            failed.push(entry.name);
            errors[entry.name] = msg;
            if (!opts.json) {
                console.error(`Failed to install ${entry.name}: ${msg}`);
            }
        }
    }
    if (opts.json) {
        const result = { installed, skipped, failed };
        if (Object.keys(errors).length > 0)
            result.errors = errors;
        console.log(JSON.stringify(result));
    }
    else {
        console.log(`Import complete: ${installed.length} installed, ${skipped.length} skipped, ${failed.length} failed`);
    }
    if (failed.length > 0)
        process.exit(1);
}
