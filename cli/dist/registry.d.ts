import { Provider } from "./providers/base.js";
export declare function clearProviderCache(): void;
export declare function parseProviderSlug(input: string): {
    owner: string;
    repo: string;
};
export declare function getProvider(name?: string): Provider;
export declare function getProviders(name?: string): Provider[];
