import type { SkillInfo, SkillFile } from "../types.js";

export abstract class Provider {
  abstract readonly name: string;
  abstract readonly displayName: string;

  abstract list(): Promise<SkillInfo[]>;
  abstract fetch(skillName: string): Promise<SkillFile[]>;
  abstract search(query: string): Promise<SkillInfo[]>;

  clearCache(): void {
    // Default no-op. Subclasses with caching should override.
  }

  async info(skillName: string): Promise<SkillInfo | null> {
    const skills = await this.list();
    return skills.find((s) => s.name === skillName) ?? null;
  }
}
