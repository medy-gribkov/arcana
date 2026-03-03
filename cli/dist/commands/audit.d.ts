export interface AuditResult {
    skill: string;
    rating: "PERFECT" | "STRONG" | "ADEQUATE" | "WEAK";
    score: number;
    checks: {
        name: string;
        passed: boolean;
        detail?: string;
    }[];
}
export declare function auditSkill(skillDir: string, skillName: string): AuditResult;
export declare function auditCommand(skill: string | undefined, opts: {
    all?: boolean;
    json?: boolean;
    source?: string;
}): Promise<void>;
