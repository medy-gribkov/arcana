export declare function uninstallCommand(skillNames: string[], opts?: {
    yes?: boolean;
    json?: boolean;
}): Promise<void>;
export declare function removeSymlinksFor(skillName: string): number;
