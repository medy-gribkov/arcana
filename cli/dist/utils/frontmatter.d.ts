import type { SkillFrontmatter, ValidationResult } from "../types.js";
export declare const MIN_DESC_LENGTH = 80;
export declare const MAX_DESC_LENGTH = 1024;
export declare const NAME_REGEX: RegExp;
export declare function extractFrontmatter(content: string): {
    raw: string;
    body: string;
} | null;
export declare function parseFrontmatter(raw: string): SkillFrontmatter | null;
export declare function fixSkillFrontmatter(content: string): string;
export declare function validateSkillDir(skillDir: string, skillName: string): ValidationResult;
