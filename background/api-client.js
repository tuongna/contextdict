// background/api-client.js
// OpenRouter AI translation & contextual explanation client
// Separated Word Translation and Sentence Translation flows

import { logger } from "./logger.js";
import { getSortedFallbackModels } from "./model-health.js";
import { recordModelAttempt } from "./model-stats.js";
import {
  validateWordOutput,
  validateSentenceOutput,
  validateTranslationOutput,
  sanitizeField,
} from "./output-validator.js";

export {
  validateWordOutput,
  validateSentenceOutput,
  validateTranslationOutput,
} from "./output-validator.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";

/**
 * Common JSON text cleaner: removes thinking tags, markdown code blocks, etc.
 */
function cleanRawJsonText(rawOutput) {
  if (!rawOutput || !rawOutput.trim()) return "";
  let text = rawOutput.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return text;
}

/**
 * Extract a specific field via Regex as a fallback
 */
function extractFieldWithRegex(text, field) {
  const regex = new RegExp(
    `"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"?`,
    "i",
  );
  const m = text.match(regex);
  return m ? m[1].replace(/\\"/g, '"').trim() : "";
}

/**
 * Attempt to repair a truncated JSON string
 */
function attemptJsonRepair(text) {
  const startIdx = text.indexOf("{");
  if (startIdx === -1) return null;
  let candidate = text.slice(startIdx);
  const quoteMatches = candidate.match(/"/g);
  if (quoteMatches && quoteMatches.length % 2 !== 0) {
    candidate += '"';
  }
  if (!candidate.trim().endsWith("}")) {
    candidate += "}";
  }
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * Parse and repair AI model output for a WORD translation
 */
export function parseWordResponse(rawOutput, cleanWord) {
  const defaultLang = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(cleanWord) ? "ko" : "en";
  const emptyResult = {
    type: "word",
    word: cleanWord,
    language: defaultLang,
    originalForm: "",
    translation: "Không có bản dịch",
    phonetic: "",
    partOfSpeech: "",
    contextNote: "",
    sentenceTranslation: "",
  };

  const text = cleanRawJsonText(rawOutput);
  if (!text) return emptyResult;

  // 1. Direct JSON parse
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object") {
        logger.debug("API", `Direct JSON parse successful for word "${cleanWord}"`);
        return {
          type: "word",
          word: cleanWord,
          language: (parsed.language || "").trim() || defaultLang,
          originalForm: (parsed.originalForm || "").trim(),
          translation: (parsed.translation || "").trim() || "Không có bản dịch",
          phonetic: (parsed.phonetic || "").trim(),
          partOfSpeech: (parsed.partOfSpeech || "").trim(),
          contextNote: (parsed.contextNote || "").trim(),
          sentenceTranslation: (parsed.sentenceTranslation || "").trim(),
        };
      }
    }
  } catch (e) {}

  // 2. Repaired JSON parse
  const repaired = attemptJsonRepair(text);
  if (repaired && typeof repaired === "object") {
    logger.info("API", `Auto-repaired truncated JSON for word "${cleanWord}"`);
    return {
      type: "word",
      word: cleanWord,
      language: (repaired.language || "").trim() || defaultLang,
      originalForm: (repaired.originalForm || "").trim(),
      translation: (repaired.translation || "").trim() || "Không có bản dịch",
      phonetic: (repaired.phonetic || "").trim(),
      partOfSpeech: (repaired.partOfSpeech || "").trim(),
      contextNote: (repaired.contextNote || "").trim(),
      sentenceTranslation: (repaired.sentenceTranslation || "").trim(),
    };
  }

  // 3. Fallback: Regex field extraction
  const extractedTranslation = extractFieldWithRegex(text, "translation");
  if (extractedTranslation) {
    logger.warn("API", `Extracted fields via regex fallback for word "${cleanWord}"`);
    return {
      type: "word",
      word: cleanWord,
      language: extractFieldWithRegex(text, "language") || defaultLang,
      originalForm: extractFieldWithRegex(text, "originalForm"),
      translation: extractedTranslation,
      phonetic: extractFieldWithRegex(text, "phonetic"),
      partOfSpeech: extractFieldWithRegex(text, "partOfSpeech"),
      contextNote: extractFieldWithRegex(text, "contextNote"),
      sentenceTranslation: extractFieldWithRegex(text, "sentenceTranslation"),
    };
  }

  // 4. Plain text fallback
  const fallbackText = text
    .replace(/[\{\}"]/g, "")
    .replace(/translation:/i, "")
    .trim();
  logger.warn("API", `Using plain text fallback for word "${cleanWord}"`);
  return {
    type: "word",
    word: cleanWord,
    language: defaultLang,
    originalForm: "",
    translation: fallbackText.slice(0, 100) || "Không có bản dịch",
    phonetic: "",
    partOfSpeech: "",
    contextNote: fallbackText.length > 100 ? fallbackText.slice(100, 300) : "",
    sentenceTranslation: "",
  };
}

/**
 * Parse and repair AI model output for a SENTENCE translation
 */
export function parseSentenceResponse(rawOutput, cleanSentence) {
  const defaultLang = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(cleanSentence) ? "ko" : "en";
  const emptyResult = {
    type: "sentence",
    sentence: cleanSentence,
    language: defaultLang,
    translation: "Không có bản dịch",
    contextNote: "",
  };

  const text = cleanRawJsonText(rawOutput);
  if (!text) return emptyResult;

  // 1. Direct JSON parse
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object") {
        logger.debug("API", `Direct JSON parse successful for sentence`);
        return {
          type: "sentence",
          sentence: cleanSentence,
          language: (parsed.language || "").trim() || defaultLang,
          translation: (parsed.translation || "").trim() || "Không có bản dịch",
          contextNote: (parsed.contextNote || "").trim(),
        };
      }
    }
  } catch (e) {}

  // 2. Repaired JSON parse
  const repaired = attemptJsonRepair(text);
  if (repaired && typeof repaired === "object") {
    logger.info("API", `Auto-repaired truncated JSON for sentence`);
    return {
      type: "sentence",
      sentence: cleanSentence,
      language: (repaired.language || "").trim() || defaultLang,
      translation: (repaired.translation || "").trim() || "Không có bản dịch",
      contextNote: (repaired.contextNote || "").trim(),
    };
  }

  // 3. Fallback: Regex field extraction
  const extractedTranslation = extractFieldWithRegex(text, "translation");
  if (extractedTranslation) {
    logger.warn("API", `Extracted fields via regex fallback for sentence`);
    return {
      type: "sentence",
      sentence: cleanSentence,
      language: extractFieldWithRegex(text, "language") || defaultLang,
      translation: extractedTranslation,
      contextNote: extractFieldWithRegex(text, "contextNote"),
    };
  }

  // 4. Plain text fallback
  const fallbackText = text
    .replace(/[\{\}"]/g, "")
    .replace(/translation:/i, "")
    .trim();
  logger.warn("API", `Using plain text fallback for sentence`);
  return {
    type: "sentence",
    sentence: cleanSentence,
    language: defaultLang,
    translation: fallbackText || "Không có bản dịch",
    contextNote: "",
  };
}

/**
 * Backward-compatible facade for parseApiResponse
 */
export function parseApiResponse(rawOutput, targetText) {
  const isSentence = Boolean(
    targetText && (targetText.split(/\s+/).length > 3 || targetText.length > 30)
  );
  if (isSentence) {
    const parsed = parseSentenceResponse(rawOutput, targetText);
    return {
      word: parsed.sentence,
      language: parsed.language,
      originalForm: "",
      translation: parsed.translation,
      phonetic: "",
      partOfSpeech: "câu",
      contextNote: parsed.contextNote,
      sentenceTranslation: "",
    };
  }
  return parseWordResponse(rawOutput, targetText);
}

/**
 * Common transport function to send chat completions to OpenRouter API
 */
async function sendOpenRouterRequest({
  apiKey,
  model = DEFAULT_MODEL,
  systemPrompt,
  userContent,
  signal = null,
  timeoutMs = 6000,
  logLabel = "API",
}) {
  const targetModel = model || DEFAULT_MODEL;
  const isFreeModel = targetModel.includes(":free");
  let fallbackModels = [targetModel];
  if (isFreeModel) {
    const sortedFallbacks = await getSortedFallbackModels(targetModel);
    fallbackModels = [targetModel, ...sortedFallbacks].slice(0, 3);
  }

  const controller = new AbortController();
  const startTime = performance.now();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let externalAbort = false;
  if (signal) {
    signal.addEventListener(
      "abort",
      () => {
        externalAbort = true;
        controller.abort();
      },
      { once: true },
    );
  }

  const requestBody = {
    model: targetModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    max_tokens: 500,
  };

  if (isFreeModel && fallbackModels.length > 1) {
    requestBody.models = fallbackModels.slice(0, 3);
    requestBody.provider = {
      allow_fallbacks: true,
    };
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "HTTP-Referer": "https://contextdict.extension",
        "X-Title": "ContextDict Chrome Extension",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsedMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      let rawErrMsg = `API error ${response.status}`;
      try {
        const errJson = await response.json();
        rawErrMsg = errJson?.error?.message || rawErrMsg;
      } catch (e) {
        const text = await response.text();
        rawErrMsg = text.slice(0, 100) || rawErrMsg;
      }

      let friendlyError = rawErrMsg;
      if (
        response.status === 429 ||
        rawErrMsg.toLowerCase().includes("rate limit") ||
        rawErrMsg.toLowerCase().includes("provider returned error")
      ) {
        friendlyError =
          "Model AI đang bận hoặc quá tải lượt yêu cầu miễn phí (Rate Limit 429). Hệ thống đang kích hoạt dự phòng...";
      }

      logger.error(logLabel, `← HTTP ${response.status} in ${elapsedMs}ms`, {
        error: rawErrMsg,
        model: targetModel,
      });
      await recordModelAttempt(targetModel, {
        ok: false,
        latencyMs: elapsedMs,
        type: "translation",
        error: rawErrMsg,
      });
      return {
        ok: false,
        error: friendlyError,
        rawError: rawErrMsg,
        status: response.status,
        usedModel: targetModel,
      };
    }

    const data = await response.json();
    const servedModel = data.model || targetModel;
    const rawOutput = data.choices?.[0]?.message?.content || "";

    if (!rawOutput.trim()) {
      logger.warn(logLabel, `Empty response from model`, { requestedModel: targetModel, servedModel });
      await recordModelAttempt(servedModel, {
        ok: false,
        latencyMs: elapsedMs,
        type: "translation",
        error: "Mô hình trả về dữ liệu rỗng (Silent failure).",
      });
      return {
        ok: false,
        error: "Mô hình trả về dữ liệu rỗng (Silent failure).",
        status: 502,
        usedModel: servedModel,
      };
    }

    logger.info(logLabel, `← HTTP 200 OK in ${elapsedMs}ms`, {
      requestedModel: targetModel,
      servedModel,
      rawPreview: rawOutput.slice(0, 180),
    });

    await recordModelAttempt(servedModel, {
      ok: true,
      latencyMs: elapsedMs,
      type: "translation",
    });

    return {
      ok: true,
      rawOutput,
      servedModel,
      elapsedMs,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsedMs = Math.round(performance.now() - startTime);
    if (err.name === "AbortError") {
      if (externalAbort || signal?.aborted) {
        logger.info(logLabel, `Request superseded by newer action after ${elapsedMs}ms`);
        return { ok: false, cancelled: true };
      }
      logger.error(logLabel, `← Request TIMED OUT after ${elapsedMs}ms`, {
        model: targetModel,
      });
      await recordModelAttempt(targetModel, {
        ok: false,
        latencyMs: elapsedMs,
        type: "translation",
        error: `Request timed out (${Math.round(elapsedMs / 1000)}s)`,
      });
      return {
        ok: false,
        timeout: true,
        status: 408,
        usedModel: targetModel,
        error: `Yêu cầu dịch với model "${targetModel}" đã quá thời gian chờ (${Math.round(elapsedMs / 1000)}s).`,
      };
    }
    logger.error(logLabel, `← Network/Fetch error in ${elapsedMs}ms: ${err.message}`, {
      model: targetModel,
    });
    await recordModelAttempt(targetModel, {
      ok: false,
      latencyMs: elapsedMs,
      type: "translation",
      error: err.message,
    });
    return {
      ok: false,
      error: err.message || "Lỗi kết nối đến dịch vụ dịch thuật.",
    };
  }
}

// =========================================================================
// 1. WORD TRANSLATION FLOW
// =========================================================================

/**
 * Translate an individual WORD in context
 */
export async function translateWord({
  apiKey,
  model = DEFAULT_MODEL,
  word,
  sentence = "",
  pageContext = {},
  detectedLanguage = "",
  signal = null,
  timeoutMs = 6000,
}) {
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      requiresKey: true,
      error: "Vui lòng cài đặt OpenRouter API Key trong Popup của ContextDict.",
    };
  }

  const cleanWord = (word || "").trim();
  if (!cleanWord) {
    return { success: false, error: "Từ cần dịch không hợp lệ." };
  }

  const isKorean =
    detectedLanguage === "ko" ||
    /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(cleanWord || sentence);

  let systemPrompt;
  if (isKorean) {
    systemPrompt = `Bạn là ContextDict - trợ lý dịch nghĩa từ vựng và ngữ pháp tiếng Hàn chuyên sâu.
Nhiệm vụ: Dịch từ/cụm từ tiếng Hàn sang tiếng Việt chính xác theo ngữ cảnh trong câu và ngữ cảnh trang web.
Yêu cầu chuyên sâu:
1. "originalForm": Từ nguyên thể / gốc từ (Dictionary form - 기본형, ví dụ: "가셨나요" -> "가다"; "저만" -> "저").
2. "phonetic": BẮT BUỘC phiên âm bằng chữ cái Latinh / Romaja chuẩn theo Quy tắc phiên âm Quốc ngữ (Revised Romanization, ví dụ: "gayeossnayo", "wae", "jeoman"). TUYỆT ĐỐI KHÔNG dùng ký tự Hangeul (한글) trong phonetic, chỉ dùng bảng chữ cái Latinh a-z.
3. "partOfSpeech": Từ loại chi tiết (ví dụ: "động từ", "danh từ + trợ từ", "tính từ", v.v.).
4. "contextNote": Nếu từ có chứa trợ từ (조사 như 은/는, 이/가, 을/를, 에, 에서, 만, 도) hoặc đuôi câu (kính ngữ, thân mật), hãy giải thích ngắn gọn cấu trúc và ý nghĩa của trợ từ/đuôi từ đó trong câu.
5. "sentenceTranslation": Bản dịch tiếng Việt hoàn chỉnh và tự nhiên của toàn bộ câu chứa từ đó.

BẮT BUỘC chỉ trả về duy nhất 1 JSON object thuần túy, KHÔNG dùng markdown, KHÔNG kèm thẻ suy nghĩ:
{
  "language": "ko",
  "originalForm": "từ nguyên thể (Dictionary form)",
  "translation": "Bản dịch tiếng Việt chính xác và tự nhiên",
  "phonetic": "phiên âm chữ cái Latinh (Romaja, ví dụ: annyeonghaseyo)",
  "partOfSpeech": "Từ loại (danh từ, động từ, trợ từ...)",
  "contextNote": "Phân tích trợ từ hoặc ngữ pháp nếu có",
  "sentenceTranslation": "Dịch toàn bộ câu ngữ cảnh"
}`;
  } else {
    systemPrompt = `Bạn là ContextDict - trợ lý dịch thuật và giải nghĩa theo ngữ cảnh.
Nhiệm vụ: Dịch từ/cụm từ tiếng Anh sang tiếng Việt chính xác theo ngữ cảnh trong câu và ngữ cảnh trang web.

BẮT BUỘC chỉ trả về duy nhất 1 JSON object thuần túy, KHÔNG dùng markdown, KHÔNG kèm thẻ suy nghĩ:
{
  "language": "en",
  "originalForm": "từ nguyên thể nếu là dạng biến thể (hoặc để trống)",
  "translation": "Bản dịch tiếng Việt chính xác và tự nhiên của từ/cụm từ",
  "phonetic": "Phiên âm IPA chuẩn (VD: /ˈvɪdi.oʊ/)",
  "partOfSpeech": "Từ loại (danh từ, động từ, tính từ...)",
  "contextNote": "Giải thích ngắn gọn nếu từ mang ý nghĩa đặc thù, từ lóng, hoặc thuật ngữ chuyên ngành trong ngữ cảnh hiện tại. (Để trống nếu nghĩa phổ thông đã rõ ràng)",
  "sentenceTranslation": "Bản dịch tiếng Việt hoàn chỉnh và tự nhiên của toàn bộ câu chứa từ đó (để trống nếu không có câu ngữ cảnh)"
}`;
  }

  const userContent = `Từ/Cụm từ cần dịch: "${cleanWord}"

Câu chứa từ:
"${(sentence || "").slice(0, 300)}"

Thông tin trang web:
- Tiêu đề: "${(pageContext.title || "").slice(0, 150)}"
- Mô tả: "${(pageContext.description || "").slice(0, 200)}"
- Đoạn văn mẫu: "${(pageContext.summary || "").slice(0, 200)}"

Hãy trả về kết quả JSON theo yêu cầu.`;

  logger.info("API:Word", `→ Translating word "${cleanWord}" (${isKorean ? "KO" : "EN"})`, {
    model,
    sentenceLength: sentence.length,
    pageTitle: pageContext.title || "(none)",
  });

  const res = await sendOpenRouterRequest({
    apiKey,
    model,
    systemPrompt,
    userContent,
    signal,
    timeoutMs,
    logLabel: "API:Word",
  });

  if (!res.ok) {
    return {
      success: false,
      cancelled: res.cancelled,
      timeout: res.timeout,
      error: res.error,
      rawError: res.rawError,
      status: res.status,
      usedModel: res.usedModel,
    };
  }

  const parsed = parseWordResponse(res.rawOutput, cleanWord);
  const validated = validateWordOutput(parsed, {
    expectedWord: cleanWord,
    fallbackLanguage: isKorean ? "ko" : "en",
  });

  if (!validated.isValid) {
    logger.warn(
      "API:Word",
      `Validation failed for word "${cleanWord}" with model "${res.servedModel}": ${validated.reason}`,
    );
    return {
      success: false,
      isInvalidOutput: true,
      error: `Phản hồi từ AI không hợp lệ: ${validated.reason}`,
      status: 502,
      usedModel: res.servedModel,
    };
  }

  return {
    success: true,
    data: validated.data,
    usedModel: res.servedModel,
  };
}

// =========================================================================
// 2. SENTENCE TRANSLATION FLOW
// =========================================================================

/**
 * Translate a complete SENTENCE or paragraph
 */
export async function translateSentence({
  apiKey,
  model = DEFAULT_MODEL,
  sentence,
  pageContext = {},
  detectedLanguage = "",
  signal = null,
  timeoutMs = 6000,
}) {
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      requiresKey: true,
      error: "Vui lòng cài đặt OpenRouter API Key trong Popup của ContextDict.",
    };
  }

  const cleanSentence = (sentence || "").trim();
  if (!cleanSentence) {
    return { success: false, error: "Nội dung câu cần dịch không hợp lệ." };
  }

  const isKorean =
    detectedLanguage === "ko" ||
    /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(cleanSentence);

  let systemPrompt;
  if (isKorean) {
    systemPrompt = `Bạn là ContextDict - chuyên gia biên dịch câu và đoạn văn tiếng Hàn.
Nhiệm vụ: Dịch toàn bộ CÂU / ĐOẠN VĂN tiếng Hàn sang tiếng Việt chính xác, tự nhiên, đúng sắc thái và kính ngữ (존댓말/반말) phù hợp với ngữ cảnh trang web.

BẮT BUỘC chỉ trả về duy nhất 1 JSON object thuần túy, KHÔNG dùng markdown, KHÔNG kèm thẻ suy nghĩ:
{
  "language": "ko",
  "translation": "Bản dịch tiếng Việt hoàn chỉnh, tự nhiên và trôi chảy của toàn bộ câu/đoạn văn",
  "contextNote": "Giải thích ngắn gọn nếu câu có thành ngữ, kính ngữ đặc thù hoặc lối nói ẩn dụ (để trống nếu nghĩa đã rõ ràng)"
}`;
  } else {
    systemPrompt = `Bạn là ContextDict - chuyên gia biên dịch câu và đoạn văn tiếng Anh.
Nhiệm vụ: Dịch toàn bộ CÂU / ĐOẠN VĂN tiếng Anh sang tiếng Việt chính xác, tự nhiên và trôi chảy theo ngữ cảnh trang web.

BẮT BUỘC chỉ trả về duy nhất 1 JSON object thuần túy, KHÔNG dùng markdown, KHÔNG kèm thẻ suy nghĩ:
{
  "language": "en",
  "translation": "Bản dịch tiếng Việt hoàn chỉnh, tự nhiên và trôi chảy của toàn bộ câu/đoạn văn",
  "contextNote": "Giải thích ngắn gọn nếu câu có thuật ngữ chuyên ngành, thành ngữ hoặc văn phong đặc thù (để trống nếu nghĩa đã rõ ràng)"
}`;
  }

  const userContent = `Đoạn văn / Câu cần dịch: "${cleanSentence}"

Thông tin trang web:
- Tiêu đề: "${(pageContext.title || "").slice(0, 150)}"
- Mô tả: "${(pageContext.description || "").slice(0, 200)}"

Hãy trả về kết quả JSON theo yêu cầu.`;

  logger.info("API:Sentence", `→ Translating sentence (${isKorean ? "KO" : "EN"})`, {
    model,
    sentenceLength: cleanSentence.length,
    pageTitle: pageContext.title || "(none)",
  });

  const res = await sendOpenRouterRequest({
    apiKey,
    model,
    systemPrompt,
    userContent,
    signal,
    timeoutMs,
    logLabel: "API:Sentence",
  });

  if (!res.ok) {
    return {
      success: false,
      cancelled: res.cancelled,
      timeout: res.timeout,
      error: res.error,
      rawError: res.rawError,
      status: res.status,
      usedModel: res.usedModel,
    };
  }

  const parsed = parseSentenceResponse(res.rawOutput, cleanSentence);
  const validated = validateSentenceOutput(parsed, {
    expectedSentence: cleanSentence,
    fallbackLanguage: isKorean ? "ko" : "en",
  });

  if (!validated.isValid) {
    logger.warn(
      "API:Sentence",
      `Validation failed for sentence with model "${res.servedModel}": ${validated.reason}`,
    );
    return {
      success: false,
      isInvalidOutput: true,
      error: `Phản hồi từ AI không hợp lệ: ${validated.reason}`,
      status: 502,
      usedModel: res.servedModel,
    };
  }

  return {
    success: true,
    data: validated.data,
    usedModel: res.servedModel,
  };
}

// =========================================================================
// 3. BACKWARD-COMPATIBLE FACADE
// =========================================================================

/**
 * Backward-compatible facade for translateWithContext
 */
export async function translateWithContext(options) {
  const { word, sentence, isSelection } = options;
  const cleanWord = (word || "").trim();
  const isSentence = Boolean(
    isSelection ||
      cleanWord.split(/\s+/).length > 3 ||
      cleanWord.length > 30 ||
      (!cleanWord && sentence)
  );

  if (isSentence) {
    return translateSentence({
      ...options,
      sentence: cleanWord || sentence,
    });
  }
  return translateWord(options);
}
