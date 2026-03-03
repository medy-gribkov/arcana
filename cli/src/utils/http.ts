import https from "node:https";

const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

export interface HttpResponse {
  body: string;
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "***";
    }
    for (const key of ["token", "access_token"]) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, "***");
    }
    return parsed.toString();
  } catch {
    return url.replace(/token=[^&]+/g, "token=***");
  }
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${statusCode} from ${sanitizeUrl(url)}`);
    this.name = "HttpError";
  }
}

export class RateLimitError extends HttpError {
  constructor(
    url: string,
    public readonly resetAt: Date | null,
  ) {
    const resetMsg = resetAt ? ` Resets at ${resetAt.toLocaleTimeString()}.` : "";
    super(403, url, `GitHub API rate limit exceeded.${resetMsg} Use GITHUB_TOKEN env var for higher limits.`);
    this.name = "RateLimitError";
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"]);
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function calcDelay(attempt: number): number {
  const exponential = Math.pow(2, attempt) * BASE_DELAY;
  const jitter = Math.random() * 200;
  return Math.min(exponential + jitter, 30000);
}

export async function httpGet(url: string, timeout = 15000): Promise<HttpResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(calcDelay(attempt - 1));

    try {
      const result = await doGet(url, timeout);

      // Rate limit check
      if (result.statusCode === 403) {
        const limit = result.headers["x-ratelimit-limit"];
        const remaining = result.headers["x-ratelimit-remaining"];
        if (limit && remaining === "0") {
          const resetHeader = result.headers["x-ratelimit-reset"];
          const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : null;
          throw new RateLimitError(url, resetAt);
        }
      }

      // Retry on retryable status
      if (RETRYABLE_STATUS.has(result.statusCode) && attempt < MAX_RETRIES) {
        lastError = new HttpError(result.statusCode, url);
        continue;
      }

      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new HttpError(result.statusCode, url);
      }

      return result;
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      if (err instanceof HttpError && !RETRYABLE_STATUS.has(err.statusCode)) throw err;

      const code = (err as NodeJS.ErrnoException).code;
      if (code && RETRYABLE_CODES.has(code) && attempt < MAX_RETRIES) {
        lastError = err as Error;
        continue;
      }

      if (attempt >= MAX_RETRIES && lastError) throw lastError;
      throw err;
    }
  }

  throw lastError ?? new Error(`Failed after ${MAX_RETRIES} retries: ${sanitizeUrl(url)}`);
}

function doGet(url: string, timeout: number, redirectCount = 0): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "User-Agent": "arcana-cli",
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      try {
        const hostname = new URL(url).hostname;
        if (
          hostname === "github.com" ||
          hostname.endsWith(".github.com") ||
          hostname.endsWith(".githubusercontent.com")
        ) {
          headers["Authorization"] = `token ${token}`;
        }
      } catch {
        /* invalid URL, skip auth */
      }
    }

    const req = https.get(url, { headers, timeout, agent }, (res) => {
      // Follow redirects (HTTPS only)
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        if (redirectCount >= 5) {
          reject(new Error(`Too many redirects (>5): ${sanitizeUrl(url)}`));
          return;
        }
        const location = res.headers.location;
        if (!location.startsWith("https://")) {
          reject(new Error(`Redirect to non-HTTPS URL blocked: ${sanitizeUrl(location)}`));
          return;
        }
        // After the existing https check, add:
        try {
          const redirectUrl = new URL(location);
          const allowedHosts = [
            "github.com",
            "raw.githubusercontent.com",
            "api.github.com",
            "objects.githubusercontent.com",
            "registry.npmjs.org",
          ];
          if (!allowedHosts.some((h) => redirectUrl.hostname === h || redirectUrl.hostname.endsWith("." + h))) {
            reject(new Error(`Redirect to untrusted host blocked: ${redirectUrl.hostname}`));
            return;
          }
        } catch {
          reject(new Error(`Invalid redirect URL: ${sanitizeUrl(location)}`));
          return;
        }
        doGet(location, timeout, redirectCount + 1).then(resolve, reject);
        return;
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      res.on("data", (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error(`Response exceeds ${MAX_BODY_SIZE} bytes from ${sanitizeUrl(url)}`));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolve({
          body: Buffer.concat(chunks).toString("utf-8"),
          statusCode: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeout}ms: ${sanitizeUrl(url)}`));
    });
  });
}
