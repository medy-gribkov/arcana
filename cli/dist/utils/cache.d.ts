export declare function readCache<T>(key: string, maxAgeMs?: number): T | null;
export declare function writeCache<T>(key: string, data: T): void;
export declare function clearCacheFile(key: string): void;
