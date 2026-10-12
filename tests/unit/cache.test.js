import { describe, it, expect } from "vitest";
import {
  generateCacheKey,
  generateWordCacheKey,
  generateSentenceCacheKey,
  WORD_CACHE_PREFIX,
  SENTENCE_CACHE_PREFIX,
} from "../../background/cache.js";

describe("cache keys separation", () => {
  it("should generate deterministic key for word inputs with WORD_CACHE_PREFIX", () => {
    const key1 = generateWordCacheKey("Apple", "I ate an apple.", "Nutrition Page");
    const key2 = generateWordCacheKey("apple", "I ate an apple.", "Nutrition Page");

    expect(key1).toBe(key2);
    expect(key1.startsWith(WORD_CACHE_PREFIX)).toBe(true);
    expect(WORD_CACHE_PREFIX).toBe("cd_cache_word_v1_");
  });

  it("should generate deterministic key for sentence inputs with SENTENCE_CACHE_PREFIX", () => {
    const sKey1 = generateSentenceCacheKey("Artificial intelligence is advancing.", "Tech Article");
    const sKey2 = generateSentenceCacheKey("  Artificial intelligence is advancing.  ", "Tech Article");

    expect(sKey1).toBe(sKey2);
    expect(sKey1.startsWith(SENTENCE_CACHE_PREFIX)).toBe(true);
    expect(SENTENCE_CACHE_PREFIX).toBe("cd_cache_sentence_v1_");
  });

  it("should keep word cache keys and sentence cache keys in distinct namespaces", () => {
    const text = "Hello world";
    const wordKey = generateWordCacheKey(text, text, "Context");
    const sentKey = generateSentenceCacheKey(text, "Context");

    expect(wordKey).not.toBe(sentKey);
    expect(wordKey.startsWith(WORD_CACHE_PREFIX)).toBe(true);
    expect(sentKey.startsWith(SENTENCE_CACHE_PREFIX)).toBe(true);
  });

  it("should route generateCacheKey facade correctly", () => {
    const wordKey = generateCacheKey("word", "a word in context", "doc");
    const sentKey = generateCacheKey("", "full sentence alone", "doc");

    expect(wordKey.startsWith(WORD_CACHE_PREFIX)).toBe(true);
    expect(sentKey.startsWith(SENTENCE_CACHE_PREFIX)).toBe(true);
  });

  it("should generate different keys for different words in same context", () => {
    const key1 = generateWordCacheKey("bank", "He deposited money in the bank.", "Finance");
    const key2 = generateWordCacheKey("money", "He deposited money in the bank.", "Finance");

    expect(key1).not.toBe(key2);
  });

  it("should handle empty or null values gracefully", () => {
    const key = generateCacheKey("", null, undefined);
    expect(typeof key).toBe("string");
  });
});
