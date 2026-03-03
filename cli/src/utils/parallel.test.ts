import { describe, it, expect } from "vitest";
import { parallelMap } from "./parallel.js";

describe("parallelMap", () => {
  it("should return empty array for empty input", async () => {
    const result = await parallelMap([], async (x) => x * 2, 2);
    expect(result).toEqual([]);
  });

  it("should process single item", async () => {
    const result = await parallelMap([5], async (x) => x * 2, 1);
    expect(result).toEqual([10]);
  });

  it("should preserve order of results", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await parallelMap(
      items,
      async (x) => {
        // Add random delay to ensure order is preserved despite async timing
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
        return x * 2;
      },
      3,
    );
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("should respect concurrency limit", async () => {
    const concurrency = 2;
    let currentConcurrent = 0;
    let maxConcurrent = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await parallelMap(
      items,
      async (x) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return x * 2;
      },
      concurrency,
    );

    expect(maxConcurrent).toBeLessThanOrEqual(concurrency);
    expect(maxConcurrent).toBeGreaterThan(0);
  });

  it("should handle errors by propagating them", async () => {
    const items = [1, 2, 3];
    await expect(
      parallelMap(
        items,
        async (x) => {
          if (x === 2) throw new Error("Test error");
          return x * 2;
        },
        2,
      ),
    ).rejects.toThrow("Test error");
  });

  it("should process all items with concurrency 1", async () => {
    const items = [1, 2, 3, 4];
    const result = await parallelMap(items, async (x) => x * 3, 1);
    expect(result).toEqual([3, 6, 9, 12]);
  });

  it("should process all items with concurrency greater than array length", async () => {
    const items = [1, 2, 3];
    const result = await parallelMap(items, async (x) => x + 1, 10);
    expect(result).toEqual([2, 3, 4]);
  });

  it("should handle async function that returns promises", async () => {
    const items = ["a", "b", "c"];
    const result = await parallelMap(
      items,
      async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return x.toUpperCase();
      },
      2,
    );
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("should work with non-primitive types", async () => {
    interface Item {
      id: number;
      name: string;
    }
    const items: Item[] = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ];
    const result = await parallelMap(items, async (item) => ({ ...item, processed: true }), 2);
    expect(result).toEqual([
      { id: 1, name: "a", processed: true },
      { id: 2, name: "b", processed: true },
    ]);
  });

  it("should maintain correct concurrency with high load", async () => {
    const concurrency = 3;
    let currentConcurrent = 0;
    let maxConcurrent = 0;

    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = await parallelMap(
      items,
      async (x) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 5));
        currentConcurrent--;
        return x;
      },
      concurrency,
    );

    expect(result).toEqual(items);
    expect(maxConcurrent).toBeLessThanOrEqual(concurrency);
    expect(maxConcurrent).toBe(concurrency); // Should reach max concurrency
  });
});
