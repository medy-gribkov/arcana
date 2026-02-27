import { ui, banner, spinner, noopSpinner, printErrorWithHint } from "../utils/ui.js";
import { isSkillInstalled, readSkillMeta } from "../utils/fs.js";
import { getProviders } from "../registry.js";
import { validateSlug } from "../utils/validate.js";

export async function infoCommand(skillName: string, opts: { provider?: string; json?: boolean }): Promise<void> {
  if (!opts.json) {
    banner();
  }

  try {
    validateSlug(skillName, "skill name");
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Invalid skill name" }));
    } else {
      console.log(ui.error(`  ${err instanceof Error ? err.message : "Invalid skill name"}`));
      console.log();
    }
    process.exit(1);
  }

  const providers = getProviders(opts.provider);
  const s = opts.json ? noopSpinner() : spinner(`Looking up ${ui.bold(skillName)}...`);
  s.start();

  try {
    for (const provider of providers) {
      const skill = await provider.info(skillName);
      if (skill) {
        s.stop();
        const installed = isSkillInstalled(skillName);

        if (opts.json) {
          const meta = installed ? readSkillMeta(skillName) : null;
          console.log(
            JSON.stringify({
              skill: {
                name: skill.name,
                description: skill.description,
                version: skill.version,
                installed,
                installedVersion: meta?.version,
                source: skill.source,
                repo: skill.repo,
              },
            }),
          );
          return;
        }

        console.log(ui.bold(`  ${skill.name}`) + ui.dim(` v${skill.version}`));
        if (installed) {
          const meta = readSkillMeta(skillName);
          const localVersion = meta?.version ?? "unknown";
          console.log(
            "  " +
              ui.success("Installed") +
              (localVersion !== skill.version ? ui.warn(` (local: v${localVersion})`) : ""),
          );
        }
        console.log();
        console.log("  " + skill.description);
        console.log();
        console.log(ui.dim(`  Source: ${skill.source}`));
        if (skill.repo) {
          console.log(ui.dim(`  Repo:   ${skill.repo}`));
        }
        console.log();
        console.log(ui.dim(`  Install: `) + ui.cyan(`arcana install ${skill.name}`));
        console.log();
        return;
      }
    }
  } catch (err) {
    // Offline fallback: show local metadata if installed
    if (isSkillInstalled(skillName)) {
      s.stop();
      const meta = readSkillMeta(skillName);
      if (opts.json) {
        console.log(
          JSON.stringify({
            skill: {
              name: skillName,
              description: meta?.description ?? "No description (offline)",
              version: meta?.version ?? "unknown",
              installed: true,
              source: meta?.source ?? "local",
              offline: true,
            },
          }),
        );
        return;
      }
      console.log(ui.warn("  Showing cached data (offline)"));
      console.log();
      console.log(ui.bold(`  ${skillName}`) + ui.dim(` v${meta?.version ?? "unknown"}`));
      console.log("  " + ui.success("Installed"));
      if (meta?.description) {
        console.log();
        console.log("  " + meta.description);
      }
      console.log();
      console.log(ui.dim(`  Source: ${meta?.source ?? "local"}`));
      console.log();
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Lookup failed" }));
      process.exit(1);
    }
    s.fail("Lookup failed due to a network or provider error.");
    printErrorWithHint(err, true);
    process.exit(1);
  }

  if (opts.json) {
    console.log(JSON.stringify({ error: `Skill "${skillName}" not found` }));
  } else {
    s.fail(`Skill "${skillName}" not found`);
    console.log();
  }
  process.exit(1);
}
