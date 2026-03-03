import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir, readSkillMeta } from "../utils/fs.js";
import { readLockfile } from "../utils/integrity.js";
function getInstalledSkillDirs() {
    const installDir = getInstallDir();
    try {
        return readdirSync(installDir).filter((d) => statSync(join(installDir, d)).isDirectory());
    }
    catch {
        return [];
    }
}
export async function exportCommand(opts) {
    const dirs = getInstalledSkillDirs();
    if (dirs.length === 0) {
        console.log(JSON.stringify({ skills: [], message: "No skills installed" }));
        return;
    }
    if (opts.sbom) {
        return exportSbom(dirs);
    }
    return exportManifest(dirs);
}
function exportManifest(dirs) {
    const skills = [];
    for (const name of dirs) {
        const meta = readSkillMeta(name);
        skills.push({
            name,
            version: meta?.version ?? "unknown",
            source: meta?.source ?? "local",
            description: meta?.description ?? "",
        });
    }
    const manifest = {
        exportedAt: new Date().toISOString(),
        skillCount: skills.length,
        skills,
    };
    console.log(JSON.stringify(manifest, null, 2));
}
function exportSbom(dirs) {
    const lockEntries = readLockfile();
    const lockMap = new Map(lockEntries.map((e) => [e.skill, e]));
    const packages = [];
    for (const name of dirs) {
        const meta = readSkillMeta(name);
        const lock = lockMap.get(name);
        packages.push({
            name,
            version: meta?.version ?? lock?.version ?? "unknown",
            source: meta?.source ?? lock?.source ?? "local",
            hash: lock?.hash ?? "unknown",
        });
    }
    const sbom = {
        spdxVersion: "SPDX-2.3",
        dataLicense: "CC0-1.0",
        name: "arcana-skills-sbom",
        documentNamespace: `https://arcana.dev/sbom/${Date.now()}`,
        createdAt: new Date().toISOString(),
        packages,
    };
    console.log(JSON.stringify(sbom, null, 2));
}
