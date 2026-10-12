// background/cache.js
// LRU + TTL Cache stored in chrome.storage.local
// Separate Word Cache and Sentence Cache for optimal consistency and performance

export const WORD_CACHE_PREFIX = "cd_cache_word_v1_";
export const WORD_CACHE_INDEX_KEY = "cd_cache_word_index_v1";
export const MAX_WORD_CACHE_ENTRIES = 1000;

export const SENTENCE_CACHE_PREFIX = "cd_cache_sentence_v1_";
export const SENTENCE_CACHE_INDEX_KEY = "cd_cache_sentence_index_v1";
export const MAX_SENTENCE_CACHE_ENTRIES = 500;

export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Legacy keys for cleanup / migration
const LEGACY_CACHE_INDEX_KEY = "cd_cache_index_v2";

/**
 * Fast 32-bit integer string hash
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate deterministic cache key for a WORD in context
 */
export function generateWordCacheKey(word, sentence = "", pageTitle = "") {
  const normWord = (word || "").trim().toLowerCase();
  const normSentence = (sentence || "").trim().toLowerCase().slice(0, 150);
  const normTitle = (pageTitle || "").trim().toLowerCase().slice(0, 80);
  const raw = `${normWord}:::${normSentence}:::${normTitle}`;
  const slug = normWord.replace(/[^a-z0-9]/gi, "").slice(0, 16);
  return `${WORD_CACHE_PREFIX}${hashString(raw)}_${slug}`;
}

/**
 * Generate deterministic cache key for a whole SENTENCE or paragraph
 */
export function generateSentenceCacheKey(sentence, pageTitle = "") {
  const normSentence = (sentence || "").trim().toLowerCase().slice(0, 300);
  const normTitle = (pageTitle || "").trim().toLowerCase().slice(0, 80);
  const raw = `${normSentence}:::${normTitle}`;
  const slug = normSentence.replace(/[^a-z0-9]/gi, "").slice(0, 16);
  return `${SENTENCE_CACHE_PREFIX}${hashString(raw)}_${slug}`;
}

/**
 * Helper: Retrieve cached translation item with corruption check and TTL check
 */
async function getCachedItem(cacheKey, indexKey) {
  try {
    const result = await chrome.storage.local.get([cacheKey, indexKey]);
    const cachedItem = result[cacheKey];
    if (!cachedItem) return null;

    const now = Date.now();
    if (now - cachedItem.timestamp > (cachedItem.ttl || DEFAULT_TTL_MS)) {
      // Expired: remove key and update index
      await removeCachedItem(cacheKey, indexKey);
      return null;
    }

    // Discard corrupted cache entries
    if (
      cachedItem.data &&
      (typeof cachedItem.data.translation !== "string" ||
        cachedItem.data.translation.includes("```") ||
        cachedItem.data.translation.includes('"translation"') ||
        cachedItem.data.translation.toLowerCase().includes("không có bản dịch") ||
        (cachedItem.data.contextNote &&
          cachedItem.data.contextNote.includes("```")))
    ) {
      await removeCachedItem(cacheKey, indexKey);
      return null;
    }

    return cachedItem.data;
  } catch (err) {
    console.error(`[ContextDict Cache] Failed to read ${cacheKey}:`, err);
    return null;
  }
}

/**
 * Helper: Store translation item in cache with LRU eviction
 */
async function setCachedItem(cacheKey, indexKey, data, ttl, maxEntries) {
  try {
    const now = Date.now();
    const storeObj = {
      [cacheKey]: {
        timestamp: now,
        ttl: ttl || DEFAULT_TTL_MS,
        data,
      },
    };

    const result = await chrome.storage.local.get(indexKey);
    let index = result[indexKey] || [];

    // Remove if already exists and push to tail (most recently used)
    index = index.filter((k) => k !== cacheKey);
    index.push(cacheKey);

    // Evict oldest if exceeding limit
    if (index.length > maxEntries) {
      const toRemove = index.slice(0, index.length - maxEntries);
      index = index.slice(index.length - maxEntries);
      await chrome.storage.local.remove(toRemove);
    }

    storeObj[indexKey] = index;
    await chrome.storage.local.set(storeObj);
  } catch (err) {
    console.error(`[ContextDict Cache] Failed to write ${cacheKey}:`, err);
  }
}

/**
 * Helper: Remove an individual cache key and update its index
 */
async function removeCachedItem(cacheKey, indexKey) {
  try {
    if (!cacheKey) return false;
    await chrome.storage.local.remove(cacheKey);

    const result = await chrome.storage.local.get(indexKey);
    const index = result[indexKey] || [];
    if (index.includes(cacheKey)) {
      const updatedIndex = index.filter((k) => k !== cacheKey);
      await chrome.storage.local.set({ [indexKey]: updatedIndex });
    }
    return true;
  } catch (err) {
    console.error(`[ContextDict Cache] Failed to remove ${cacheKey}:`, err);
    return false;
  }
}

/**
 * Helper: Clear all cache entries tracked by an index
 */
async function clearCacheByIndex(indexKey) {
  try {
    const result = await chrome.storage.local.get(indexKey);
    const index = result[indexKey] || [];
    if (index.length > 0) {
      await chrome.storage.local.remove(index);
    }
    await chrome.storage.local.remove(indexKey);
    return true;
  } catch (err) {
    console.error(`[ContextDict Cache] Failed to clear index ${indexKey}:`, err);
    return false;
  }
}

// ==========================================
// 1. WORD CACHE APIS
// ==========================================

export async function getCachedWordTranslation(cacheKey) {
  return getCachedItem(cacheKey, WORD_CACHE_INDEX_KEY);
}

export async function setCachedWordTranslation(
  cacheKey,
  data,
  ttl = DEFAULT_TTL_MS,
) {
  return setCachedItem(
    cacheKey,
    WORD_CACHE_INDEX_KEY,
    data,
    ttl,
    MAX_WORD_CACHE_ENTRIES,
  );
}

export async function removeCachedWordTranslation(cacheKey) {
  return removeCachedItem(cacheKey, WORD_CACHE_INDEX_KEY);
}

export async function clearWordCache() {
  return clearCacheByIndex(WORD_CACHE_INDEX_KEY);
}

// ==========================================
// 2. SENTENCE CACHE APIS
// ==========================================

export async function getCachedSentenceTranslation(cacheKey) {
  return getCachedItem(cacheKey, SENTENCE_CACHE_INDEX_KEY);
}

export async function setCachedSentenceTranslation(
  cacheKey,
  data,
  ttl = DEFAULT_TTL_MS,
) {
  return setCachedItem(
    cacheKey,
    SENTENCE_CACHE_INDEX_KEY,
    data,
    ttl,
    MAX_SENTENCE_CACHE_ENTRIES,
  );
}

export async function removeCachedSentenceTranslation(cacheKey) {
  return removeCachedItem(cacheKey, SENTENCE_CACHE_INDEX_KEY);
}

export async function clearSentenceCache() {
  return clearCacheByIndex(SENTENCE_CACHE_INDEX_KEY);
}

// ==========================================
// 3. BACKWARD-COMPATIBLE FACADES
// ==========================================

/**
 * Backward-compatible facade for generateCacheKey
 */
export function generateCacheKey(word, sentence = "", pageTitle = "") {
  if (word && word.startsWith(SENTENCE_CACHE_PREFIX)) {
    return word;
  }
  if (!word && sentence) {
    return generateSentenceCacheKey(sentence, pageTitle);
  }
  return generateWordCacheKey(word, sentence, pageTitle);
}

/**
 * Backward-compatible facade for getCachedTranslation
 */
export async function getCachedTranslation(cacheKey) {
  if (!cacheKey) return null;
  if (cacheKey.startsWith(SENTENCE_CACHE_PREFIX)) {
    return getCachedSentenceTranslation(cacheKey);
  }
  // Try Word Cache first
  const wordResult = await getCachedWordTranslation(cacheKey);
  if (wordResult) return wordResult;

  // Fallback check in legacy index if present
  try {
    const legacy = await chrome.storage.local.get(cacheKey);
    return legacy[cacheKey]?.data || null;
  } catch (e) {
    return null;
  }
}

/**
 * Backward-compatible facade for setCachedTranslation
 */
export async function setCachedTranslation(
  cacheKey,
  data,
  ttl = DEFAULT_TTL_MS,
) {
  if (!cacheKey) return;
  if (cacheKey.startsWith(SENTENCE_CACHE_PREFIX) || data?.type === "sentence") {
    return setCachedSentenceTranslation(cacheKey, data, ttl);
  }
  return setCachedWordTranslation(cacheKey, data, ttl);
}

/**
 * Backward-compatible facade for removeCachedTranslation
 */
export async function removeCachedTranslation(cacheKey) {
  if (!cacheKey) return false;
  if (cacheKey.startsWith(SENTENCE_CACHE_PREFIX)) {
    return removeCachedSentenceTranslation(cacheKey);
  }
  return removeCachedWordTranslation(cacheKey);
}

/**
 * Clear both word cache, sentence cache, and any remaining legacy cache
 */
export async function clearCache() {
  try {
    const [wordOk, sentenceOk] = await Promise.all([
      clearWordCache(),
      clearSentenceCache(),
    ]);

    // Also purge legacy index if it exists
    await clearCacheByIndex(LEGACY_CACHE_INDEX_KEY);
    return wordOk && sentenceOk;
  } catch (err) {
    console.error("[ContextDict Cache] Failed to clear all caches:", err);
    return false;
  }
}

export const clearAllCaches = clearCache;

