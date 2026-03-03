import type { SkillInfo, SkillFile } from "../types.js";
export declare abstract class Provider {
    abstract readonly name: string;
    abstract readonly displayName: string;
    abstract list(): Promise<SkillInfo[]>;
    abstract fetch(skillName: string): Promise<SkillFile[]>;
    abstract search(query: string): Promise<SkillInfo[]>;
    clearCache(): void;
    info(skillName: string): Promise<SkillInfo | null>;
}
