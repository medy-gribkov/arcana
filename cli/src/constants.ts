// Retention & pruning
export const AGENT_LOG_MAX_AGE_DAYS = 7;
export const MAIN_LOG_MAX_AGE_DAYS = 30;
export const STALE_PROJECT_DAYS = 90;
export const PRUNE_DEFAULT_DAYS = 14;
export const PRUNE_SIZE_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10 MB
export const PRUNE_KEEP_NEWEST = 3;

// Skill size warnings
export const LARGE_SKILL_KB_THRESHOLD = 50;
export const TOKENS_PER_KB = 256;
export const CONTEXT_WINDOW_TOKENS = 200_000;

// Display
export const DESCRIPTION_TRUNCATION = 50;
