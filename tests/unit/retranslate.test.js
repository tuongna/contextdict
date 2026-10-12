import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateWordCacheKey,
  generateSentenceCacheKey,
  getCachedWordTranslation,
  setCachedWordTranslation,
  removeCachedWordTranslation,
  getCachedSentenceTranslation,
  setCachedSentenceTranslation,
  removeCachedSentenceTranslation,
  WORD_CACHE_INDEX_KEY,
  SENTENCE_CACHE_INDEX_KEY,
  clearAllCaches,
} from "../../background/cache.js";

describe("retranslate and cache eviction for separate word and sentence flows", () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            if (Array.isArray(keys)) {
              const res = {};
              for (const k of keys) {
                if (k in mockStorage) res[k] = mockStorage[k];
              }
              return res;
            }
            if (typeof keys === "string") {
              return { [keys]: mockStorage[keys] };
            }
            if (keys === null) {
              return { ...mockStorage };
            }
            return {};
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

  it("should remove word cached item and update word LRU index independently", async () => {
    const key1 = generateWordCacheKey("spring", "Spring is a season", "Weather");
    const key2 = generateWordCacheKey("autumn", "Leaves fall in autumn", "Weather");

    await setCachedWordTranslation(key1, { translation: "Mùa xuân" });
    await setCachedWordTranslation(key2, { translation: "Mùa thu" });

    // Verify both items cached in word index
    expect(await getCachedWordTranslation(key1)).toEqual({ translation: "Mùa xuân" });
    expect(await getCachedWordTranslation(key2)).toEqual({ translation: "Mùa thu" });

    const indexBefore = mockStorage[WORD_CACHE_INDEX_KEY];
    expect(indexBefore).toContain(key1);
    expect(indexBefore).toContain(key2);

    // Evict key1 (re-translate / bypass cache)
    const success = await removeCachedWordTranslation(key1);
    expect(success).toBe(true);

    // key1 must now be null (cache miss)
    expect(await getCachedWordTranslation(key1)).toBeNull();
    // key2 must remain intact
    expect(await getCachedWordTranslation(key2)).toEqual({ translation: "Mùa thu" });

    // Index must not contain key1 anymore
    const indexAfter = mockStorage[WORD_CACHE_INDEX_KEY];
    expect(indexAfter).not.toContain(key1);
    expect(indexAfter).toContain(key2);
  });

  it("should remove sentence cached item and update sentence LRU index independently", async () => {
    const sKey1 = generateSentenceCacheKey("Artificial intelligence is transforming society.", "Tech");
    const sKey2 = generateSentenceCacheKey("Deep learning models are scaling fast.", "Tech");

    await setCachedSentenceTranslation(sKey1, { translation: "Trí tuệ nhân tạo đang biến đổi xã hội." });
    await setCachedSentenceTranslation(sKey2, { translation: "Các mô hình học sâu đang mở rộng quy mô nhanh chóng." });

    expect(await getCachedSentenceTranslation(sKey1)).toEqual({
      translation: "Trí tuệ nhân tạo đang biến đổi xã hội.",
    });

    const indexBefore = mockStorage[SENTENCE_CACHE_INDEX_KEY];
    expect(indexBefore).toContain(sKey1);
    expect(indexBefore).toContain(sKey2);

    // Evict sentence 1
    const success = await removeCachedSentenceTranslation(sKey1);
    expect(success).toBe(true);

    expect(await getCachedSentenceTranslation(sKey1)).toBeNull();
    expect(await getCachedSentenceTranslation(sKey2)).not.toBeNull();

    const indexAfter = mockStorage[SENTENCE_CACHE_INDEX_KEY];
    expect(indexAfter).not.toContain(sKey1);
    expect(indexAfter).toContain(sKey2);
  });

  it("should ensure sentence cache and word cache do not interfere with each other", async () => {
    const wordKey = generateWordCacheKey("bank", "River bank", "Doc");
    const sentKey = generateSentenceCacheKey("River bank", "Doc");

    await setCachedWordTranslation(wordKey, { translation: "Bờ sông" });
    await setCachedSentenceTranslation(sentKey, { translation: "Bờ dòng sông" });

    expect(mockStorage[WORD_CACHE_INDEX_KEY]).toContain(wordKey);
    expect(mockStorage[SENTENCE_CACHE_INDEX_KEY]).toContain(sentKey);

    // Evict word only
    await removeCachedWordTranslation(wordKey);
    expect(await getCachedWordTranslation(wordKey)).toBeNull();
    // Sentence cache must remain completely intact
    expect(await getCachedSentenceTranslation(sentKey)).toEqual({ translation: "Bờ dòng sông" });
  });

  it("should correctly overwrite stale cache on retranslation", async () => {
    const key = generateWordCacheKey("bank", "He sat on the river bank", "Nature");

    await setCachedWordTranslation(key, { translation: "Ngân hàng" });
    expect(await getCachedWordTranslation(key)).toEqual({ translation: "Ngân hàng" });

    // Re-translation bypasses cache and removes stale entry
    await removeCachedWordTranslation(key);
    expect(await getCachedWordTranslation(key)).toBeNull();

    // Set updated translation
    await setCachedWordTranslation(key, {
      translation: "Bờ sông",
      contextNote: "Bờ đất dốc cạnh dòng nước",
    });

    const refreshed = await getCachedWordTranslation(key);
    expect(refreshed).toEqual({
      translation: "Bờ sông",
      contextNote: "Bờ đất dốc cạnh dòng nước",
    });
  });

  it("should clear both word and sentence caches when clearAllCaches is called", async () => {
    const wordKey = generateWordCacheKey("cat", "A cat", "Doc");
    const sentKey = generateSentenceCacheKey("A cat sat on the mat", "Doc");

    await setCachedWordTranslation(wordKey, { translation: "Con mèo" });
    await setCachedSentenceTranslation(sentKey, { translation: "Một con mèo ngồi trên chiếu" });

    await clearAllCaches();

    expect(await getCachedWordTranslation(wordKey)).toBeNull();
    expect(await getCachedSentenceTranslation(sentKey)).toBeNull();
    expect(mockStorage[WORD_CACHE_INDEX_KEY]).toBeUndefined();
    expect(mockStorage[SENTENCE_CACHE_INDEX_KEY]).toBeUndefined();
  });
});
