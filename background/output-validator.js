// background/output-validator.js
// Validation and sanitization for AI model translation outputs

import { logger } from "./logger.js";

/**
 * Known placeholder patterns that indicate the AI model repeated prompt instructions
 * instead of generating actual translation/context content.
 */
const PROMPT_PLACEHOLDERS = [
  /^Bản dịch tiếng Việt (?:hoàn chỉnh và tự nhiên|chính xác và tự nhiên|của cả đoạn văn)/i,
  /^Bản dịch tiếng Việt/i,
  /^Bản dịch của cả/i,
  /^từ nguyên thể \(Dictionary form\)/i,
  /^từ nguyên thể/i,
  /^Phiên âm Romaja chuẩn/i,
  /^Từ loại \(danh từ, động từ, trợ từ\.\.\.\)/i,
  /^Phân tích trợ từ hoặc ngữ pháp/i,
  /^Dịch toàn bộ câu ngữ cảnh/i,
  /^Giải thích ngắn gọn về sắc thái/i,
  /^để trống nếu nghĩa đã rõ/i,
  /^để trống/i,
  /^Không có bản dịch/i,
  /^Chưa có bản dịch/i,
];

/**
 * AI refusal and error response indicators
 */
const AI_REFUSAL_PATTERNS = [
  /^(?:I am sorry|I'm sorry|Sorry|As an AI|As a language model|I cannot fulfill|I cannot translate)/i,
  /^(?:Tôi rất tiếc|Tôi không thể dịch|Tôi là mô hình AI|Không thể hoàn thành)/i,
  /^\{?\s*"error"\s*:/i,
  /^rate limit reached/i,
];

/**
 * Sanitize a raw text field by stripping accidental markdown code blocks,
 * nested JSON structures, and excess whitespace.
 */
export function sanitizeField(val) {
  if (val == null) return "";
  let str = String(val).trim();

  // Strip markdown code fences if wrapped
  str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Strip JSON key-value leakage e.g. "translation": "something"
  if (/^"?[a-zA-Z0-9_]+"?\s*:\s*"/i.test(str)) {
    const match = str.match(/:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
    if (match) {
      str = match[1].replace(/\\"/g, '"');
    }
  }

  // Strip outermost stray curly braces or unclosed quotes
  if (str.startsWith('{"') && str.endsWith('"}')) {
    str = str.slice(2, -2);
  }

  return str.trim();
}

/**
 * Check whether a string appears to be an echo of system prompt instructions
 */
export function isPromptPlaceholder(text) {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim();
  return PROMPT_PLACEHOLDERS.some((pattern) => pattern.test(clean));
}

/**
 * Check whether a string appears to be an AI refusal or system error message
 */
export function isAiRefusal(text) {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim();
  return AI_REFUSAL_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Revised Romanization of Korean Hangul to Latin script (국어의 로마자 표기법).
 * Accurately maps Choseong, Jungseong, and Jongseong with liaison and nasalization assimilation.
 */
export function romanizeHangul(text) {
  if (!text || typeof text !== "string") return "";
  const INITIALS = [
    "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "",
    "j", "jj", "ch", "k", "t", "p", "h",
  ];
  const VOWELS = [
    "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
    "wae", "wi", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
  ];
  const FINALS = [
    "", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l",
    "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t",
    "k", "t", "p", "h",
  ];

  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syl = code - 0xac00;
      const ini = Math.floor(syl / 588);
      const vow = Math.floor((syl % 588) / 28);
      const fin = syl % 28;

      let initStr = INITIALS[ini];
      let finStr = FINALS[fin];

      // Check next syllable for liaison or nasalization assimilation
      if (i + 1 < text.length) {
        const nextCode = text.charCodeAt(i + 1);
        if (nextCode >= 0xac00 && nextCode <= 0xd7a3) {
          const nextSyl = nextCode - 0xac00;
          const nextIni = Math.floor(nextSyl / 588);

          // 1. Liaison: next syllable starts with silent ㅇ (nextIni === 11)
          if (nextIni === 11 && fin > 0) {
            finStr = "";
          }

          // 2. Nasalization before ㄴ (nextIni === 2) or ㅁ (nextIni === 6)
          if (nextIni === 2 || nextIni === 6) {
            if (fin === 14 || fin === 17 || fin === 18) finStr = "m";
            else if (fin === 1 || fin === 2 || fin === 3 || fin === 9 || fin === 24) finStr = "ng";
            else if (fin === 7 || fin === 19 || fin === 20 || fin === 22 || fin === 23 || fin === 25 || fin === 27) finStr = "n";
          }
        }
      }

      // Check previous syllable for liaison carryover
      if (i > 0 && ini === 11) {
        const prevCode = text.charCodeAt(i - 1);
        if (prevCode >= 0xac00 && prevCode <= 0xd7a3) {
          const prevSyl = prevCode - 0xac00;
          const prevFin = prevSyl % 28;
          if (prevFin === 1 || prevFin === 2 || prevFin === 3) initStr = "g";
          else if (prevFin === 8 || prevFin === 11 || prevFin === 12 || prevFin === 13 || prevFin === 15) initStr = "r";
          else if (prevFin === 17 || prevFin === 18) initStr = "b";
          else if (prevFin === 20) initStr = "ss";
          else if (prevFin === 7 || prevFin === 19 || prevFin === 22 || prevFin === 23) initStr = "s";
          else if (prevFin === 25) initStr = "t";
          else if (prevFin === 26) initStr = "p";
          else if (prevFin === 24) initStr = "k";
        }
      }

      result += initStr + VOWELS[vow] + finStr;
    } else {
      result += text[i];
    }
  }
  return result;
}

/**
 * Validate and sanitize a WORD translation output object.
 *
 * @param {Object} output The parsed word output object from AI
 * @param {Object} [options]
 * @param {string} [options.expectedWord] The original word being translated
 * @param {string} [options.fallbackLanguage] Default language code ("en" | "ko")
 * @returns {{ isValid: boolean, data: Object, reason?: string }}
 */
export function validateWordOutput(output, options = {}) {
  const { expectedWord = "", fallbackLanguage = "en" } = options;

  if (!output || typeof output !== "object") {
    return {
      isValid: false,
      data: null,
      reason: "Output is empty or not an object",
    };
  }

  // 1. Sanitize all string fields
  const word = sanitizeField(output.word) || expectedWord || "";
  let translation = sanitizeField(output.translation);
  let originalForm = sanitizeField(output.originalForm);
  let phonetic = sanitizeField(output.phonetic);
  let partOfSpeech = sanitizeField(output.partOfSpeech);
  let contextNote = sanitizeField(output.contextNote);
  let sentenceTranslation = sanitizeField(output.sentenceTranslation);
  let language = sanitizeField(output.language).toLowerCase();

  // Normalize language code
  if (language !== "ko" && language !== "en") {
    const hasHangul = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(word || originalForm);
    language = hasHangul ? "ko" : fallbackLanguage;
  }

  // 2. Clean prompt placeholder echoes from secondary fields (graceful degradation)
  if (isPromptPlaceholder(originalForm)) originalForm = "";
  if (isPromptPlaceholder(phonetic)) phonetic = "";
  if (isPromptPlaceholder(partOfSpeech)) partOfSpeech = "";
  if (isPromptPlaceholder(contextNote)) contextNote = "";
  if (isPromptPlaceholder(sentenceTranslation)) sentenceTranslation = "";

  // 3. For Korean outputs: strictly ensure accurate pronunciation in Latin script (Romaja)
  if (language === "ko") {
    // Korean Hangul is a purely phonetic regular script.
    // If the word contains Hangul, compute canonical Romaja directly from the word
    // to prevent AI model hallucinations (such as "reukgi" for "최근").
    if (word && /[\uac00-\ud7af]/u.test(word)) {
      phonetic = romanizeHangul(word);
    } else if (phonetic && /[\uac00-\ud7af]/u.test(phonetic)) {
      phonetic = romanizeHangul(phonetic);
    }

    if (phonetic) {
      // Strip any stray enclosing brackets or slashes and clean up excess whitespace
      phonetic = phonetic.replace(/[\[\]\/]/g, "").trim();
    }
  }

  // 4. Mandatory field validation: translation
  if (!translation) {
    return {
      isValid: false,
      data: null,
      reason: "Missing or empty translation field",
    };
  }

  // 5. Check for AI refusal or system error messages
  if (isAiRefusal(translation)) {
    logger.warn("Validator", `Rejected AI refusal output for "${word}": ${translation}`);
    return {
      isValid: false,
      data: null,
      reason: `AI refusal or error response: ${translation.slice(0, 80)}`,
    };
  }

  // 6. Check for system prompt placeholder repetition in translation
  if (isPromptPlaceholder(translation)) {
    logger.warn("Validator", `Rejected prompt placeholder echo for "${word}": ${translation}`);
    return {
      isValid: false,
      data: null,
      reason: `Translation contains prompt instruction echo: "${translation.slice(0, 80)}"`,
    };
  }

  // 7. Check for non-translatable raw JSON leakage in translation
  if (translation.includes('{"') || translation.includes('"translation"') || translation.includes('```')) {
    logger.warn("Validator", `Rejected raw JSON leakage in translation: "${translation}"`);
    return {
      isValid: false,
      data: null,
      reason: "Translation contains unparsed raw JSON leakage",
    };
  }

  const sanitizedData = {
    type: "word",
    word,
    language,
    originalForm,
    translation,
    phonetic,
    partOfSpeech,
    contextNote,
    sentenceTranslation,
  };

  return {
    isValid: true,
    data: sanitizedData,
  };
}

/**
 * Validate and sanitize a SENTENCE translation output object.
 *
 * @param {Object} output The parsed sentence output object from AI
 * @param {Object} [options]
 * @param {string} [options.expectedSentence] The original sentence being translated
 * @param {string} [options.fallbackLanguage] Default language code ("en" | "ko")
 * @returns {{ isValid: boolean, data: Object, reason?: string }}
 */
export function validateSentenceOutput(output, options = {}) {
  const { expectedSentence = "", fallbackLanguage = "en" } = options;

  if (!output || typeof output !== "object") {
    return {
      isValid: false,
      data: null,
      reason: "Output is empty or not an object",
    };
  }

  const sentence = sanitizeField(output.sentence || output.word) || expectedSentence || "";
  let translation = sanitizeField(output.translation);
  let contextNote = sanitizeField(output.contextNote);
  let language = sanitizeField(output.language).toLowerCase();

  // Normalize language code
  if (language !== "ko" && language !== "en") {
    const hasHangul = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(sentence);
    language = hasHangul ? "ko" : fallbackLanguage;
  }

  if (isPromptPlaceholder(contextNote)) contextNote = "";

  // Mandatory field validation: translation
  if (!translation) {
    return {
      isValid: false,
      data: null,
      reason: "Missing or empty translation field",
    };
  }

  // Check for AI refusal or system error messages
  if (isAiRefusal(translation)) {
    logger.warn("Validator", `Rejected AI refusal for sentence: ${translation}`);
    return {
      isValid: false,
      data: null,
      reason: `AI refusal or error response: ${translation.slice(0, 80)}`,
    };
  }

  // Check for system prompt placeholder repetition in translation
  if (isPromptPlaceholder(translation)) {
    logger.warn("Validator", `Rejected prompt placeholder echo for sentence: ${translation}`);
    return {
      isValid: false,
      data: null,
      reason: `Translation contains prompt instruction echo: "${translation.slice(0, 80)}"`,
    };
  }

  // Check for non-translatable raw JSON leakage in translation
  if (translation.includes('{"') || translation.includes('"translation"') || translation.includes('```')) {
    logger.warn("Validator", `Rejected raw JSON leakage in sentence translation: "${translation}"`);
    return {
      isValid: false,
      data: null,
      reason: "Translation contains unparsed raw JSON leakage",
    };
  }

  const sanitizedData = {
    type: "sentence",
    sentence,
    language,
    translation,
    contextNote,
  };

  return {
    isValid: true,
    data: sanitizedData,
  };
}

/**
 * Backward-compatible facade for translation output validation.
 * Automatically delegates to validateSentenceOutput or validateWordOutput.
 */
export function validateTranslationOutput(output, options = {}) {
  const isSentence = Boolean(
    options.isSentence ||
      output?.type === "sentence" ||
      (!output?.word && (output?.sentence || options.expectedSentence))
  );

  if (isSentence) {
    return validateSentenceOutput(output, options);
  }
  return validateWordOutput(output, options);
}
