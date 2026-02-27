const VALID_SLUG = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

export function validateSlug(value: string, label: string): void {
  if (!VALID_SLUG.test(value)) {
    throw new Error(`Invalid ${label}: "${value}". Only letters, numbers, hyphens, dots, underscores allowed.`);
  }
}
