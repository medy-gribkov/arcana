import type { MarketplacePlugin } from "../types.js";
export interface CrossValidationIssue {
    level: "error" | "warning";
    category: "marketplace-drift" | "orphan" | "companion" | "duplicate-desc";
    skill: string;
    detail: string;
}
/**
 * Jaccard word-level similarity between two strings.
 * Returns 0.0 (completely different) to 1.0 (identical).
 */
export declare function jaccardSimilarity(a: string, b: string): number;
/**
 * Validate companion references in marketplace plugins.
 * Every companion must reference an existing plugin name.
 */
export declare function validateCompanions(plugins: MarketplacePlugin[]): CrossValidationIssue[];
/**
 * Check description sync between SKILL.md frontmatter and marketplace.json.
 * Returns an issue if similarity is below 0.5.
 */
export declare function validateDescriptionSync(skillName: string, frontmatterDesc: string, marketplaceDesc: string): CrossValidationIssue | null;
/**
 * Cross-validate skill directories against marketplace.json.
 * Checks: orphans, companions, description drift, near-duplicates.
 */
export declare function crossValidate(skillsDir: string, marketplacePath: string): CrossValidationIssue[];
