import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  computeModelScore,
  recordModelAttempt,
  getModelStats,
  resetModelStats,
  MODEL_STATS_STORAGE_KEY,
} from "../../background/model-stats.js";

describe("model-stats computeModelScore", () => {
  it("should return neutral score and grade when 0 attempts have been made", () => {
    expect(computeModelScore(null)).toEqual({ score: 0, grade: "—", successRate: 0 });
    expect(computeModelScore({})).toEqual({ score: 0, grade: "—", successRate: 0 });
    expect(computeModelScore({ total: 0, success: 0 })).toEqual({ score: 0, grade: "—", successRate: 0 });
  });

  it("should award A+ grade for high success rate (100%) and fast latency (<800ms)", () => {
    const res = computeModelScore({
      total: 10,
      success: 10,
      avgLatencyMs: 650,
    });
    expect(res.successRate).toBe(100);
    expect(res.score).toBeGreaterThanOrEqual(95);
    expect(res.grade).toBe("A+");
  });

  it("should award A grade for 100% success with higher latency (2800ms)", () => {
    const res = computeModelScore({
      total: 10,
      success: 10,
      avgLatencyMs: 2800,
    });
    expect(res.successRate).toBe(100);
    expect(res.score).toBeGreaterThanOrEqual(85);
    expect(res.score).toBeLessThan(95);
    expect(res.grade).toBe("A");
  });

  it("should award B grade for 75% success rate with moderate latency", () => {
    const res = computeModelScore({
      total: 12,
      success: 9,
      avgLatencyMs: 2000,
    });
    expect(res.successRate).toBe(75);
    expect(res.score).toBeGreaterThanOrEqual(70);
    expect(res.score).toBeLessThan(85);
    expect(res.grade).toBe("B");
  });

  it("should award C grade for 60% success rate", () => {
    const res = computeModelScore({
      total: 10,
      success: 6,
      avgLatencyMs: 2500,
    });
    expect(res.successRate).toBe(60);
    expect(res.score).toBeGreaterThanOrEqual(50);
    expect(res.score).toBeLessThan(70);
    expect(res.grade).toBe("C");
  });

  it("should award F grade for low success rate (<35%)", () => {
    const res = computeModelScore({
      total: 10,
      success: 2,
      avgLatencyMs: 5000,
    });
    expect(res.successRate).toBe(20);
    expect(res.score).toBeLessThan(35);
    expect(res.grade).toBe("F");
  });
});

describe("model-stats storage and recording", () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            if (typeof keys === "string") {
              return { [keys]: mockStorage[keys] };
            }
            if (Array.isArray(keys)) {
              const res = {};
              for (const k of keys) {
                if (k in mockStorage) res[k] = mockStorage[k];
              }
              return res;
            }
            return { ...mockStorage };
          }),
          set: vi.fn(async (obj) => {
            Object.assign(mockStorage, obj);
          }),
          remove: vi.fn(async (keys) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) {
              delete mockStorage[k];
            }
          }),
        },
      },
    };
  });

  it("should record ping attempt and compute running average latency", async () => {
    const modelId = "google/gemma-4-26b-a4b-it:free";

    // 1st ping: 800ms success
    const res1 = await recordModelAttempt(modelId, { ok: true, latencyMs: 800, type: "ping" });
    expect(res1.total).toBe(1);
    expect(res1.success).toBe(1);
    expect(res1.failure).toBe(0);
    expect(res1.pings).toBe(1);
    expect(res1.translations).toBe(0);
    expect(res1.avgLatencyMs).toBe(800);
    expect(res1.successRate).toBe(100);

    // 2nd ping: 1200ms success
    const res2 = await recordModelAttempt(modelId, { ok: true, latencyMs: 1200, type: "ping" });
    expect(res2.total).toBe(2);
    expect(res2.success).toBe(2);
    expect(res2.pings).toBe(2);
    expect(res2.avgLatencyMs).toBe(1000); // (800 + 1200) / 2
  });

  it("should record translation attempts including failures and errors", async () => {
    const modelId = "nvidia/nemotron-3.5-lightning:free";

    // 1st translation: success
    await recordModelAttempt(modelId, { ok: true, latencyMs: 500, type: "translation" });
    // 2nd translation: failure with 429 rate limit
    const res = await recordModelAttempt(modelId, {
      ok: false,
      latencyMs: 1500,
      type: "translation",
      error: "Rate limit 429",
    });

    expect(res.total).toBe(2);
    expect(res.success).toBe(1);
    expect(res.failure).toBe(1);
    expect(res.translations).toBe(2);
    expect(res.pings).toBe(0);
    expect(res.successRate).toBe(50);
    expect(res.lastError).toContain("Rate limit 429");
  });

  it("should count both pings and translations in total score", async () => {
    const modelId = "thinkingmachines/inkling:free";

    // 2 pings (both ok)
    await recordModelAttempt(modelId, { ok: true, latencyMs: 600, type: "ping" });
    await recordModelAttempt(modelId, { ok: true, latencyMs: 700, type: "ping" });

    // 2 translations (1 ok, 1 fail)
    const finalRes = await recordModelAttempt(modelId, { ok: true, latencyMs: 800, type: "translation" });
    await recordModelAttempt(modelId, { ok: false, latencyMs: 2000, type: "translation", error: "Timeout" });

    const allStats = await getModelStats();
    const modelStat = allStats[modelId];

    expect(modelStat.total).toBe(4);
    expect(modelStat.success).toBe(3);
    expect(modelStat.failure).toBe(1);
    expect(modelStat.pings).toBe(2);
    expect(modelStat.translations).toBe(2);
    expect(modelStat.successRate).toBe(75);
    expect(modelStat.grade).toBe("B");
  });

  it("should reset stats for a specific model or all models", async () => {
    const m1 = "google/gemma-4-26b-a4b-it:free";
    const m2 = "google/gemma-4-31b-it:free";

    await recordModelAttempt(m1, { ok: true, latencyMs: 500, type: "ping" });
    await recordModelAttempt(m2, { ok: true, latencyMs: 600, type: "ping" });

    let stats = await getModelStats();
    expect(stats[m1]).toBeDefined();
    expect(stats[m2]).toBeDefined();

    // Reset only m1
    await resetModelStats(m1);
    stats = await getModelStats();
    expect(stats[m1]).toBeUndefined();
    expect(stats[m2]).toBeDefined();

    // Reset all
    await resetModelStats(null);
    expect(mockStorage[MODEL_STATS_STORAGE_KEY]).toBeUndefined();
  });
});
