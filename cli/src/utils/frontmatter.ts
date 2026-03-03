import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillFrontmatter, ValidationResult } from "../types.js";

const FM_DELIMITER = "---";
export const MIN_DESC_LENGTH = 80;
export const MAX_DESC_LENGTH = 1024;
export const NAME_REGEX = /^[a-z][a-z0-9-]*$/;

export function extractFrontmatter(content: string): { raw: string; body: string } | null {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== FM_DELIMITER) return null;

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === FM_DELIMITER) {
      endIdx = i;
      break;
    }
  }

  if (endIdx < 0) return null;

  const raw = lines.slice(1, endIdx).join("\n");
  const body = lines.slice(endIdx + 1).join("\n");
  return { raw, body };
}

export function parseFrontmatter(raw: string): SkillFrontmatter | null {
  let name = "";
  let description = "";

  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();
    const nameMatch = trimmed.match(/^name:\s*["']?(.+?)["']?\s*$/);
    if (nameMatch?.[1]) {
      name = nameMatch[1];
      name = name.replace(/^["']|["']$/g, "");
      continue;
    }
    const descMatch = trimmed.match(/^description:\s*(.*)$/);
    if (descMatch?.[1] !== undefined) {
      let value = descMatch[1].trim();
      // Handle YAML multiline: |, >, or bare indented continuation
      if (
        value === "|" ||
        value === ">" ||
        value === "|-" ||
        value === "|+" ||
        value === ">-" ||
        value === ">+" ||
        value === ""
      ) {
        const multilineLines: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j];
          if (next === undefined) break;
          // Empty lines: check if a subsequent indented line follows
          if (next === "") {
            let hasMore = false;
            for (let k = j + 1; k < lines.length; k++) {
              const peek = lines[k];
              if (peek === undefined || peek === "") continue;
              if (peek[0] === " " || peek[0] === "\t") hasMore = true;
              break;
            }
            if (hasMore) {
              multilineLines.push("");
              continue;
            }
            break;
          }
          // Continuation lines must be indented
          if (next[0] === " " || next[0] === "\t") {
            multilineLines.push(next.trim());
          } else {
            break;
          }
        }
        if (multilineLines.length > 0) {
          description = multilineLines.join(value === "|" ? "\n" : " ");
        }
      } else {
        value = value.replace(/^["']|["']$/g, "");
        description = value;
      }
    }
  }

  if (!name || !NAME_REGEX.test(name)) return null;
  return { name, description };
}

export function fixSkillFrontmatter(content: string): string {
  const extracted = extractFrontmatter(content);
  if (!extracted) return content;

  const parsed = parseFrontmatter(extracted.raw);
  if (!parsed) return content;

  // Rebuild clean frontmatter with only name and description
  const cleanFm = [FM_DELIMITER, `name: ${parsed.name}`, `description: ${parsed.description}`, FM_DELIMITER].join("\n");

  return cleanFm + "\n" + extracted.body.replace(/^\n+/, "\n");
}

export function validateSkillDir(skillDir: string, skillName: string): ValidationResult {
  const result: ValidationResult = {
    skill: skillName,
    valid: true,
    errors: [],
    warnings: [],
    infos: [],
  };

  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) {
    result.valid = false;
    result.errors.push("Missing SKILL.md");
    return result;
  }

  let content: string;
  try {
    content = readFileSync(skillMd, "utf-8");
  } catch {
    result.valid = false;
    result.errors.push("Cannot read SKILL.md");
    return result;
  }

  const extracted = extractFrontmatter(content);
  if (!extracted) {
    result.valid = false;
    result.errors.push("Missing or malformed frontmatter delimiters (---)");
    return result;
  }

  const parsed = parseFrontmatter(extracted.raw);
  if (!parsed) {
    result.valid = false;
    result.errors.push("Cannot parse name from frontmatter");
    return result;
  }

  if (!parsed.description) {
    result.valid = false;
    result.errors.push("Missing description in frontmatter");
  } else if (parsed.description.length < MIN_DESC_LENGTH) {
    result.valid = false;
    result.errors.push(`Description too short (${parsed.description.length} chars, minimum ${MIN_DESC_LENGTH})`);
  } else if (parsed.description.length > MAX_DESC_LENGTH) {
    result.valid = false;
    result.errors.push(`Description too long (${parsed.description.length} chars, max ${MAX_DESC_LENGTH})`);
  }

  // Check for non-standard fields (metadata is invalid per spec)
  const standardFields = ["name", "description"];
  const VALID_FIELDS = [
    "name",
    "description",
    "argument-hint",
    "compatibility",
    "disable-model-invocation",
    "license",
    "user-invokable",
  ];
  for (const line of extracted.raw.split("\n")) {
    const keyMatch = line.match(/^(\w[\w-]*):/);
    if (keyMatch?.[1] && !standardFields.includes(keyMatch[1])) {
      if (keyMatch[1] === "metadata") {
        result.warnings.push("Invalid field: metadata (not allowed in frontmatter)");
      } else if (!VALID_FIELDS.includes(keyMatch[1])) {
        result.infos.push(`Non-standard field: ${keyMatch[1]}`);
      } else {
        result.infos.push(`Optional field: ${keyMatch[1]}`);
      }
    }
  }

  if (parsed.name !== skillName) {
    result.warnings.push(`Name mismatch: frontmatter says "${parsed.name}", directory is "${skillName}"`);
  }

  if (parsed.description && (parsed.description.startsWith('"') || parsed.description.startsWith("'"))) {
    result.warnings.push("Description starts with a quote character (likely a YAML quoting issue)");
  }

  if (extracted.body.trim().length < 50) {
    result.warnings.push("SKILL.md body is very short (less than 50 chars)");
  }

  if (extracted.body.trim().length >= 50 && !extracted.body.includes("##")) {
    result.warnings.push("Body has no ## headings (required for structure)");
  }

  // Check for code blocks (quality signal)
  if (extracted.body.trim().length >= 50 && !extracted.body.includes("```")) {
    result.warnings.push("No code blocks found (skills must include code examples)");
  }

  // Check for BAD/GOOD pattern examples
  const hasPattern =
    /(?:BAD|GOOD|WRONG|RIGHT|AVOID|PREFER|DO NOT|INSTEAD)/i.test(extracted.body) ||
    /<!--\s*(?:bad|good)\s*-->/i.test(extracted.body);
  if (extracted.body.trim().length >= 100 && !hasPattern) {
    result.infos.push("No BAD/GOOD contrast patterns found (recommended for teaching)");
  }

  if (result.errors.length > 0) result.valid = false;

  return result;
}
