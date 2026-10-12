import { describe, it, expect } from "vitest";
import {
  parseApiResponse,
  parseWordResponse,
  parseSentenceResponse,
} from "../../background/api-client.js";

describe("api-client parseApiResponse", () => {
  it("should correctly parse clean JSON response", () => {
    const raw = JSON.stringify({
      word: "hello",
      translation: "Xin chào",
      phonetic: "/həˈloʊ/",
      partOfSpeech: "exclamation",
      contextNote: "Lời chào thân thiện",
      sentenceTranslation: "Xin chào thế giới",
    });

    const result = parseApiResponse(raw, "hello");
    expect(result.word).toBe("hello");
    expect(result.translation).toBe("Xin chào");
    expect(result.phonetic).toBe("/həˈloʊ/");
    expect(result.partOfSpeech).toBe("exclamation");
    expect(result.contextNote).toBe("Lời chào thân thiện");
    expect(result.sentenceTranslation).toBe("Xin chào thế giới");
  });

  it("should strip markdown code blocks", () => {
    const raw = "```json\n" + JSON.stringify({
      translation: "Ngân hàng",
      contextNote: "Tổ chức tài chính",
    }) + "\n```";

    const result = parseApiResponse(raw, "bank");
    expect(result.translation).toBe("Ngân hàng");
    expect(result.contextNote).toBe("Tổ chức tài chính");
  });

  it("should strip <think> reasoning tags from reasoning models", () => {
    const raw = `<think>
Analyzing word "liquid" in finance context...
The sentence is "They have liquid assets".
Translation should be thanh khoản.
</think>
{"translation": "Thanh khoản", "contextNote": "Tài sản dễ chuyển thành tiền mặt"}`;

    const result = parseApiResponse(raw, "liquid");
    expect(result.translation).toBe("Thanh khoản");
    expect(result.contextNote).toBe("Tài sản dễ chuyển thành tiền mặt");
  });

  it("should return fallback for empty or whitespace raw output", () => {
    const result = parseApiResponse("   ", "test");
    expect(result.word).toBe("test");
    expect(result.translation).toBe("Không có bản dịch");
  });

  it("should correctly parse Korean response with originalForm and Romaja", () => {
    const raw = JSON.stringify({
      language: "ko",
      word: "가셨나요",
      originalForm: "가다",
      translation: "Đã đi rồi sao",
      phonetic: "gayeossnayo",
      partOfSpeech: "động từ + đuôi câu kính ngữ",
      contextNote: "Gốc từ là 가다 (đi), kết hợp thì quá khứ 었 và đuôi câu hỏi kính ngữ 셨나요",
      sentenceTranslation: "Sao lại để mỗi mình tôi ở lại mà đi rồi?",
    });

    const result = parseApiResponse(raw, "가셨나요");
    expect(result.word).toBe("가셨나요");
    expect(result.language).toBe("ko");
    expect(result.originalForm).toBe("가다");
    expect(result.translation).toBe("Đã đi rồi sao");
    expect(result.phonetic).toBe("gayeossnayo");
    expect(result.partOfSpeech).toContain("động từ");
  });

  it("should auto-detect language as 'ko' for Korean word even if model omits language", () => {
    const raw = JSON.stringify({
      translation: "Tại sao",
      contextNote: "Từ để hỏi nguyên nhân",
    });

    const result = parseApiResponse(raw, "왜");
    expect(result.language).toBe("ko");
    expect(result.translation).toBe("Tại sao");
  });
});

describe("api-client parseSentenceResponse", () => {
  it("should correctly parse clean sentence JSON response", () => {
    const raw = JSON.stringify({
      translation: "Trí tuệ nhân tạo đang thay đổi cách con người làm việc.",
      contextNote: "Dịch thoát ý trong bối cảnh công nghệ thông tin",
      detectedLanguage: "en",
    });

    const res = parseSentenceResponse(
      raw,
      "Artificial intelligence is changing the way people work.",
    );
    expect(res.sentence).toBe("Artificial intelligence is changing the way people work.");
    expect(res.translation).toBe(
      "Trí tuệ nhân tạo đang thay đổi cách con người làm việc.",
    );
    expect(res.contextNote).toContain("Dịch thoát ý");
    expect(res.language).toBe("en");
  });

  it("should parse markdown fenced or messy text into clean sentence translation", () => {
    const raw = "```json\n" + JSON.stringify({
      translation: "Hôm nay thời tiết rất đẹp.",
    }) + "\n```";

    const res = parseSentenceResponse(raw, "The weather is very nice today.");
    expect(res.translation).toBe("Hôm nay thời tiết rất đẹp.");
    expect(res.sentence).toBe("The weather is very nice today.");
  });

  it("should detect Korean language in sentence automatically", () => {
    const raw = JSON.stringify({
      translation: "Hôm nay thời tiết thật là đẹp.",
    });

    const res = parseSentenceResponse(raw, "오늘 날씨가 정말 좋네요.");
    expect(res.language).toBe("ko");
    expect(res.translation).toBe("Hôm nay thời tiết thật là đẹp.");
  });
});
