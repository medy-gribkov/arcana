export interface HttpResponse {
    body: string;
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
}
export declare function sanitizeUrl(url: string): string;
export declare class HttpError extends Error {
    readonly statusCode: number;
    readonly url: string;
    constructor(statusCode: number, url: string, message?: string);
}
export declare class RateLimitError extends HttpError {
    readonly resetAt: Date | null;
    constructor(url: string, resetAt: Date | null);
}
export declare function httpGet(url: string, timeout?: number): Promise<HttpResponse>;
