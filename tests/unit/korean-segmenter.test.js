import { describe, it, expect } from "vitest";

describe("Korean and English language detection & text helpers", () => {
  function detectTextLocale(text, defaultDocLang = "en") {
    if (text && /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(text)) {
      return "ko";
    }
    return defaultDocLang;
  }

  it("should detect 'ko' for Korean text even when page language is 'en'", () => {
    const koreanComment = "왜 저만 남겨두고 가셨나요?";
    expect(detectTextLocale(koreanComment, "en")).toBe("ko");
  });

  it("should keep 'en' for English text", () => {
    const englishSentence = "Why did you leave me alone?";
    expect(detectTextLocale(englishSentence, "en")).toBe("en");
  });

  it("should segment Korean sentences with Intl.Segmenter using 'ko' locale", () => {
    const text = "왜 저만 남겨두고 가셨나요? 저도 같이 가고 싶었어요.";
    const segmenter = new Intl.Segmenter("ko", { granularity: "sentence" });
    const segments = [...segmenter.segment(text)].map((s) => s.segment.trim());

    expect(segments.length).toBe(2);
    expect(segments[0]).toBe("왜 저만 남겨두고 가셨나요?");
    expect(segments[1]).toBe("저도 같이 가고 싶었어요.");
  });

  it("should match single Korean syllables with Unicode letter regex", () => {
    const WORD_CHAR_REGEXP = /^[\p{L}\p{N}'.-]$/u;
    expect(WORD_CHAR_REGEXP.test("왜")).toBe(true);
    expect(WORD_CHAR_REGEXP.test("말")).toBe(true);
    expect(WORD_CHAR_REGEXP.test("a")).toBe(true);
    expect(WORD_CHAR_REGEXP.test(" ")).toBe(false);
    expect(WORD_CHAR_REGEXP.test("?")).toBe(false);
  });
});
