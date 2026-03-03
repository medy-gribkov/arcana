export declare function validateCommand(skill: string | undefined, opts: {
    all?: boolean;
    fix?: boolean;
    json?: boolean;
    source?: string;
    cross?: boolean;
    minScore?: number;
}): Promise<void>;
