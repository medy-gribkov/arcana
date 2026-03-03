import * as p from "@clack/prompts";
import chalk from "chalk";
import { printErrorWithHint } from "../utils/ui.js";
import { isSkillInstalled } from "../utils/fs.js";
import { getProvider, getProviders } from "../registry.js";
import { loadConfig } from "../utils/config.js";
import { renderBanner } from "../utils/help.js";
import { validateSlug } from "../utils/validate.js";
import { installOneCore, sizeWarning, canInstall, detectProviderChange } from "../utils/install-core.js";
export async function installCommand(skillNames, opts) {
    if (opts.json) {
        return installJson(skillNames, opts);
    }
    console.log(renderBanner());
    console.log();
    if (skillNames.length === 0 && !opts.all) {
        p.intro(chalk.bold("Install skill"));
        p.cancel("Specify a skill name or use --all");
        p.log.info("Usage: arcana install <skill-name> [skill2 ...]");
        p.log.info("       arcana install --all");
        process.exit(1);
    }
    const providerName = opts.provider ?? loadConfig().defaultProvider;
    const providers = opts.all ? getProviders() : [getProvider(providerName)];
    if (providers.length === 0) {
        p.cancel("No providers configured. Run: arcana providers --add owner/repo");
        process.exit(1);
    }
    if (opts.all) {
        await installAllInteractive(providers, opts.dryRun, opts.force, opts.noCheck);
    }
    else if (skillNames.length === 1) {
        await installOneInteractive(skillNames[0], providers[0], opts.dryRun, opts.force, opts.noCheck);
    }
    else {
        await installBatchInteractive(skillNames, providers[0], opts.dryRun, opts.force, opts.noCheck);
    }
}
async function installOneInteractive(skillName, provider, dryRun, force, noCheck) {
    p.intro(chalk.bold("Install skill"));
    try {
        validateSlug(skillName, "skill name");
    }
    catch (err) {
        p.cancel(err instanceof Error ? err.message : "Invalid skill name");
        process.exit(1);
    }
    const check = canInstall(skillName, force);
    if (!check.proceed) {
        if (dryRun) {
            p.log.info(`${skillName} is already installed.`);
            p.outro("Dry run complete.");
            return;
        }
        p.cancel(check.reason);
        process.exit(0);
    }
    if (isSkillInstalled(skillName) && force) {
        const change = detectProviderChange(skillName, provider.name);
        if (change)
            p.log.warn(change);
        p.log.warn(`${skillName} is already installed. Reinstalling...`);
    }
    if (dryRun) {
        p.log.info(`Would install ${chalk.bold(skillName)} from ${provider.name}`);
        p.outro("Dry run complete.");
        return;
    }
    const spin = p.spinner();
    spin.start(`Installing ${chalk.bold(skillName)} from ${provider.name}...`);
    try {
        const result = await installOneCore(skillName, provider, { force, noCheck });
        if (!result.success) {
            spin.stop("Blocked.");
            if (result.scanBlocked) {
                p.log.error(`Security scan blocked ${chalk.bold(skillName)}`);
                p.log.info(chalk.dim("Use --force to install anyway (not recommended)."));
            }
            else if (result.conflictBlocked) {
                p.log.error(`Conflict detected for ${chalk.bold(skillName)}`);
                p.log.info("Use --force to install anyway or --no-check to skip conflict detection.");
            }
            process.exit(1);
        }
        spin.stop(`Installed ${chalk.bold(skillName)} (${result.files?.length ?? 0} files, ${result.sizeKB?.toFixed(1) ?? "0"} KB)`);
        if (result.conflictWarnings?.length) {
            for (const w of result.conflictWarnings)
                p.log.warn(`  [WARN] ${w}`);
        }
        const warn = sizeWarning(result.sizeKB ?? 0);
        if (warn)
            p.log.warn(warn);
        p.outro(`Next: ${chalk.cyan("arcana validate " + skillName)}`);
    }
    catch (err) {
        spin.stop(`Failed to install ${skillName}`);
        printErrorWithHint(err, true);
        process.exit(1);
    }
}
async function installBatchInteractive(skillNames, provider, dryRun, force, noCheck) {
    p.intro(chalk.bold(`Install ${skillNames.length} skills`));
    for (const name of skillNames) {
        try {
            validateSlug(name, "skill name");
        }
        catch (err) {
            p.log.error(err instanceof Error ? err.message : `Invalid skill name: ${name}`);
            process.exit(1);
        }
    }
    if (dryRun) {
        const wouldInstall = [];
        const alreadyInstalled = [];
        for (const name of skillNames) {
            if (isSkillInstalled(name) && !force)
                alreadyInstalled.push(name);
            else
                wouldInstall.push(name);
        }
        if (wouldInstall.length > 0)
            p.log.info(`Would install: ${wouldInstall.join(", ")}`);
        if (alreadyInstalled.length > 0)
            p.log.info(`Already installed: ${alreadyInstalled.join(", ")}`);
        p.outro("Dry run complete.");
        return;
    }
    const spin = p.spinner();
    spin.start(`Processing ${skillNames.length} skills...`);
    const installed = [];
    const skipped = [];
    const failed = [];
    for (let i = 0; i < skillNames.length; i++) {
        const name = skillNames[i];
        if (isSkillInstalled(name) && !force) {
            skipped.push(name);
            continue;
        }
        spin.message(`Installing ${chalk.bold(name)} (${i + 1}/${skillNames.length}) from ${provider.name}...`);
        try {
            const result = await installOneCore(name, provider, { force, noCheck });
            if (result.success) {
                installed.push(name);
            }
            else {
                failed.push(name);
            }
        }
        catch (err) {
            failed.push(name);
            if (err instanceof Error)
                p.log.warn(`Failed to install ${name}: ${err.message}`);
        }
    }
    spin.stop("Done");
    p.log.info(`${installed.length} installed${skipped.length > 0 ? `, ${skipped.length} skipped (already installed)` : ""}${failed.length > 0 ? `, ${failed.length} failed` : ""}`);
    p.outro(`Next: ${chalk.cyan("arcana doctor")}`);
    if (failed.length > 0)
        process.exit(1);
}
async function installAllInteractive(providers, dryRun, force, noCheck) {
    p.intro(chalk.bold("Install all skills"));
    const spin = p.spinner();
    spin.start("Fetching skill list...");
    if (dryRun) {
        let total = 0;
        for (const prov of providers) {
            try {
                const skills = await prov.list();
                total += skills.length;
            }
            catch (err) {
                if (err instanceof Error)
                    p.log.warn(`Failed to list ${prov.name}: ${err.message}`);
            }
        }
        spin.stop(`Would install ${total} skills`);
        p.outro("Dry run complete.");
        return;
    }
    const installed = [];
    const skipped = [];
    const failed = [];
    for (const prov of providers) {
        let skills;
        try {
            skills = await prov.list();
        }
        catch (err) {
            if (err instanceof Error)
                p.log.warn(`Failed to list ${prov.name}: ${err.message}`);
            continue;
        }
        for (let i = 0; i < skills.length; i++) {
            const skill = skills[i];
            if (isSkillInstalled(skill.name) && !force) {
                skipped.push(skill.name);
                continue;
            }
            spin.message(`Installing ${chalk.bold(skill.name)} (${i + 1}/${skills.length}) from ${prov.name}...`);
            try {
                const result = await installOneCore(skill.name, prov, { force, noCheck });
                if (result.success)
                    installed.push(skill.name);
                else
                    failed.push(skill.name);
            }
            catch (err) {
                failed.push(skill.name);
                if (err instanceof Error)
                    p.log.warn(`Failed to install ${skill.name}: ${err.message}`);
            }
        }
    }
    spin.stop(`Installed ${installed.length} skills${failed.length > 0 ? `, ${failed.length} failed` : ""}`);
    if (skipped.length > 0) {
        p.log.info(`Skipped ${skipped.length} already installed${force ? "" : " (use --force to reinstall)"}`);
    }
    p.outro(`Next: ${chalk.cyan("arcana doctor")}`);
    if (failed.length > 0)
        process.exit(1);
}
async function installJson(skillNames, opts) {
    if (skillNames.length === 0 && !opts.all) {
        console.log(JSON.stringify({ installed: [], skipped: [], failed: [], error: "No skill specified" }));
        process.exit(1);
    }
    const providerName = opts.provider ?? loadConfig().defaultProvider;
    const providers = opts.all ? getProviders() : [getProvider(providerName)];
    const installed = [];
    const skipped = [];
    const failed = [];
    const failedErrors = {};
    if (opts.all) {
        if (opts.dryRun) {
            const wouldInstall = [];
            const errors = [];
            for (const prov of providers) {
                try {
                    const skills = await prov.list();
                    wouldInstall.push(...skills.map((s) => s.name));
                }
                catch (err) {
                    errors.push(`Failed to list ${prov.name}: ${err instanceof Error ? err.message : "unknown error"}`);
                }
            }
            const result = { dryRun: true, wouldInstall };
            if (errors.length > 0)
                result.errors = errors;
            console.log(JSON.stringify(result));
            return;
        }
        const errors = [];
        for (const prov of providers) {
            let skills;
            try {
                skills = await prov.list();
            }
            catch (err) {
                errors.push(`Failed to list ${prov.name}: ${err instanceof Error ? err.message : "unknown error"}`);
                continue;
            }
            for (const skill of skills) {
                if (isSkillInstalled(skill.name) && !opts.force) {
                    skipped.push(skill.name);
                    continue;
                }
                try {
                    const result = await installOneCore(skill.name, prov, { force: opts.force, noCheck: opts.noCheck });
                    if (result.success)
                        installed.push(skill.name);
                    else {
                        failed.push(skill.name);
                        failedErrors[skill.name] = result.error ?? "Install failed";
                    }
                }
                catch (err) {
                    failed.push(skill.name);
                    failedErrors[skill.name] = err instanceof Error ? err.message : "unknown";
                }
            }
        }
        const result = { installed, skipped, failed };
        if (errors.length > 0)
            result.errors = errors;
        if (Object.keys(failedErrors).length > 0)
            result.failedErrors = failedErrors;
        console.log(JSON.stringify(result));
    }
    else {
        const provider = providers[0];
        if (opts.dryRun) {
            console.log(JSON.stringify({ dryRun: true, wouldInstall: skillNames }));
            return;
        }
        for (const name of skillNames) {
            try {
                validateSlug(name, "skill name");
                if (isSkillInstalled(name) && !opts.force) {
                    skipped.push(name);
                    continue;
                }
                const result = await installOneCore(name, provider, { force: opts.force, noCheck: opts.noCheck });
                if (result.success)
                    installed.push(name);
                else
                    failed.push(name);
            }
            catch {
                failed.push(name);
            }
        }
        console.log(JSON.stringify({ installed, skipped, failed }));
    }
    if (failed.length > 0)
        process.exit(1);
}
