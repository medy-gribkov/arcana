import type { SkillInfo } from "../types.js";
declare function doBatchInstall(names: string[], providerName: string): Promise<number>;
export declare function browseByCategory(allSkills: SkillInfo[], providerName: string): Promise<void>;
export { doBatchInstall };
