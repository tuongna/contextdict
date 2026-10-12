// background/model-health.js
// Model Health Check & Smart Failover for ContextDict
// Periodically pings free AI models to detect availability before translation requests

import { logger } from "./logger.js";
import {
  recordModelAttempt,
  getModelStats,
  resetModelStats,
  computeModelScore,
  MODEL_STATS_STORAGE_KEY,
} from "./model-stats.js";

export {
  recordModelAttempt,
  getModelStats,
  resetModelStats,
  computeModelScore,
  MODEL_STATS_STORAGE_KEY,
};

const HEALTH_STORAGE_KEY = "cd_model_health_v1";
export const HEALTH_TTL_MS = 15 * 60 * 1000; // 15 minutes validity per check result
const PING_TIMEOUT_MS = 8000; // 8s ping timeout per model
const PING_PROMPT = "Hi"; // Minimal prompt to minimize token cost & latency
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * All free text models tracked by ContextDict health monitor.
 * Ordered by preference (quality + reliability).
 * Updated from live OpenRouter API — 2026-09-17.
 */
export const ALL_FREE_MODELS = [
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Gemma 4 26B MoE",
    provider: "Google",
    contextK: 262,
    tier: "primary",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    provider: "Google",
    contextK: 262,
    tier: "primary",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    provider: "NVIDIA",
    contextK: 1000,
    tier: "fast",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super 120B",
    provider: "NVIDIA",
    contextK: 262,
    tier: "quality",
  },
  {
    id: "thinkingmachines/inkling:free",
    name: "Inkling",
    provider: "Thinking Machines",
    contextK: 1048,
    tier: "quality",
  },
  {
    id: "nex-agi/nex-n2.5-pro:free",
    name: "Nex-N2.5 Pro",
    provider: "Nex AGI",
    contextK: 262,
    tier: "secondary",
  },
  {
    id: "nex-agi/nex-n2.5-mini:free",
    name: "Nex-N2.5 Mini",
    provider: "Nex AGI",
    contextK: 262,
    tier: "secondary",
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LFM 2.5 2.6B",
    provider: "LiquidAI",
    contextK: 65,
    tier: "fallback",
  },
  {
    id: "z-ai/glm-5.2:free",
    name: "GLM 5.2",
    provider: "Z.ai",
    contextK: 32,
    tier: "fallback",
  },
];

/**
 * Quick-ranked IDs for the fallback chain (top 5 non-fallback tier)
 */
export const FALLBACK_FREE_MODEL_IDS = ALL_FREE_MODELS.filter(
  (m) => m.tier !== "fallback",
)
  .map((m) => m.id)
  .slice(0, 5);

/**
 * Ping a single model with a minimal request to check availability & latency.
 * Returns { ok, latencyMs, error? }
 */
export async function pingModel(apiKey, modelId) {
  if (!apiKey || !modelId)
    return { ok: false, latencyMs: null, error: "Missing apiKey or modelId" };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const startTime = performance.now();

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "HTTP-Referer": "https://contextdict.extension",
        "X-Title": "ContextDict Chrome Extension",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: PING_PROMPT }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (response.ok) {
      logger.debug("Health", `✅ Ping OK: ${modelId} (${latencyMs}ms)`);
      await recordModelAttempt(modelId, { ok: true, latencyMs, type: "ping" });
      return { ok: true, latencyMs };
    }

    const errData = await response.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
    logger.warn(
      "Health",
      `❌ Ping FAIL: ${modelId} — ${errMsg} (${latencyMs}ms)`,
    );
    await recordModelAttempt(modelId, { ok: false, latencyMs, type: "ping", error: errMsg });
    return { ok: false, latencyMs, error: errMsg, status: response.status };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);
    const isTimeout = err.name === "AbortError";
    const finalLatency = isTimeout ? PING_TIMEOUT_MS : latencyMs;
    const finalErr = isTimeout ? "Ping timeout" : err.message;
    logger.warn(
      "Health",
      `❌ Ping ${isTimeout ? "TIMEOUT" : "ERROR"}: ${modelId} (${finalLatency}ms)`,
      { error: err.message },
    );
    await recordModelAttempt(modelId, { ok: false, latencyMs: finalLatency, type: "ping", error: finalErr });
    return {
      ok: false,
      latencyMs: finalLatency,
      error: finalErr,
    };
  }
}

/**
 * Load current health status from storage.
 * Returns map: { [modelId]: { ok, latencyMs, lastChecked, error? } }
 */
export async function getHealthStatus() {
  try {
    const result = await chrome.storage.local.get(HEALTH_STORAGE_KEY);
    return result[HEALTH_STORAGE_KEY] || {};
  } catch (err) {
    logger.warn("Health", "Failed to read health status from storage", {
      error: err.message,
    });
    return {};
  }
}

/**
 * Save health status map to storage.
 */
async function saveHealthStatus(statusMap) {
  try {
    await chrome.storage.local.set({ [HEALTH_STORAGE_KEY]: statusMap });
  } catch (err) {
    logger.warn("Health", "Failed to save health status", {
      error: err.message,
    });
  }
}

/**
 * Run a full health check cycle on all free models (or a subset).
 * Pings models in parallel with a concurrency cap of 3.
 * Updates and persists the health status map.
 *
 * @param {string} apiKey  OpenRouter API key
 * @param {string[]} [modelIds]  Optional subset; defaults to ALL_FREE_MODELS
 * @returns {Object} Updated health status map
 */
export async function runHealthCheck(apiKey, modelIds = null) {
  if (!apiKey) {
    logger.warn("Health", "Health check skipped: no API key");
    return {};
  }

  const targets = modelIds
    ? ALL_FREE_MODELS.filter((m) => modelIds.includes(m.id))
    : ALL_FREE_MODELS;

  logger.info(
    "Health",
    `Starting health check for ${targets.length} models...`,
  );

  const currentStatus = await getHealthStatus();
  const now = Date.now();

  // Ping in batches of 3 to avoid rate-limit cascade
  const BATCH_SIZE = 3;
  const updatedStatus = { ...currentStatus };

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (model) => {
        const result = await pingModel(apiKey, model.id);
        return { id: model.id, ...result };
      }),
    );

    for (const res of results) {
      updatedStatus[res.id] = {
        ok: res.ok,
        latencyMs: res.latencyMs,
        lastChecked: now,
        error: res.error || null,
      };
    }

    // Small pause between batches
    if (i + BATCH_SIZE < targets.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  await saveHealthStatus(updatedStatus);

  const okCount = Object.values(updatedStatus).filter((s) => s.ok).length;
  logger.info(
    "Health",
    `Health check complete: ${okCount}/${targets.length} models available`,
  );

  return updatedStatus;
}

/**
 * Get the best currently available model, preferring the user's chosen model.
 * Falls back through FALLBACK_FREE_MODEL_IDS if the primary is unhealthy.
 *
 * @param {string} preferredModel  User's configured model ID
 * @returns {string} Best available model ID (always returns something)
 */
export async function getBestAvailableModel(preferredModel) {
  const status = await getHealthStatus();
  const now = Date.now();

  function isHealthy(modelId) {
    const s = status[modelId];
    if (!s) return null; // Unknown — no health data yet
    if (now - s.lastChecked > HEALTH_TTL_MS) return null; // Stale
    return s.ok;
  }

  // Try preferred model first
  const preferredHealth = isHealthy(preferredModel);
  if (preferredHealth === true) return preferredModel;
  if (preferredHealth === null) return preferredModel; // No data — optimistic

  // Preferred is known-bad, find best healthy fallback by latency
  const candidates = FALLBACK_FREE_MODEL_IDS.filter(
    (id) => id !== preferredModel,
  )
    .map((id) => ({ id, health: status[id] }))
    .filter(
      ({ health }) =>
        health && now - health.lastChecked <= HEALTH_TTL_MS && health.ok,
    )
    .sort(
      (a, b) => (a.health.latencyMs || 9999) - (b.health.latencyMs || 9999),
    );

  if (candidates.length > 0) {
    const best = candidates[0].id;
    logger.info(
      "Health",
      `Smart failover: "${preferredModel}" unhealthy → using "${best}"`,
    );
    return best;
  }

  // All known bad or no data — use preferred optimistically
  logger.warn(
    "Health",
    `All models unhealthy or unknown, using preferred: "${preferredModel}"`,
  );
  return preferredModel;
}

/**
 * Returns whether health data for a model is fresh (within TTL).
 */
export function isHealthDataFresh(modelId, statusMap) {
  const s = statusMap[modelId];
  if (!s) return false;
  return Date.now() - s.lastChecked <= HEALTH_TTL_MS;
}

/**
 * Returns the fallback free models dynamically sorted by health status and latency.
 */
export async function getSortedFallbackModels(excludeModel = null) {
  const status = await getHealthStatus();
  const now = Date.now();
  
  return FALLBACK_FREE_MODEL_IDS.filter(id => id !== excludeModel)
    .map(id => ({ id, health: status[id] }))
    .sort((a, b) => {
      const aOk = a.health?.ok && now - a.health.lastChecked <= HEALTH_TTL_MS;
      const bOk = b.health?.ok && now - b.health.lastChecked <= HEALTH_TTL_MS;
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      const aLat = a.health?.latencyMs || 9999;
      const bLat = b.health?.latencyMs || 9999;
      return aLat - bLat;
    })
    .map(c => c.id);
}
