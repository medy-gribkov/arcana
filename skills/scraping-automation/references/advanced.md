# Scraping Automation - Advanced Patterns

## Rate Limiting and Politeness

**BAD:** No delays or robots.txt respect, hammers servers.

```python
# Aggressive scraping violates ToS and gets blocked
for url in urls:
    await page.goto(url)
    data = await extract(page)
```

**GOOD:** Respectful crawling with robots.txt and adaptive delays.

```python
import asyncio
import random
from urllib.robotparser import RobotFileParser

class PoliteScraper:
    def __init__(self, base_url, delay_range=(2, 5)):
        self.base_url = base_url
        self.delay_range = delay_range
        self.robot_parser = RobotFileParser()
        self.robot_parser.set_url(f"{base_url}/robots.txt")
        self.robot_parser.read()

    def can_fetch(self, url):
        return self.robot_parser.can_fetch("*", url)

    async def polite_delay(self):
        delay = random.uniform(*self.delay_range)
        await asyncio.sleep(delay)

    async def scrape(self, urls):
        results = []

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            for url in urls:
                if not self.can_fetch(url):
                    print(f"Skipping {url} (disallowed by robots.txt)")
                    continue

                await self.polite_delay()

                try:
                    await page.goto(url, wait_until='networkidle', timeout=30000)
                    data = await extract_data(page)
                    results.append(data)
                except Exception as e:
                    print(f"Error scraping {url}: {e}")

            await browser.close()

        return results
```

## Retry with Exponential Backoff

**BAD:** No retry logic, fails on transient errors.

```typescript
await page.goto(url); // Fails permanently on timeout or 500 error
```

**GOOD:** Resilient retry with exponential backoff and error classification.

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryableErrors = [/timeout/i, /503/, /502/, /ECONNRESET/]
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = retryableErrors.some(pattern =>
        pattern.test(error.message)
      );

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = delay * 0.1 * Math.random();

      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay + jitter}ms`);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
}

// Usage
const data = await retryWithBackoff(
  async () => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    return await extract(page, schema);
  },
  { maxRetries: 5, baseDelay: 2000 }
);
```

## Output Formats and Storage

**BAD:** Unstructured console output, no data persistence.

```typescript
console.log(await page.textContent('body')); // Lost after script ends
```

**GOOD:** Structured output with multiple format support.

```typescript
import fs from 'fs/promises';
import { stringify } from 'csv-stringify/sync';

interface OutputOptions {
  format: 'json' | 'csv' | 'jsonl';
  filePath: string;
  append?: boolean;
}

async function saveResults(data: any[], options: OutputOptions) {
  let content: string;

  switch (options.format) {
    case 'json':
      content = JSON.stringify(data, null, 2);
      break;

    case 'csv':
      content = stringify(data, { header: true });
      break;

    case 'jsonl':
      content = data.map(item => JSON.stringify(item)).join('\n');
      break;
  }

  if (options.append) {
    await fs.appendFile(options.filePath, content + '\n');
  } else {
    await fs.writeFile(options.filePath, content);
  }
}

// Usage
await saveResults(products, {
  format: 'json',
  filePath: './output/products.json'
});

await saveResults(products, {
  format: 'csv',
  filePath: './output/products.csv'
});
```

## Headless vs Headed Debugging

**BAD:** Always headless, difficult to debug selector issues.

```typescript
const browser = await chromium.launch({ headless: true }); // Can't see what's happening
```

**GOOD:** Environment-based mode switching with debugging tools.

```typescript
const DEBUG = process.env.DEBUG === 'true';
const SLOW_MO = parseInt(process.env.SLOW_MO || '0');

const browser = await chromium.launch({
  headless: !DEBUG,
  slowMo: SLOW_MO,
  devtools: DEBUG
});

if (DEBUG) {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url()));
}

// Run with: DEBUG=true SLOW_MO=100 npm run scrape
```

## Playwright vs Puppeteer Comparison

```typescript
// Playwright: Multi-browser, modern API, better selectors
import { chromium, firefox, webkit } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Built-in waiting and auto-retry
await page.locator('button').click(); // Waits until actionable

// Cross-browser testing
for (const browserType of [chromium, firefox, webkit]) {
  const browser = await browserType.launch();
  // Test in all browsers
}

// Puppeteer: Chrome-only, lighter weight, established ecosystem
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();

// Manual waiting required
await page.waitForSelector('button');
await page.click('button');

// Use Playwright for: Multi-browser testing, modern syntax, resilient selectors
// Use Puppeteer for: Chrome-only, smaller bundle size, mature plugins
```

## Complete Production Scraper Example

```typescript
import { chromium } from 'playwright';
import { PoliteScraper } from './polite-scraper';
import { retryWithBackoff } from './retry';
import { saveResults } from './output';

async function scrapeProductCatalog(baseUrl: string) {
  const scraper = new PoliteScraper(baseUrl, { delay: [3, 7] });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    const allProducts = await retryWithBackoff(
      async () => await scrapeAllPages(page, `${baseUrl}/products`, {
        maxPages: 50,
        waitForSelector: '.product-card'
      }),
      { maxRetries: 5 }
    );

    await saveResults(allProducts, {
      format: 'json',
      filePath: './output/products.json'
    });

    await saveResults(allProducts, {
      format: 'csv',
      filePath: './output/products.csv'
    });

    return { success: true, count: allProducts.length };
  } finally {
    await browser.close();
  }
}

// Run scraper
scrapeProductCatalog('https://example.com')
  .then(result => console.log(`Scraped ${result.count} products`))
  .catch(err => console.error('Scraper failed:', err));
```
