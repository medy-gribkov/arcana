import type { SkillInfo } from "../types.js";
import type { ProjectContext } from "./project-context.js";
export interface RecommendVerdict {
    skill: string;
    verdict: "recommended" | "optional" | "skip" | "conflict";
    score: number;
    reasons: string[];
}
export declare function scoreSkill(skill: SkillInfo, context: ProjectContext, installedSkills: string[], allSkills: SkillInfo[]): RecommendVerdict;
export declare function rankSkills(skills: SkillInfo[], context: ProjectContext): RecommendVerdict[];
