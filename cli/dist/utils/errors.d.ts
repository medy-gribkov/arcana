export declare class CliError extends Error {
    readonly code: string;
    readonly exitCode: number;
    constructor(message: string, code?: string, exitCode?: number);
}
