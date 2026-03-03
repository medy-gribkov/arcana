export declare function searchCommand(query: string, opts: {
    provider?: string;
    cache?: boolean;
    json?: boolean;
    tag?: string;
    smart?: boolean;
}): Promise<void>;
