export interface ProjectContext {
    /** Project name from directory or package.json */
    name: string;
    /** Detected primary type */
    type: string;
    /** Primary language */
    lang: string;
    /** All detected tech tags */
    tags: string[];
    /** Extracted preferences from CLAUDE.md */
    preferences: string[];
    /** Names of existing .claude/rules/*.md files */
    ruleFiles: string[];
    /** Raw content of CLAUDE.md if it exists */
    claudeMdContent: string | null;
    /** Names of currently installed skills */
    installedSkills: string[];
}
export declare function detectProjectContext(cwd: string): ProjectContext;
