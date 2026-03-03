export interface HistoryEntry {
    action: string;
    target?: string;
    timestamp: string;
}
export declare function readHistory(): HistoryEntry[];
export declare function appendHistory(action: string, target?: string): void;
export declare function clearHistory(): void;
export declare function getRecentSkills(limit?: number): string[];
