export interface SkillInfo {
    name: string;
    description: string;
    version: string;
    source: string;
    repo?: string;
    tags?: string[];
    conflicts?: string[];
    companions?: string[];
    verified?: boolean;
    author?: string;
}
export interface SkillFile {
    path: string;
    content: string;
}
export interface MarketplaceData {
    name: string;
    owner?: {
        name: string;
        github: string;
    };
    metadata?: {
        description: string;
        version: string;
    };
    plugins: MarketplacePlugin[];
}
export interface MarketplacePlugin {
    name: string;
    source: string;
    description: string;
    version: string;
    tags?: string[];
    conflicts?: string[];
    companions?: string[];
    verified?: boolean;
    author?: string;
}
export interface ProviderConfig {
    name: string;
    type: string;
    url: string;
    enabled: boolean;
}
export interface ArcanaConfig {
    defaultProvider: string;
    installDir: string;
    providers: ProviderConfig[];
}
export interface SkillFrontmatter {
    name: string;
    description: string;
}
export interface ValidationResult {
    skill: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
    infos: string[];
    fixed?: boolean;
}
export interface SkillMeta {
    version: string;
    installedAt: string;
    source: string;
    description?: string;
    fileCount?: number;
    sizeBytes?: number;
}
export interface DoctorCheck {
    name: string;
    status: "pass" | "warn" | "fail";
    message: string;
    fix?: string;
}
