import { describe, it, expect, beforeEach } from "vitest";
import { PerformanceOptimizer } from "../performance-optimizer";

describe("PerformanceOptimizer", () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10000,
        ttl: 1000,
        strategy: "LRU",
      },
      monitoring: {
        metricsInterval: 100000, // Disable automatic monitoring for tests
        alertThresholds: {
          responseTime: 1000,
          errorRate: 0.05,
          memoryUsage: 0.8,
        },
      },
    });
  });

  it("should set and get values correctly", () => {
    optimizer.set("key1", "value1");
    expect(optimizer.get("key1")).toBe("value1");
  });

  it("should evict values based on LRU strategy", () => {
    // Re-initialize with small cache size
    optimizer = new PerformanceOptimizer({
      cache: { maxSize: 2, ttl: 1000, strategy: "LRU" },
    });

    optimizer.set("a", 1);
    optimizer.set("b", 2);
    optimizer.get("a"); // Access 'a' to make it recently used
    optimizer.set("c", 3); // Should evict 'b'

    expect(optimizer.get("a")).toBe(1);
    expect(optimizer.get("b")).toBeNull();
    expect(optimizer.get("c")).toBe(3);
  });

  it("should measure performance of set and updateMetrics", () => {
    const itemCount = 10000;

    // Measure set performance
    const startSet = performance.now();
    for (let i = 0; i < itemCount; i++) {
      optimizer.set(`key-${i}`, i);
    }
    const endSet = performance.now();
    process.stdout.write(`PERF_METRIC: set_time=${endSet - startSet}ms\n`);

    const startMetrics = performance.now();
    (optimizer as any).updateMetrics();
    const endMetrics = performance.now();
    process.stdout.write(
      `PERF_METRIC: update_metrics_time=${endMetrics - startMetrics}ms\n`,
    );

    expect(endSet - startSet).toBeGreaterThan(0);
    expect(endMetrics - startMetrics).toBeGreaterThanOrEqual(0);
  });
});
