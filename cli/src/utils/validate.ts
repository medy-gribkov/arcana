const VALID_SLUG = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
const MAX_SLUG_LENGTH = 128;

export function validateSlug(value: string, label: string): void {
  if (value.length > MAX_SLUG_LENGTH) {
    throw new Error(`Invalid ${label}: "${value.slice(0, 20)}..." exceeds max length of ${MAX_SLUG_LENGTH} characters.`);
  }
  if (!VALID_SLUG.test(value)) {
    throw new Error(`Invalid ${label}: "${value}". Only letters, numbers, hyphens, dots, underscores allowed.`);
  }
}
