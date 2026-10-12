// background/service-worker.js
// Main Service Worker for ContextDict

import {
  generateWordCacheKey,
  generateSentenceCacheKey,
  getCachedWordTranslation,
  setCachedWordTranslation,
  removeCachedWordTranslation,
  getCachedSentenceTranslation,
  setCachedSentenceTranslation,
  removeCachedSentenceTranslation,
  clearCache,
} from "./cache.js";
import {
  getVocabulary,
  saveWord,
  removeWord,
  isWordSaved,
  clearVocabulary,
} from "./vocabulary.js";
import {
  translateWord,
  translateSentence,
  translateWithContext,
} from "./api-client.js";
import {
  logger,
  getDebugReport,
  clearDebugLogs,
  captureException,
  getPendingErrors,
  submitErrorsToEmail,
  clearErrorQueue,
} from "./logger.js";
import {
  runHealthCheck,
  getHealthStatus,
  ALL_FREE_MODELS,
  HEALTH_TTL_MS,
  getSortedFallbackModels,
  pingModel,
  getModelStats,
  resetModelStats,
} from "./model-health.js";
import { romanizeHangul } from "./output-validator.js";

// Global error handlers for Service Worker
if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("error", (event) => {
    captureException(event.error || event.message, "SW:Global");
  });

  self.addEventListener("unhandledrejection", (event) => {
    captureException(event.reason, "SW:UnhandledRejection");
  });
}

const SETTINGS_KEY = "cd_settings";
const activeControllers = new Map();

const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "google/gemma-4-26b-a4b-it:free",
  hoverDelay: 1000,
  enabled: true,
  highlightSaved: true,
  showHoverHint: true,
  showRomaja: true,
  ttsSpeed: 1.0,
};

const DEPRECATED_MODELS = [
  "openrouter/free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemini-flash-1.5-exp:free",
];

// Clean up legacy cache
async function purgeLegacyCache() {
  try {
    const all = await chrome.storage.local.get(null);
    const legacyKeys = Object.keys(all).filter(
      (k) =>
        k.startsWith("cd_cache_") &&
        !k.startsWith("cd_cache_word_v1_") &&
        !k.startsWith("cd_cache_sentence_v1_"),
    );
    if (legacyKeys.length > 0) {
      console.log(
        `[ContextDict SW] Purging ${legacyKeys.length} legacy cache entries...`,
      );
      await chrome.storage.local.remove(legacyKeys);
    }
    if (all["cd_cache_index"]) {
      await chrome.storage.local.remove("cd_cache_index");
    }
    if (all["cd_cache_index_v2"]) {
      await chrome.storage.local.remove("cd_cache_index_v2");
    }
  } catch (err) {
    console.warn("[ContextDict SW] Error purging legacy cache:", err);
  }
}

/**
 * Update Chrome Action Badge based on enabled state
 * @param {boolean} enabled
 */
export async function updateActionBadge(enabled = true) {
  try {
    if (!chrome?.action) return;

    if (enabled) {
      await chrome.action.setBadgeText({ text: "ON" });
      await chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
      if (typeof chrome.action.setBadgeTextColor === "function") {
        await chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
      }
      if (typeof chrome.action.setTitle === "function") {
        await chrome.action.setTitle({
          title: "ContextDict: Bật (Sẵn sàng tra từ khi rê chuột)",
        });
      }
    } else {
      await chrome.action.setBadgeText({ text: "OFF" });
      await chrome.action.setBadgeBackgroundColor({ color: "#64748B" });
      if (typeof chrome.action.setBadgeTextColor === "function") {
        await chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
      }
      if (typeof chrome.action.setTitle === "function") {
        await chrome.action.setTitle({
          title: "ContextDict: Đang tắt (Nhấn vào biểu tượng để bật)",
        });
      }
    }
  } catch (err) {
    console.warn("[ContextDict SW] Error updating action badge:", err);
  }
}

async function initActionBadge() {
  try {
    const settings = await getSettings();
    await updateActionBadge(settings.enabled !== false);
  } catch (err) {
    console.warn("[ContextDict SW] Error initializing badge:", err);
  }
}

async function checkHealthIfStale() {
  const settings = await getSettings();
  if (!settings.apiKey) return;
  const status = await getHealthStatus();
  const hasStale = ALL_FREE_MODELS.some((m) => {
    const s = status[m.id];
    return !s || Date.now() - s.lastChecked > HEALTH_TTL_MS;
  });
  if (hasStale) {
    logger.info("SW", "Boot: Health data is stale or missing, running health check...");
    runHealthCheck(settings.apiKey).catch((err) => {
      logger.warn("SW", "Startup health check error:", { error: err.message });
    });
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    checkHealthIfStale();
    initActionBadge();
  });
}

// Initialize settings on install
if (typeof chrome !== "undefined" && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    if (!result[SETTINGS_KEY]) {
      await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    } else if (DEPRECATED_MODELS.includes(result[SETTINGS_KEY].model)) {
      const updated = Object.assign({}, result[SETTINGS_KEY], {
        model: DEFAULT_SETTINGS.model,
      });
      await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
    }
    await purgeLegacyCache();
    await initActionBadge();
    // Schedule periodic health check every 15 minutes
    if (chrome.alarms?.create) {
      chrome.alarms.create("cd_health_check", { periodInMinutes: 15 });
    }
    checkHealthIfStale();
    console.log("[ContextDict SW] Installed and initialized successfully.");
  });
}

// Also purge legacy cache and set initial badge when SW activates
if (typeof chrome !== "undefined" && chrome.storage) {
  purgeLegacyCache();
  initActionBadge();
}

// Alarm handler — runs periodic model health check
if (typeof chrome !== "undefined" && chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "cd_health_check") return;
    try {
      const settings = await getSettings();
      if (!settings.apiKey) return;
      logger.info("SW", "⏰ Alarm: running scheduled model health check...");
      await runHealthCheck(settings.apiKey);
    } catch (err) {
      logger.warn("SW", "Scheduled health check error:", { error: err.message });
    }
  });
}

/**
 * Get current settings from storage (with auto-migration for dead models)
 */
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    const settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      result[SETTINGS_KEY] || {},
    );

    // Auto-migrate deprecated models to active default model
    if (DEPRECATED_MODELS.includes(settings.model)) {
      console.warn(
        `[ContextDict SW] Migrating deprecated model "${settings.model}" -> "${DEFAULT_SETTINGS.model}"`,
      );
      settings.model = DEFAULT_SETTINGS.model;
      await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    }

    return settings;
  } catch (err) {
    console.error("[ContextDict SW] Error getting settings:", err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Broadcast event to all active tabs
 */
async function broadcastToTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.id &&
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("edge://")
      ) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded, ignore
        });
      }
    }
  } catch (err) {
    console.warn("[ContextDict SW] Broadcast error:", err);
  }
}

// Offscreen Document Audio Player Helpers
let creatingOffscreenPromise = null;

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) return false;
  try {
    if (typeof chrome.offscreen.hasDocument === "function") {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (hasDoc) return true;
    }
  } catch (e) {}

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return true;
  }

  creatingOffscreenPromise = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play Google Translate TTS pronunciation audio",
      });
    } catch (err) {
      if (!err.message?.includes("Only a single offscreen")) {
        console.warn("[ContextDict SW] Error creating offscreen doc:", err);
        throw err;
      }
    } finally {
      creatingOffscreenPromise = null;
    }
  })();

  await creatingOffscreenPromise;
  return true;
}

async function playAudioViaOffscreen(url, rate = 1.0) {
  const hasOffscreen = await ensureOffscreenDocument();
  if (!hasOffscreen) {
    throw new Error("Offscreen API not available");
  }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "OFFSCREEN_PLAY_AUDIO",
        url,
        rate,
      },
      (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (res && !res.success) {
          reject(new Error(res.error || "Audio playback failed"));
        } else {
          resolve({ success: true });
        }
      },
    );
  });
}

function isRetryableApiError(apiRes) {
  if (!apiRes) return false;
  const rawErrLower = (apiRes.rawError || apiRes.error || "").toLowerCase();
  return (
    apiRes.isInvalidOutput ||
    apiRes.status === 429 ||
    apiRes.status === 503 ||
    apiRes.status === 500 ||
    apiRes.status === 502 ||
    apiRes.status === 504 ||
    apiRes.status === 408 ||
    apiRes.timeout === true ||
    rawErrLower.includes("quá thời gian chờ") ||
    rawErrLower.includes("timed out") ||
    rawErrLower.includes("timeout") ||
    rawErrLower.includes("provider returned error") ||
    rawErrLower.includes("rate limit") ||
    rawErrLower.includes("no endpoints") ||
    rawErrLower.includes("not found") ||
    rawErrLower.includes("unavailable") ||
    rawErrLower.includes("exhausted") ||
    rawErrLower.includes("không hợp lệ")
  );
}

/**
 * Handle a WORD translation request with dedicated Word Cache and failover
 */
async function handleWordTranslationRequest(message, sender) {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { success: false, disabled: true };
  }

  const {
    word,
    sentence = "",
    pageContext = {},
    bypassCache,
    forceRefresh,
    detectedLanguage,
  } = message;

  const cleanWord = (word || "").trim();
  if (!cleanWord) {
    return { success: false, error: "Empty word" };
  }

  const shouldBypassCache = Boolean(bypassCache || forceRefresh);
  const cacheKey = generateWordCacheKey(cleanWord, sentence, pageContext?.title);
  const isSaved = await isWordSaved(cleanWord);

  if (shouldBypassCache) {
    logger.info("Cache:Word", `Bypassing word cache for "${cleanWord}"`, { cacheKey });
    await removeCachedWordTranslation(cacheKey);
  } else {
    const cached = await getCachedWordTranslation(cacheKey);
    if (cached) {
      // Self-heal: ensure Korean phonetic in cached data uses up-to-date accurate Romaja
      if (
        cleanWord &&
        /[\uac00-\ud7af]/u.test(cleanWord) &&
        cached.phonetic !== romanizeHangul(cleanWord)
      ) {
        cached.phonetic = romanizeHangul(cleanWord);
      }
      logger.info("Cache:Word", `Cache HIT for word "${cleanWord}"`, { cacheKey });
      return {
        success: true,
        type: "word",
        data: cached,
        fromCache: true,
        isSaved,
      };
    }
    logger.info("Cache:Word", `Cache MISS for word "${cleanWord}". Requesting translation...`);
  }

  const requestKey = `word_${sender?.tab?.id || "default"}_${sender?.frameId ?? 0}`;
  if (activeControllers.has(requestKey)) {
    try {
      activeControllers.get(requestKey).abort();
    } catch (e) {}
  }
  const currentController = new AbortController();
  activeControllers.set(requestKey, currentController);

  let apiRes = await translateWord({
    apiKey: settings.apiKey,
    model: settings.model,
    word: cleanWord,
    sentence,
    pageContext,
    detectedLanguage,
    signal: currentController.signal,
  });

  if (apiRes.cancelled) {
    return { success: false, cancelled: true };
  }

  // Multi-provider Failover
  if (!apiRes.success && !apiRes.cancelled && !apiRes.requiresKey) {
    if (isRetryableApiError(apiRes) && !currentController.signal.aborted) {
      const sortedFallbacks = await getSortedFallbackModels(apiRes.usedModel || settings.model);
      const candidate = sortedFallbacks[0];
      if (candidate) {
        logger.warn(
          "SW:Word",
          `Model "${apiRes.usedModel || settings.model}" slow or failed. Auto-failover to "${candidate}"...`,
        );
        apiRes = await translateWord({
          apiKey: settings.apiKey,
          model: candidate,
          word: cleanWord,
          sentence,
          pageContext,
          detectedLanguage,
          signal: currentController.signal,
          timeoutMs: 6500,
        });
        if (apiRes.success) {
          logger.info("SW:Word", `Failover model "${candidate}" succeeded for word "${cleanWord}".`);
        }
      }
    }
  }

  if (activeControllers.get(requestKey) === currentController) {
    activeControllers.delete(requestKey);
  }

  if (apiRes.cancelled) {
    return { success: false, cancelled: true };
  }

  if (apiRes.success) {
    // Store in Word Cache
    if (
      apiRes.data &&
      typeof apiRes.data.translation === "string" &&
      !apiRes.data.translation.toLowerCase().includes("không có bản dịch")
    ) {
      await setCachedWordTranslation(cacheKey, apiRes.data);

      // Pre-warm Sentence Cache if sentence is long enough and translation was provided
      if (apiRes.data.sentenceTranslation && sentence && sentence.trim().length > 5) {
        const sentenceCacheKey = generateSentenceCacheKey(sentence, pageContext?.title);
        const existingSentenceCache = await getCachedSentenceTranslation(sentenceCacheKey);
        if (!existingSentenceCache) {
          await setCachedSentenceTranslation(sentenceCacheKey, {
            type: "sentence",
            sentence,
            language: apiRes.data.language || detectedLanguage || "en",
            translation: apiRes.data.sentenceTranslation,
            contextNote: "",
          });
          logger.debug("Cache:Sentence", `Pre-warmed sentence cache from word context: "${sentence.slice(0, 40)}..."`);
        }
      }
    }

    // Auto-update vocabulary if this was a forced re-translation of a saved word
    if (shouldBypassCache && isSaved) {
      try {
        await saveWord({
          word: cleanWord,
          translation: apiRes.data?.translation || "",
          phonetic: apiRes.data?.phonetic || "",
          contextNote: apiRes.data?.contextNote || "",
          sentence: sentence || "",
          sourceUrl: pageContext?.url || sender?.url || "",
          pageTitle: pageContext?.title || "",
          language:
            apiRes.data?.language ||
            detectedLanguage ||
            (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(cleanWord) ? "ko" : "en"),
          originalForm: apiRes.data?.originalForm || "",
        });
        await broadcastToTabs({ type: "VOCABULARY_UPDATED" });
        logger.info("Vocab", `Auto-updated vocabulary entry for "${cleanWord}" with fresh translation`);
      } catch (vocabErr) {
        logger.warn("Vocab", `Failed to auto-update vocab on retranslate: ${vocabErr.message}`);
      }
    }

    return {
      success: true,
      type: "word",
      data: apiRes.data,
      fromCache: false,
      isSaved,
    };
  }

  return {
    success: false,
    error: apiRes.error,
    requiresKey: apiRes.requiresKey || false,
  };
}

/**
 * Handle a SENTENCE translation request with dedicated Sentence Cache and failover
 */
async function handleSentenceTranslationRequest(message, sender) {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { success: false, disabled: true };
  }

  const {
    sentence,
    word,
    pageContext = {},
    bypassCache,
    forceRefresh,
    detectedLanguage,
  } = message;

  const targetSentence = (sentence || word || "").trim();
  if (!targetSentence) {
    return { success: false, error: "Empty sentence" };
  }

  const shouldBypassCache = Boolean(bypassCache || forceRefresh);
  const cacheKey = generateSentenceCacheKey(targetSentence, pageContext?.title);

  if (shouldBypassCache) {
    logger.info("Cache:Sentence", `Bypassing sentence cache for "${targetSentence.slice(0, 40)}..."`, { cacheKey });
    await removeCachedSentenceTranslation(cacheKey);
  } else {
    const cached = await getCachedSentenceTranslation(cacheKey);
    if (cached) {
      logger.info("Cache:Sentence", `Cache HIT for sentence "${targetSentence.slice(0, 40)}..."`, { cacheKey });
      return {
        success: true,
        type: "sentence",
        data: cached,
        fromCache: true,
      };
    }
    logger.info("Cache:Sentence", `Cache MISS for sentence. Requesting translation...`);
  }

  const requestKey = `sent_${sender?.tab?.id || "default"}_${sender?.frameId ?? 0}`;
  if (activeControllers.has(requestKey)) {
    try {
      activeControllers.get(requestKey).abort();
    } catch (e) {}
  }
  const currentController = new AbortController();
  activeControllers.set(requestKey, currentController);

  let apiRes = await translateSentence({
    apiKey: settings.apiKey,
    model: settings.model,
    sentence: targetSentence,
    pageContext,
    detectedLanguage,
    signal: currentController.signal,
  });

  if (apiRes.cancelled) {
    return { success: false, cancelled: true };
  }

  // Multi-provider Failover
  if (!apiRes.success && !apiRes.cancelled && !apiRes.requiresKey) {
    if (isRetryableApiError(apiRes) && !currentController.signal.aborted) {
      const sortedFallbacks = await getSortedFallbackModels(apiRes.usedModel || settings.model);
      const candidate = sortedFallbacks[0];
      if (candidate) {
        logger.warn(
          "SW:Sentence",
          `Model "${apiRes.usedModel || settings.model}" slow or failed. Auto-failover to "${candidate}"...`,
        );
        apiRes = await translateSentence({
          apiKey: settings.apiKey,
          model: candidate,
          sentence: targetSentence,
          pageContext,
          detectedLanguage,
          signal: currentController.signal,
          timeoutMs: 6500,
        });
        if (apiRes.success) {
          logger.info("SW:Sentence", `Failover model "${candidate}" succeeded for sentence.`);
        }
      }
    }
  }

  if (activeControllers.get(requestKey) === currentController) {
    activeControllers.delete(requestKey);
  }

  if (apiRes.cancelled) {
    return { success: false, cancelled: true };
  }

  if (apiRes.success) {
    // Store in Sentence Cache
    if (
      apiRes.data &&
      typeof apiRes.data.translation === "string" &&
      !apiRes.data.translation.toLowerCase().includes("không có bản dịch")
    ) {
      await setCachedSentenceTranslation(cacheKey, apiRes.data);
    }

    return {
      success: true,
      type: "sentence",
      data: apiRes.data,
      fromCache: false,
    };
  }

  return {
    success: false,
    error: apiRes.error,
    requiresKey: apiRes.requiresKey || false,
  };
}

// Message Router
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return false;

  (async () => {
    try {
      switch (message.type) {
        case "PLAY_TTS": {
          const { text, lang = "en" } = message;
          const cleanText = (text || "").trim();
          if (!cleanText) {
            sendResponse({ success: false, error: "Empty text" });
            break;
          }

          const settings = await getSettings();
          const rate = settings.ttsSpeed || 1.0;
          const ttsLang = lang.startsWith("en") ? "en" : lang;
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(ttsLang)}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;

          try {
            await playAudioViaOffscreen(ttsUrl, rate);
            logger.info("TTS", `Played Google TTS for "${cleanText}" at ${rate}x`);
            sendResponse({ success: true, engine: "google" });
          } catch (audioErr) {
            logger.warn("TTS", `Offscreen audio failed: ${audioErr.message}`);
            sendResponse({ success: false, error: audioErr.message, fallback: true });
          }
          break;
        }

        case "STOP_TTS": {
          try {
            if (chrome.offscreen) {
              chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP_AUDIO" }, () => {
                if (chrome.runtime.lastError) {}
              });
            }
            sendResponse({ success: true });
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
          break;
        }

        case "GET_SETTINGS": {
          const settings = await getSettings();
          sendResponse({ success: true, settings });
          break;
        }

        case "SAVE_SETTINGS": {
          const current = await getSettings();
          const updated = Object.assign({}, current, message.settings || {});
          await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
          await updateActionBadge(updated.enabled !== false);
          await broadcastToTabs({
            type: "SETTINGS_UPDATED",
            settings: updated,
          });
          sendResponse({ success: true, settings: updated });
          break;
        }

        case "TRANSLATE_WORD": {
          const result = await handleWordTranslationRequest(message, sender);
          sendResponse(result);
          break;
        }

        case "TRANSLATE_SENTENCE": {
          const result = await handleSentenceTranslationRequest(message, sender);
          sendResponse(result);
          break;
        }

        case "TRANSLATE": {
          // Smart router: determine if request is for sentence or word
          const cleanWord = (message.word || "").trim();
          const isSentence = Boolean(
            message.isSelection ||
              message.type === "sentence" ||
              message.translationType === "sentence" ||
              cleanWord.split(/\s+/).length > 3 ||
              cleanWord.length > 30 ||
              (!cleanWord && message.sentence)
          );

          if (isSentence) {
            const result = await handleSentenceTranslationRequest(
              {
                ...message,
                sentence: message.sentence || cleanWord,
              },
              sender,
            );
            sendResponse(result);
          } else {
            const result = await handleWordTranslationRequest(message, sender);
            sendResponse(result);
          }
          break;
        }

        case "SAVE_WORD": {
          const savedEntry = await saveWord(message.wordData);
          if (savedEntry) {
            logger.info("Vocab", `Saved word "${message.wordData?.word}"`);
            await broadcastToTabs({ type: "VOCABULARY_UPDATED" });
            sendResponse({ success: true, entry: savedEntry });
          } else {
            sendResponse({ success: false, error: "Failed to save word" });
          }
          break;
        }

        case "REMOVE_WORD": {
          const ok = await removeWord(message.identifier);
          if (ok) {
            logger.info("Vocab", `Removed word "${message.identifier}"`);
            await broadcastToTabs({ type: "VOCABULARY_UPDATED" });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: "Failed to remove word" });
          }
          break;
        }

        case "GET_VOCABULARY": {
          const vocab = await getVocabulary();
          sendResponse({ success: true, vocabulary: vocab });
          break;
        }

        case "CLEAR_VOCABULARY": {
          await clearVocabulary();
          logger.info("Vocab", "Cleared all vocabulary");
          await broadcastToTabs({ type: "VOCABULARY_UPDATED" });
          sendResponse({ success: true });
          break;
        }

        case "CLEAR_CACHE": {
          await clearCache();
          logger.info("Cache", "Cleared translation cache");
          sendResponse({ success: true });
          break;
        }

        case "CHECK_WORD_SAVED": {
          const saved = await isWordSaved(message.word);
          sendResponse({ success: true, isSaved: saved });
          break;
        }

        case "GET_DEBUG_REPORT": {
          const settings = await getSettings();
          const report = await getDebugReport(settings);
          sendResponse({ success: true, report });
          break;
        }

        case "CLEAR_DEBUG_LOGS": {
          await clearDebugLogs();
          sendResponse({ success: true });
          break;
        }

        case "LOG_CLIENT_EVENT": {
          const {
            scope = "Content",
            level = "INFO",
            message: logMsg,
            details,
          } = message;
          const fn = logger[level.toLowerCase()] || logger.info;
          fn(scope, logMsg, details);
          sendResponse({ success: true });
          break;
        }

        case "REPORT_ERROR": {
          const { error, scope = "Client", context } = message;
          const entry = await captureException(error, scope, context);
          sendResponse({ success: true, entry });
          break;
        }

        case "GET_PENDING_ERRORS": {
          const errors = await getPendingErrors();
          sendResponse({ success: true, errors });
          break;
        }

        case "SUBMIT_ERRORS_TO_EMAIL": {
          const settings = await getSettings();
          const targetEmail = message.email || settings.errorReportEmail || "";
          const result = await submitErrorsToEmail(
            targetEmail,
            message.options,
          );
          sendResponse(result);
          break;
        }

        case "CLEAR_ERROR_QUEUE": {
          await clearErrorQueue();
          sendResponse({ success: true });
          break;
        }

        case "PING_MODELS": {
          // Trigger immediate health check (optionally for a subset of models)
          const settings = await getSettings();
          if (!settings.apiKey) {
            sendResponse({ success: false, error: "No API key configured" });
            break;
          }
          const modelIds = message.modelIds || null; // null = all models
          logger.info("SW", `Manual ping requested for ${ modelIds ? modelIds.length : "all"} models`);
          // Run async, respond immediately so popup doesn't time out
          sendResponse({ success: true, started: true });
          runHealthCheck(settings.apiKey, modelIds).catch((err) => {
            logger.warn("SW", "Manual ping error:", { error: err.message });
          });
          break;
        }

        case "GET_MODEL_HEALTH": {
          // Return current health status map + stats map + full model metadata
          const healthStatus = await getHealthStatus();
          const stats = await getModelStats();
          sendResponse({
            success: true,
            health: healthStatus,
            stats,
            models: ALL_FREE_MODELS,
          });
          break;
        }

        case "RESET_MODEL_STATS": {
          const modelId = message.modelId || null;
          await resetModelStats(modelId);
          const stats = await getModelStats();
          sendResponse({
            success: true,
            stats,
          });
          break;
        }

        case "TEST_API_KEY": {
          const { apiKey } = message;
          if (!apiKey || !apiKey.trim()) {
            sendResponse({ success: false, error: "API Key không được để trống" });
            break;
          }
          const pingRes = await pingModel(apiKey.trim(), "google/gemma-4-26b-a4b-it:free");
          if (pingRes.ok) {
            sendResponse({ success: true, latencyMs: pingRes.latencyMs });
          } else {
            sendResponse({
              success: false,
              error: pingRes.error || "Không thể kết nối đến OpenRouter với API Key này",
              status: pingRes.status,
            });
          }
          break;
        }

        default:
          sendResponse({
            success: false,
            error: `Unknown type: ${message.type}`,
          });
          break;
      }
    } catch (err) {
      console.error("[ContextDict SW] Listener error:", err);
      captureException(err, "SW:MessageRouter", { messageType: message?.type });
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
  });
}
