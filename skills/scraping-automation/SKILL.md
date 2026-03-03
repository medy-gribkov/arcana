---
name: scraping-automation
description: Build resilient web scrapers with Playwright and Puppeteer, handle anti-detection, proxy rotation, and structured data extraction
user-invokable: true
argument-hint: "[url] [--headless] [--proxy] [--stealth]"
---

# Scraping Automation Skill

Build production-grade web scrapers with anti-detection, resilient extraction, and respectful crawling patterns.

## Browser Context and Stealth Mode

**BAD:** Default browser fingerprint exposes automation.

```typescript
// Detectable as bot, no stealth configuration
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
```

**GOOD:** Stealth mode with randomized fingerprints.

```typescript
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

const browser = await chromium.launch({
  headless: true,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox'
  ]
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
  permissions: ['geolocation'],
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  colorScheme: 'light'
});

const page = await context.newPage();
await page.goto('https://example.com', { waitUntil: 'networkidle' });
```

## Proxy Rotation and IP Management

**BAD:** Single IP for high-volume scraping triggers rate limits.

```python
# No proxy rotation, easy to block
async with async_playwright() as p:
    browser = await p.chromium.launch()
    page = await browser.new_page()
    for url in urls:
        await page.goto(url)  # Same IP for all requests
```

**GOOD:** Rotating proxies with session management.

```python
import random
from playwright.async_api import async_playwright

proxies = [
    {'server': 'http://proxy1.example.com:8080', 'username': 'user1', 'password': 'pass1'},
    {'server': 'http://proxy2.example.com:8080', 'username': 'user2', 'password': 'pass2'},
    {'server': 'http://proxy3.example.com:8080', 'username': 'user3', 'password': 'pass3'}
]

async def scrape_with_rotation(urls):
    async with async_playwright() as p:
        for url in urls:
            proxy = random.choice(proxies)
            browser = await p.chromium.launch(proxy=proxy)

            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={'width': random.randint(1366, 1920), 'height': random.randint(768, 1080)}
            )

            page = await context.new_page()
            try:
                await page.goto(url, timeout=30000)
                data = await extract_data(page)
                yield data
            finally:
                await browser.close()
```

## Resilient Selectors with Fallbacks

**BAD:** Hardcoded selectors break when page structure changes.

```typescript
// Brittle, fails if class names change
const title = await page.locator('.product-title-v2').textContent();
const price = await page.locator('#price_123').textContent();
```

**GOOD:** Multiple selector strategies with fallback chain.

```typescript
async function extractWithFallback(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        return await element.first().textContent();
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

const title = await extractWithFallback(page, [
  'h1[data-testid="product-title"]',
  '.product-title',
  'h1.title',
  '//h1[contains(@class, "product")]'
]);

const price = await extractWithFallback(page, [
  '[data-price]',
  '.price-current',
  'span:has-text("$")',
  '//span[contains(text(), "$")]'
]);
```

## Structured Data Extraction Pipeline

**BAD:** Inline extraction logic duplicated across scrapers.

```typescript
const products = [];
const items = await page.locator('.product-card').all();
for (const item of items) {
  products.push({
    title: await item.locator('.title').textContent(),
    price: await item.locator('.price').textContent()
  });
}
```

**GOOD:** Reusable extraction schema with validation.

```typescript
interface ExtractionSchema {
  fields: {
    [key: string]: {
      selectors: string[];
      transform?: (val: string) => any;
      required?: boolean;
    };
  };
  listSelector?: string;
}

async function extract(page, schema: ExtractionSchema) {
  const results = [];
  const containers = schema.listSelector
    ? await page.locator(schema.listSelector).all()
    : [page];

  for (const container of containers) {
    const item: any = {};

    for (const [key, config] of Object.entries(schema.fields)) {
      const value = await extractWithFallback(container, config.selectors);

      if (!value && config.required) {
        throw new Error(`Required field ${key} not found`);
      }

      item[key] = config.transform ? config.transform(value) : value;
    }

    results.push(item);
  }

  return results;
}

// Usage
const productSchema: ExtractionSchema = {
  listSelector: '.product-card',
  fields: {
    title: { selectors: ['h2.title', '.product-name'], required: true },
    price: {
      selectors: ['[data-price]', '.price'],
      transform: (v) => parseFloat(v.replace(/[^0-9.]/g, '')),
      required: true
    },
    rating: {
      selectors: ['.rating', '[data-rating]'],
      transform: (v) => parseFloat(v)
    },
    availability: { selectors: ['.stock-status', '[data-stock]'] }
  }
};

const products = await extract(page, productSchema);
```

## Pagination Handling

**BAD:** Manual URL construction misses dynamic pagination.

```typescript
// Assumes page=N pattern, breaks with AJAX pagination
for (let i = 1; i <= 10; i++) {
  await page.goto(`https://example.com/products?page=${i}`);
}
```

**GOOD:** Dynamic pagination detection with multiple strategies.

```typescript
async function scrapeAllPages(page, initialUrl, options = {}) {
  const { maxPages = 100, waitForSelector = 'body' } = options;
  const results = [];
  let currentPage = 1;

  await page.goto(initialUrl);

  while (currentPage <= maxPages) {
    await page.waitForSelector(waitForSelector);

    const pageData = await extract(page, productSchema);
    results.push(...pageData);

    // Try multiple pagination strategies
    let navigated = false;

    // Strategy 1: Next button
    const nextButton = page.locator('a:has-text("Next"), button:has-text("Next"), [aria-label="Next"]');
    if (await nextButton.count() > 0 && await nextButton.first().isEnabled()) {
      await nextButton.first().click();
      await page.waitForLoadState('networkidle');
      navigated = true;
    }

    // Strategy 2: Page number links
    if (!navigated) {
      const nextPageLink = page.locator(`a:has-text("${currentPage + 1}")`);
      if (await nextPageLink.count() > 0) {
        await nextPageLink.first().click();
        await page.waitForLoadState('networkidle');
        navigated = true;
      }
    }

    // Strategy 3: Infinite scroll
    if (!navigated) {
      const previousHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      navigated = newHeight > previousHeight;
    }

    if (!navigated) break;
    currentPage++;
  }

  return results;
}
```

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
