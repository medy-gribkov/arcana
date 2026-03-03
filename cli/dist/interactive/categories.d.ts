declare const SKILL_CATEGORIES: Record<string, string[]>;
export { SKILL_CATEGORIES };
export declare function getCategoryFor(skillName: string): string | undefined;
export declare function getRelatedSkills(skillName: string, limit?: number): string[];
