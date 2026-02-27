import { Provider } from "./providers/base.js";
import { ArcanaProvider } from "./providers/arcana.js";
import { GitHubProvider, validateSlug } from "./providers/github.js";
import { loadConfig } from "./utils/config.js";
import { errorAndExit } from "./utils/ui.js";

const providerCache = new Map<string, Provider>();

export function clearProviderCache(): void {
  providerCache.clear();
}

export function parseProviderSlug(input: string): { owner: string; repo: string } {
  const parts = input.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    errorAndExit(`Invalid provider slug: "${input}"`, "Use format: owner/repo");
  }
  return { owner: parts[0], repo: parts[1] };
}

function createProvider(name: string, type: string, url: string): Provider {
  const cached = providerCache.get(name);
  if (cached) return cached;

  let provider: Provider;

  if (name === "arcana") {
    provider = new ArcanaProvider();
  } else if (type === "github") {
    const { owner, repo } = parseProviderSlug(url);
    try {
      validateSlug(owner, "owner");
      validateSlug(repo, "repo");
    } catch (err) {
      errorAndExit(err instanceof Error ? err.message : String(err));
    }
    provider = new GitHubProvider(owner, repo, { name, displayName: name });
  } else {
    errorAndExit(`Unknown provider type: ${type}`, "Supported types: github");
  }

  providerCache.set(name, provider);
  return provider;
}

export function getProvider(name?: string): Provider {
  const config = loadConfig();
  const providerName = name ?? config.defaultProvider;
  const providerConfig = config.providers.find((p) => p.name === providerName);

  if (!providerConfig) {
    // If it looks like owner/repo, treat as ad-hoc GitHub provider
    if (providerName.includes("/")) {
      const cached = providerCache.get(providerName);
      if (cached) return cached;
      const { owner, repo } = parseProviderSlug(providerName);
      const provider = new GitHubProvider(owner, repo, {
        name: providerName,
        displayName: providerName,
      });
      providerCache.set(providerName, provider);
      return provider;
    }
    errorAndExit(`Provider "${providerName}" not found`, "Run: arcana providers");
  }

  return createProvider(providerConfig.name, providerConfig.type, providerConfig.url);
}

export function getProviders(name?: string): Provider[] {
  if (name) return [getProvider(name)];

  const config = loadConfig();
  return config.providers.filter((p) => p.enabled).map((p) => createProvider(p.name, p.type, p.url));
}
