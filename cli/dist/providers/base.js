export class Provider {
    clearCache() {
        // Default no-op. Subclasses with caching should override.
    }
    async info(skillName) {
        const skills = await this.list();
        return skills.find((s) => s.name === skillName) ?? null;
    }
}
