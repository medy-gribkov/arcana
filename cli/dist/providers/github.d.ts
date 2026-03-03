import { Provider } from "./base.js";
import type { SkillInfo, SkillFile } from "../types.js";
export { validateSlug } from "../utils/validate.js";
export declare class GitHubProvider extends Provider {
    readonly name: string;
    readonly displayName: string;
    private owner;
    private repo;
    private branch;
    private cache;
    private treeCache;
    constructor(owner: string, repo: string, opts?: {
        name?: string;
        displayName?: string;
        branch?: string;
    });
    private parseJSON;
    private get cacheKey();
    list(): Promise<SkillInfo[]>;
    private getTree;
    fetch(skillName: string): Promise<SkillFile[]>;
    search(query: string): Promise<SkillInfo[]>;
    clearCache(): void;
}
