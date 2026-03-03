interface ProjectInfo {
    name: string;
    type: string;
    lang: string;
}
export declare function detectProject(cwd: string): ProjectInfo;
export declare const SKILL_SUGGESTIONS: Record<string, string[]>;
export declare const SKILL_SUGGESTIONS_DEFAULT: string[];
export declare function initCommand(opts: {
    tool?: string;
}): Promise<void>;
export {};
