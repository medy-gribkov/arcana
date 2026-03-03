export declare const AMBER: import("chalk").ChalkInstance;
export declare function cancelAndExit(): never;
export declare function handleCancel(value: unknown): void;
export declare function countInstalled(): number;
export declare function truncate(str: string, max: number): string;
export declare function getInstalledNames(): string[];
export declare function getTokenEstimate(skillName: string): {
    tokens: number;
    kb: number;
};
export declare function getTotalTokenBudget(): {
    totalKB: number;
    totalTokens: number;
    count: number;
    skills: {
        name: string;
        tokens: number;
        kb: number;
    }[];
};
export declare function buildMenuOptions(installedCount: number, _availableCount: number): {
    value: string;
    label: string;
    hint?: string;
}[];
