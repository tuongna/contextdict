// content/content.js
// Main entry point for ContextDict content script

(function () {
  let currentSettings = {
    enabled: true,
    hoverDelay: 1000,
    highlightSaved: true,
    showHoverHint: true,
    showRomaja: true,
  };
  let latestHoveredWord = "";

  /**
   * Safely report unexpected client-side errors to background queue
   */
  function safeReportError(err, scope = "Content", context = {}) {
    try {
      if (!chrome.runtime?.id) return;
      const errorPayload = {
        name: err?.name || "Error",
        message: err?.message || String(err),
        stack: err?.stack || "",
      };
      const isIframe = window !== window.top;
      const pageContext = {
        url: window.location.href,
        title: document.title,
        isIframe,
        ...context,
      };
      chrome.runtime.sendMessage(
        {
          type: "REPORT_ERROR",
          error: errorPayload,
          scope: isIframe ? `${scope}:Iframe` : scope,
          context: pageContext,
        },
        () => {
          if (chrome.runtime.lastError) {
            /* ignore context invalidated */
          }
        },
      );
    } catch (e) {
      // Ignore context invalidated
    }
  }
  window.ContextDictReportError = safeReportError;

  // Global error listeners filtered specifically to ContextDict extension scripts
  window.addEventListener("error", (event) => {
    try {
      const filename = event.filename || "";
      if (
        filename.includes("contextdict") ||
        filename.includes(chrome.runtime?.id || "____")
      ) {
        safeReportError(event.error || event.message, "Content:Global", {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }
    } catch (e) {}
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      const reason = event.reason;
      const stack = String(reason?.stack || "");
      if (
        stack.includes("contextdict") ||
        stack.includes(chrome.runtime?.id || "____")
      ) {
        safeReportError(reason, "Content:UnhandledRejection");
      }
    } catch (e) {}
  });

  /**
   * Handle word hovered or phrase selected
   */
  async function handleWordHovered({
    type = "word",
    word,
    sentence,
    sentenceRects,
    rect,
    isSelection,
    detectedLanguage,
  }) {
    if (!chrome.runtime?.id) return;
    if (!currentSettings.enabled) return;

    try {
      const isSentence = type === "sentence" || (!word && Boolean(sentence));
      const targetIdentifier = isSentence ? sentence : word;
      latestHoveredWord = targetIdentifier;

      // Show loading skeleton immediately
      window.ContextDictTooltip.showLoading(
        targetIdentifier,
        rect,
        sentenceRects,
        isSentence ? "sentence" : "word",
      );

      // Yield main thread so the entrance animation renders without hesitation
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Collect page context safely
      let pageContext = null;
      try {
        pageContext = window.ContextDictCollector?.getPageContext() || null;
      } catch (collectErr) {
        safeReportError(collectErr, "Content:ContextCollector", {
          identifier: targetIdentifier,
        });
      }

      console.log(
        "%c[ContextDict:Content]%c Hovered trigger:",
        "color: #f59e0b; font-weight: bold;",
        "color: inherit;",
        `[${isSentence ? "SENTENCE" : "WORD"}]`,
        targetIdentifier,
        {
          sentence: sentence ? sentence.slice(0, 100) : "",
          isSelection,
        },
      );

      const messageType = isSentence ? "TRANSLATE_SENTENCE" : "TRANSLATE_WORD";
      const payload = isSentence
        ? {
            type: messageType,
            sentence,
            pageContext,
            detectedLanguage,
          }
        : {
            type: messageType,
            word,
            sentence,
            pageContext,
            isSelection,
            detectedLanguage,
          };

      // Send log event to background
      chrome.runtime.sendMessage(
        {
          type: "LOG_CLIENT_EVENT",
          scope: "Content",
          level: "INFO",
          message: `${isSentence ? "Sentence" : "Word"} hover: "${targetIdentifier.slice(0, 50)}"`,
          details: { isSentence, isSelection },
        },
        () => {
          if (chrome.runtime.lastError) {}
        },
      );

      const handleSaveToggle = async (wordData, isNowSaved) => {
        if (!chrome.runtime?.id) return;
        try {
          if (isNowSaved) {
            chrome.runtime.sendMessage(
              {
                type: "SAVE_WORD",
                wordData: {
                  word: wordData.word,
                  translation: wordData.data?.translation || "",
                  phonetic: wordData.data?.phonetic || "",
                  contextNote: wordData.data?.contextNote || "",
                  sentence: wordData.sentence || sentence || "",
                  sourceUrl: window.location.href,
                  pageTitle: document.title || "",
                  language:
                    wordData.data?.language ||
                    detectedLanguage ||
                    (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(
                      wordData.word,
                    )
                      ? "ko"
                      : "en"),
                  originalForm: wordData.data?.originalForm || "",
                },
              },
              () => {
                if (chrome.runtime.lastError) {}
              },
            );
          } else {
            chrome.runtime.sendMessage(
              {
                type: "REMOVE_WORD",
                identifier: wordData.word,
              },
              () => {
                if (chrome.runtime.lastError) {}
              },
            );
          }
        } catch (err) {}
      };

      const doRetranslate = async () => {
        if (!chrome.runtime?.id) return;
        latestHoveredWord = targetIdentifier;
        chrome.runtime.sendMessage(
          {
            ...payload,
            bypassCache: true,
          },
          (newRes) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[ContextDict:Content] Retranslate error:",
                chrome.runtime.lastError.message,
              );
              window.ContextDictTooltip.showError(
                targetIdentifier,
                "Không thể kết nối đến nền tảng mở rộng. Vui lòng thử lại.",
                false,
                rect,
                doRetranslate,
              );
              return;
            }

            if (!newRes || newRes.cancelled) return;
            if (latestHoveredWord !== targetIdentifier) return;
            if (
              window.ContextDictTooltip &&
              !window.ContextDictTooltip.isVisible()
            )
              return;

            if (newRes.success && newRes.data) {
              chrome.runtime.sendMessage(
                {
                  type: "LOG_CLIENT_EVENT",
                  scope: "Content",
                  level: "INFO",
                  message: `Retranslation received for "${targetIdentifier.slice(0, 50)}"`,
                  details: { fromCache: false, hasData: true, isSentence },
                },
                () => {
                  if (chrome.runtime.lastError) {}
                },
              );

              try {
                window.ContextDictTooltip.showTranslation({
                  type: isSentence ? "sentence" : "word",
                  word: isSentence ? "" : word,
                  data: newRes.data,
                  fromCache: false,
                  isSaved: newRes.isSaved,
                  sentence,
                  rect,
                  sentenceRects,
                  showRomaja: currentSettings.showRomaja !== false,
                  onSaveToggle: isSentence ? null : handleSaveToggle,
                  onRetranslate: doRetranslate,
                });
              } catch (err) {
                window.ContextDictTooltip.showError(
                  targetIdentifier,
                  "Lỗi kết xuất bản dịch: " + err.message,
                  false,
                  rect,
                  doRetranslate,
                );
              }
            } else if (newRes.requiresKey) {
              window.ContextDictTooltip.showError(
                targetIdentifier,
                newRes.error ||
                  "Vui lòng cấu hình OpenRouter API Key để sử dụng tính năng dịch.",
                true,
                rect,
              );
            } else {
              window.ContextDictTooltip.showError(
                targetIdentifier,
                newRes.error || "Dịch lại thất bại, vui lòng thử lại.",
                false,
                rect,
                doRetranslate,
              );
            }
          },
        );
      };

      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[ContextDict:Content] Runtime message error:",
            chrome.runtime.lastError.message,
          );
          window.ContextDictTooltip.showError(
            targetIdentifier,
            "Không thể kết nối đến nền tảng mở rộng. Vui lòng tải lại trang web.",
            false,
            rect,
            doRetranslate,
          );
          return;
        }

        if (!response || response.cancelled) return;
        if (latestHoveredWord !== targetIdentifier) return;
        if (
          window.ContextDictTooltip &&
          !window.ContextDictTooltip.isVisible()
        )
          return;

        if (response.success && response.data) {
          console.log(
            "%c[ContextDict:Content]%c Received translation:",
            "color: #34d399; font-weight: bold;",
            "color: inherit;",
            {
              isSentence,
              target: targetIdentifier.slice(0, 30),
              fromCache: response.fromCache,
              translation: response.data?.translation,
            },
          );

          chrome.runtime.sendMessage(
            {
              type: "LOG_CLIENT_EVENT",
              scope: "Content",
              level: "INFO",
              message: `Translation received for "${targetIdentifier.slice(0, 50)}"`,
              details: {
                fromCache: !!response.fromCache,
                hasData: !!response.data,
                isSentence,
              },
            },
            () => {
              if (chrome.runtime.lastError) {}
            },
          );

          try {
            window.ContextDictTooltip.showTranslation({
              type: isSentence ? "sentence" : "word",
              word: isSentence ? "" : word,
              data: response.data,
              fromCache: response.fromCache,
              isSaved: response.isSaved,
              sentence,
              rect,
              sentenceRects,
              showRomaja: currentSettings.showRomaja !== false,
              onSaveToggle: isSentence ? null : handleSaveToggle,
              onRetranslate: doRetranslate,
            });
          } catch (err) {
            console.error(
              "[ContextDict:Content] Error displaying translation:",
              err,
            );
            window.ContextDictTooltip.showError(
              targetIdentifier,
              "Lỗi kết xuất bản dịch: " + err.message,
              false,
              rect,
              doRetranslate,
            );
          }
        } else if (response.requiresKey) {
          window.ContextDictTooltip.showError(
            targetIdentifier,
            response.error ||
              "Vui lòng cấu hình OpenRouter API Key để sử dụng tính năng dịch.",
            true,
            rect,
          );
        } else {
          window.ContextDictTooltip.showError(
            targetIdentifier,
            response.error || "Dịch thất bại, vui lòng thử lại.",
            false,
            rect,
            doRetranslate,
          );
        }
      });
    } catch (e) {
      console.warn("[ContextDict] Failed to process word hover:", e);
      safeReportError(e, "Content:handleWordHovered", { word });
      try {
        window.ContextDictTooltip?.showError(
          word,
          "Có lỗi xử lý bản dịch, vui lòng thử lại.",
          false,
          rect,
        );
      } catch (uiErr) {}
    }
  }

  /**
   * Load saved vocabulary and apply highlights
   */
  function refreshVocabulary() {
    if (!chrome.runtime?.id) return;
    try {
      chrome.runtime.sendMessage({ type: "GET_VOCABULARY" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (
          response &&
          response.success &&
          Array.isArray(response.vocabulary)
        ) {
          if (window.ContextDictHighlighter) {
            window.ContextDictHighlighter.updateWords(
              response.vocabulary,
              currentSettings.enabled && currentSettings.highlightSaved,
            );
          }
        }
      });
    } catch (e) {
      // Context invalidated
    }
  }

  /**
   * Initialize content script across all frames (top-level and iframes).
   * Each frame maintains its own encapsulated Shadow DOM tooltip and hover detector,
   * providing seamless inline translation, speech synthesis, and vocabulary highlights.
   */
  function init() {
    if (!chrome.runtime?.id) return;

    try {
      // Fetch settings from background
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.success && response.settings) {
          currentSettings = response.settings;
        }

        // Initialize hover detector
        if (window.ContextDictDetector) {
          window.ContextDictDetector.init({
            enabled: currentSettings.enabled,
            hoverDelay: currentSettings.hoverDelay || 1000,
            showHoverHint: currentSettings.showHoverHint !== false,
            onHover: handleWordHovered,
          });
        }

        // Load vocabulary and highlights
        refreshVocabulary();

        // Pre-warm page context cache in background idle time
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => {
            window.ContextDictCollector?.getPageContext();
          });
        } else {
          setTimeout(() => {
            window.ContextDictCollector?.getPageContext();
          }, 400);
        }
      });

      // Listen for updates from popup or background
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "SETTINGS_UPDATED" && message.settings) {
          currentSettings = message.settings;
          if (window.ContextDictDetector) {
            window.ContextDictDetector.updateConfig({
              enabled: currentSettings.enabled,
              hoverDelay: currentSettings.hoverDelay,
              showHoverHint: currentSettings.showHoverHint !== false,
            });
          }
          refreshVocabulary();
        } else if (message.type === "VOCABULARY_UPDATED") {
          refreshVocabulary();
        }
      });
    } catch (e) {
      // Context invalidated
    }
  }

  // Ensure DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
