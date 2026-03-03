import type { SkillInfo } from "../types.js";
import type { ProjectContext } from "./project-context.js";
export interface ConflictWarning {
    type: "rule-overlap" | "skill-conflict" | "preference-clash";
    message: string;
    severity: "warn" | "block";
}
export declare function checkConflicts(skillName: string, skillInfo: SkillInfo | null, skillContent: string | null, context: ProjectContext): ConflictWarning[];
