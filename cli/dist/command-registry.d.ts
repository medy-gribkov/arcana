export interface CommandEntry {
    name: string;
    usage: string;
    description: string;
    group: string;
}
export declare function getCommandNames(): string[];
export declare function getGroupedCommands(): Record<string, CommandEntry[]>;
export declare function findClosestCommand(input: string): string | undefined;
export declare function getCliReference(): string;
