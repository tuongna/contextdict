import { describe, it, expect } from "vitest";
import {
  validateTranslationOutput,
  validateWordOutput,
  validateSentenceOutput,
  sanitizeField,
  isPromptPlaceholder,
  isAiRefusal,
  romanizeHangul,
} from "../../background/output-validator.js";

describe("output-validator sanitizeField", () => {
  it("should strip markdown code fences", () => {
    const raw = "```json\nXin chào\n```";
    expect(sanitizeField(raw)).toBe("Xin chào");
  });

  it("should strip leaked JSON key-value prefix", () => {
    const raw = '"translation": "Thành công"';
    expect(sanitizeField(raw)).toBe("Thành công");
  });

  it("should handle null and undefined gracefully", () => {
    expect(sanitizeField(null)).toBe("");
    expect(sanitizeField(undefined)).toBe("");
  });
});

describe("output-validator prompt placeholder detection", () => {
  it("should detect common system prompt instruction echoes", () => {
    expect(
      isPromptPlaceholder("Bản dịch tiếng Việt chính xác và tự nhiên"),
    ).toBe(true);
    expect(
      isPromptPlaceholder(
        "Bản dịch tiếng Việt hoàn chỉnh và tự nhiên của cả đoạn văn/câu",
      ),
    ).toBe(true);
    expect(isPromptPlaceholder("từ nguyên thể (Dictionary form)")).toBe(true);
    expect(isPromptPlaceholder("để trống nếu nghĩa đã rõ")).toBe(true);
    expect(isPromptPlaceholder("Không có bản dịch")).toBe(true);
  });

  it("should not falsely flag valid translations", () => {
    expect(isPromptPlaceholder("Xin chào")).toBe(false);
    expect(isPromptPlaceholder("Tại sao bạn lại rời đi?")).toBe(false);
    expect(isPromptPlaceholder("Mô hình trí tuệ nhân tạo")).toBe(false);
  });
});

describe("output-validator AI refusal detection", () => {
  it("should detect AI refusal and error prefixes", () => {
    expect(isAiRefusal("I am sorry, but I cannot translate this text.")).toBe(
      true,
    );
    expect(isAiRefusal("As an AI language model, I cannot fulfill...")).toBe(
      true,
    );
    expect(isAiRefusal("Tôi không thể dịch câu này.")).toBe(true);
    expect(isAiRefusal('{"error": "rate_limit_exceeded"}')).toBe(true);
  });

  it("should not flag normal translations", () => {
    expect(isAiRefusal("Tôi đi học")).toBe(false);
    expect(isAiRefusal("Hôm nay trời đẹp")).toBe(false);
  });
});

describe("output-validator validateTranslationOutput", () => {
  it("should accept valid English translation output", () => {
    const raw = {
      word: "hello",
      language: "en",
      translation: "Xin chào",
      phonetic: "/həˈloʊ/",
      partOfSpeech: "thán từ",
      contextNote: "Lời chào phổ biến",
      sentenceTranslation: "Xin chào thế giới",
    };

    const res = validateTranslationOutput(raw, { expectedWord: "hello" });
    expect(res.isValid).toBe(true);
    expect(res.data.word).toBe("hello");
    expect(res.data.translation).toBe("Xin chào");
    expect(res.data.language).toBe("en");
  });

  it("should accept valid Korean translation output and preserve originalForm", () => {
    const raw = {
      word: "가셨나요",
      language: "ko",
      originalForm: "가다",
      translation: "Đã đi rồi sao",
      phonetic: "gayeossnayo",
      partOfSpeech: "động từ",
      contextNote: "Đuôi câu kính ngữ",
      sentenceTranslation: "Sao bạn lại đi rồi?",
    };

    const res = validateTranslationOutput(raw, { expectedWord: "가셨나요" });
    expect(res.isValid).toBe(true);
    expect(res.data.language).toBe("ko");
    expect(res.data.originalForm).toBe("가다");
    expect(res.data.translation).toBe("Đã đi rồi sao");
  });

  it("should reject output if translation is missing or empty", () => {
    const raw = {
      word: "test",
      translation: "",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain("Missing or empty");
  });

  it("should reject output if translation is an AI refusal", () => {
    const raw = {
      word: "test",
      translation: "I'm sorry, I cannot translate this offensive content.",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain("AI refusal");
  });

  it("should reject output if translation repeats system prompt placeholder", () => {
    const raw = {
      word: "test",
      translation: "Bản dịch tiếng Việt chính xác và tự nhiên",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain("prompt instruction echo");
  });

  it("should gracefully clear prompt placeholder in secondary fields instead of invalidating", () => {
    const raw = {
      word: "hello",
      translation: "Xin chào",
      contextNote: "để trống nếu nghĩa đã rõ",
      sentenceTranslation: "để trống",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(true);
    expect(res.data.translation).toBe("Xin chào");
    expect(res.data.contextNote).toBe("");
    expect(res.data.sentenceTranslation).toBe("");
  });

  it("should auto-detect language as 'ko' when word has Hangul even if language is omitted", () => {
    const raw = {
      word: "왜",
      translation: "Tại sao",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(true);
    expect(res.data.language).toBe("ko");
  });

  it("should automatically convert Hangul in phonetic to Latin Romaja for Korean", () => {
    const raw = {
      word: "가셨나요",
      language: "ko",
      translation: "Đã đi rồi sao",
      phonetic: "[가셛나요]",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(true);
    expect(res.data.phonetic).toBe("gasyeonnayo");
    // Ensure no Hangul characters remain in phonetic
    expect(/[\uAC00-\uD7AF]/.test(res.data.phonetic)).toBe(false);
  });

  it("should generate Latin Romaja phonetic from Korean word if phonetic is omitted", () => {
    const raw = {
      word: "한국어",
      language: "ko",
      translation: "Tiếng Hàn",
      phonetic: "",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(true);
    expect(res.data.phonetic).toBe("hangugeo");
  });

  it("should preserve already Latin phonetic for Korean without modification", () => {
    const raw = {
      word: "안녕하세요",
      language: "ko",
      translation: "Xin chào",
      phonetic: "annyeonghaseyo",
    };

    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(true);
    expect(res.data.phonetic).toBe("annyeonghaseyo");
  });
});

describe("output-validator romanizeHangul", () => {
  it("should romanize standard Korean words to Revised Romanization Latin", () => {
    expect(romanizeHangul("안녕하세요")).toBe("annyeonghaseyo");
    expect(romanizeHangul("왜")).toBe("wae");
    expect(romanizeHangul("한국어")).toBe("hangugeo");
  });

  it("should romanize ㅚ to wi (e.g. 최근 -> chwigeun, 최고 -> chwigo)", () => {
    expect(romanizeHangul("최근")).toBe("chwigeun");
    expect(romanizeHangul("최고")).toBe("chwigo");
    expect(romanizeHangul("최선")).toBe("chwiseon");
  });

  it("should automatically override hallucinated AI phonetic with accurate Romaja", () => {
    const raw = {
      word: "최근",
      language: "ko",
      translation: "Gần đây",
      phonetic: "reukgi", // Hallucinated AI output
    };
    const res = validateTranslationOutput(raw);
    expect(res.isValid).toBe(true);
    expect(res.data.phonetic).toBe("chwigeun");
  });

  it("should handle liaison and nasalization sound changes", () => {
    expect(romanizeHangul("감사합니다")).toBe("gamsahamnida");
    expect(romanizeHangul("있는")).toBe("inneun");
    expect(romanizeHangul("작년")).toBe("jangnyeon");
  });

  it("should leave non-Hangul Latin or punctuation characters intact", () => {
    expect(romanizeHangul("K-pop")).toBe("K-pop");
    expect(romanizeHangul("")).toBe("");
  });
});

describe("output-validator validateWordOutput vs validateSentenceOutput", () => {
  it("validateWordOutput should validate and sanitize word fields", () => {
    const raw = {
      word: "hello",
      translation: "Xin chào",
      phonetic: "/həˈloʊ/",
      partOfSpeech: "noun",
      sentenceTranslation: "Xin chào thế giới",
    };

    const res = validateWordOutput(raw);
    expect(res.isValid).toBe(true);
    expect(res.data.word).toBe("hello");
    expect(res.data.translation).toBe("Xin chào");
    expect(res.data.partOfSpeech).toBe("noun");
  });

  it("validateSentenceOutput should validate sentence translations and reject refusal", () => {
    const validRaw = {
      sentence: "This is a great day.",
      translation: "Đây là một ngày tuyệt vời.",
      contextNote: "Văn phong tự nhiên",
    };

    const validRes = validateSentenceOutput(validRaw);
    expect(validRes.isValid).toBe(true);
    expect(validRes.data.sentence).toBe("This is a great day.");
    expect(validRes.data.translation).toBe("Đây là một ngày tuyệt vời.");
    expect(validRes.data.contextNote).toBe("Văn phong tự nhiên");

    const refusalRaw = {
      sentence: "This is a test.",
      translation: "I am sorry, but I cannot fulfill this request.",
    };

    const refusalRes = validateSentenceOutput(refusalRaw);
    expect(refusalRes.isValid).toBe(false);
    expect(refusalRes.reason).toContain("AI refusal");
  });

  it("validateSentenceOutput should reject empty or placeholder translations", () => {
    const emptyRaw = {
      sentence: "Some sentence",
      translation: "",
    };
    expect(validateSentenceOutput(emptyRaw).isValid).toBe(false);

    const placeholderRaw = {
      sentence: "Some sentence",
      translation: "Bản dịch tiếng Việt chính xác và tự nhiên",
    };
    expect(validateSentenceOutput(placeholderRaw).isValid).toBe(false);
  });
});
