import type { SkillInfo } from "../types.js";
declare function doInstall(skillName: string, providerName: string): Promise<boolean>;
declare function doUninstall(skillName: string): {
    success: boolean;
    backupPath?: string;
};
export declare function skillDetailFlow(skillName: string, allSkills: SkillInfo[], providerName: string): Promise<"back" | "menu">;
export { doInstall, doUninstall };
