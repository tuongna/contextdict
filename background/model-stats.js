// background/model-stats.js
// Statistical tracking and scoring engine for AI models in ContextDict
// Tracks success rates, average latency, and pings vs translations per model.

import { logger } from "./logger.js";

export const MODEL_STATS_STORAGE_KEY = "cd_model_stats_v1";

/**
 * Compute composite score (0-100) and letter grade (A+, A, B, C, D, F) for a model
 *
 * @param {Object} statEntry
 * @returns {{ score: number, grade: string, successRate: number }}
 */
export function computeModelScore(statEntry) {
  if (!statEntry || typeof statEntry !== "object" || !statEntry.total || statEntry.total <= 0) {
    return { score: 0, grade: "—", successRate: 0 };
  }

  const total = statEntry.total;
  const success = Math.max(0, statEntry.success || 0);
  const successRate = Math.min(100, Math.max(0, Math.round((success / total) * 100)));

  // Calculate latency score (0 - 100)
  const avgLatency = statEntry.avgLatencyMs || 0;
  let latencyScore = 100;

  if (avgLatency <= 0) {
    latencyScore = 80; // neutral when no latency recorded
  } else if (avgLatency <= 800) {
    latencyScore = 100;
  } else if (avgLatency <= 2000) {
    latencyScore = Math.round(100 - ((avgLatency - 800) / 1200) * 20); // 100 -> 80
  } else if (avgLatency <= 4000) {
    latencyScore = Math.round(80 - ((avgLatency - 2000) / 2000) * 30);  // 80 -> 50
  } else if (avgLatency <= 8000) {
    latencyScore = Math.round(50 - ((avgLatency - 4000) / 4000) * 35);  // 50 -> 15
  } else {
    latencyScore = 10;
  }

  // Composite: 75% success rate + 25% latency factor
  const score = Math.min(100, Math.max(0, Math.round(successRate * 0.75 + latencyScore * 0.25)));

  let grade = "F";
  if (score >= 95) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";

  return { score, grade, successRate };
}

/**
 * Retrieve all model stats from storage.
 * Returns map: { [modelId]: ModelStatEntry }
 */
export async function getModelStats() {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return {};
    const result = await chrome.storage.local.get(MODEL_STATS_STORAGE_KEY);
    return result[MODEL_STATS_STORAGE_KEY] || {};
  } catch (err) {
    logger?.warn("ModelStats", "Failed to read model stats from storage", { error: err.message });
    return {};
  }
}

/**
 * Record a single request attempt for a model (ping or translation).
 * Atomically updates totals, success/failure counts, running average latency, and score.
 *
 * @param {string} modelId  Full model identifier (e.g. "google/gemma-4-26b-a4b-it:free")
 * @param {Object} options
 * @param {boolean} options.ok            Whether the attempt succeeded
 * @param {number} [options.latencyMs]    Response latency in milliseconds
 * @param {"ping"|"translation"} [options.type] Type of request attempt
 * @param {string|null} [options.error]   Error message if failed
 * @returns {Promise<Object>} Updated stat entry for this model
 */
export async function recordModelAttempt(modelId, { ok, latencyMs = null, type = "ping", error = null }) {
  if (!modelId || typeof modelId !== "string") return null;

  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return null;

    const allStats = await getModelStats();
    const prev = allStats[modelId] || {
      total: 0,
      success: 0,
      failure: 0,
      pings: 0,
      translations: 0,
      latencyCount: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
    };

    const isOk = Boolean(ok);
    const newTotal = (prev.total || 0) + 1;
    const newSuccess = (prev.success || 0) + (isOk ? 1 : 0);
    const newFailure = (prev.failure || 0) + (isOk ? 0 : 1);
    const newPings = (prev.pings || 0) + (type === "ping" ? 1 : 0);
    const newTranslations = (prev.translations || 0) + (type === "translation" ? 1 : 0);

    let latencyCount = prev.latencyCount || 0;
    let totalLatencyMs = prev.totalLatencyMs || 0;
    let avgLatencyMs = prev.avgLatencyMs || 0;

    if (typeof latencyMs === "number" && latencyMs >= 0) {
      latencyCount += 1;
      totalLatencyMs += latencyMs;
      avgLatencyMs = Math.round(totalLatencyMs / latencyCount);
    }

    const tempEntry = {
      total: newTotal,
      success: newSuccess,
      avgLatencyMs,
    };
    const { score, grade, successRate } = computeModelScore(tempEntry);

    const updatedEntry = {
      modelId,
      total: newTotal,
      success: newSuccess,
      failure: newFailure,
      successRate,
      avgLatencyMs,
      totalLatencyMs,
      latencyCount,
      pings: newPings,
      translations: newTranslations,
      lastTested: Date.now(),
      lastError: isOk ? null : (error ? String(error).slice(0, 150) : "Lỗi không xác định"),
      score,
      grade,
    };

    allStats[modelId] = updatedEntry;
    await chrome.storage.local.set({ [MODEL_STATS_STORAGE_KEY]: allStats });

    logger?.debug("ModelStats", `Recorded ${type} for ${modelId}: ${isOk ? "OK" : "FAIL"} (${newSuccess}/${newTotal} = ${successRate}%, Grade: ${grade})`);
    return updatedEntry;
  } catch (err) {
    logger?.warn("ModelStats", `Failed to record model attempt for ${modelId}`, { error: err.message });
    return null;
  }
}

/**
 * Reset statistics for all models or for a specific model
 *
 * @param {string|null} [modelId] If specified, only resets this model. If null, resets all.
 */
export async function resetModelStats(modelId = null) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return true;

    if (!modelId) {
      await chrome.storage.local.remove(MODEL_STATS_STORAGE_KEY);
      logger?.info("ModelStats", "All model statistics reset successfully.");
      return true;
    }

    const allStats = await getModelStats();
    if (allStats[modelId]) {
      delete allStats[modelId];
      await chrome.storage.local.set({ [MODEL_STATS_STORAGE_KEY]: allStats });
      logger?.info("ModelStats", `Statistics for model "${modelId}" reset successfully.`);
    }
    return true;
  } catch (err) {
    logger?.warn("ModelStats", "Failed to reset model stats", { error: err.message });
    return false;
  }
}
