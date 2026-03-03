export declare function installCommand(skillNames: string[], opts: {
    provider?: string;
    all?: boolean;
    force?: boolean;
    dryRun?: boolean;
    json?: boolean;
    noCheck?: boolean;
}): Promise<void>;
