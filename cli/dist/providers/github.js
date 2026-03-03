import path from "node:path";
import { Provider } from "./base.js";
import { httpGet } from "../utils/http.js";
import { validateSlug } from "../utils/validate.js";
import { parallelMap } from "../utils/parallel.js";
import { readCache, writeCache, clearCacheFile } from "../utils/cache.js";
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}
export { validateSlug } from "../utils/validate.js";
export class GitHubProvider extends Provider {
    name;
    displayName;
    owner;
    repo;
    branch;
    cache = null;
    treeCache = null;
    constructor(owner, repo, opts) {
        super();
        validateSlug(owner, "owner");
        validateSlug(repo, "repo");
        const branch = opts?.branch ?? "main";
        if (opts?.branch)
            validateSlug(branch, "branch");
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
        this.name = opts?.name ?? `${owner}/${repo}`;
        this.displayName = opts?.displayName ?? `${owner}/${repo}`;
    }
    parseJSON(raw, context) {
        try {
            return JSON.parse(raw);
        }
        catch {
            throw new Error(`Failed to parse response from ${context}. The server may be down or returned invalid data.`);
        }
    }
    get cacheKey() {
        return `${this.owner}-${this.repo}`;
    }
    async list() {
        if (this.cache)
            return this.cache;
        // Check disk cache
        const cached = readCache(this.cacheKey);
        if (cached) {
            this.cache = cached;
            return this.cache;
        }
        const url = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/.claude-plugin/marketplace.json`;
        const { body: raw } = await httpGet(url);
        const data = this.parseJSON(raw, `${this.name}/marketplace.json`);
        if (!data.plugins || !Array.isArray(data.plugins)) {
            throw new Error(`Invalid marketplace.json in ${this.name}: missing plugins array`);
        }
        this.cache = data.plugins
            .filter((p) => {
            if (typeof p.name !== "string" || typeof p.description !== "string" || typeof p.version !== "string") {
                return false;
            }
            return true;
        })
            .map((p) => ({
            name: p.name,
            description: p.description,
            version: p.version,
            source: this.name,
            repo: `https://github.com/${this.owner}/${this.repo}`,
            tags: p.tags,
            conflicts: p.conflicts,
            companions: p.companions,
            verified: p.verified,
            author: p.author,
        }));
        // Warn about malformed entries
        const skipped = data.plugins.length - this.cache.length;
        if (skipped > 0) {
            console.error(`Warning: ${skipped} malformed ${skipped === 1 ? "entry" : "entries"} in ${this.name}/marketplace.json skipped`);
        }
        // Write to disk cache
        writeCache(this.cacheKey, this.cache);
        return this.cache;
    }
    async getTree() {
        if (this.treeCache)
            return this.treeCache;
        const treeUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`;
        const { body: raw } = await httpGet(treeUrl);
        const tree = this.parseJSON(raw, `${this.name}/tree`);
        this.treeCache = tree.tree;
        return this.treeCache;
    }
    async fetch(skillName) {
        validateSlug(skillName, "skill name");
        const tree = await this.getTree();
        const prefix = `skills/${skillName}/`;
        const files = tree.filter((item) => item.path.startsWith(prefix) && item.type === "blob");
        if (files.length === 0) {
            throw new Error(`Skill "${skillName}" not found in ${this.name}`);
        }
        const results = await parallelMap(files, async (file) => {
            const relativePath = file.path.slice(prefix.length);
            if (relativePath.includes("..") || path.isAbsolute(relativePath)) {
                return null;
            }
            const contentUrl = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${file.path}`;
            try {
                const { body: content } = await httpGet(contentUrl);
                return { path: relativePath, content };
            }
            catch (err) {
                throw new Error(`Failed to fetch file "${relativePath}" for skill "${skillName}": ${err instanceof Error ? err.message : String(err)}`, { cause: err });
            }
        }, 6);
        return results.filter((r) => r !== null);
    }
    async search(query) {
        const all = await this.list();
        const q = query.toLowerCase();
        const exact = all.filter((s) => s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.tags?.some((t) => t.toLowerCase().includes(q)));
        if (exact.length > 0)
            return exact;
        // Fuzzy fallback: match skills where Levenshtein distance to name <= 3
        // Skip fuzzy matching for very short queries (too many false positives)
        if (q.length < 3)
            return [];
        return all.filter((s) => levenshtein(q, s.name.toLowerCase()) <= 3);
    }
    clearCache() {
        this.cache = null;
        this.treeCache = null;
        clearCacheFile(this.cacheKey);
    }
}
