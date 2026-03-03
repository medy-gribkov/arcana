import { type Ora } from "ora";
export declare const ui: {
    brand: (text: string) => string;
    success: (text: string) => string;
    error: (text: string) => string;
    warn: (text: string) => string;
    dim: (text: string) => string;
    bold: (text: string) => string;
    cyan: (text: string) => string;
};
export declare function banner(): void;
export declare function spinner(text: string): Ora;
export declare function noopSpinner(): {
    start: () => void;
    stop: () => void;
    succeed: (_m: string) => void;
    info: (_m: string) => void;
    fail: (_m: string) => void;
    text: string;
    message: (_m: string) => void;
};
export declare function table(rows: string[][]): void;
export declare function getErrorHint(err: unknown): string | undefined;
export declare function printErrorWithHint(err: unknown, showMessage?: boolean): void;
export declare function suggest(text: string): void;
export declare function errorAndExit(message: string, hint?: string): never;
