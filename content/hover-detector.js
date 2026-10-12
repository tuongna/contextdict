// content/hover-detector.js
// Detects words under cursor or selected phrases with debouncing

(function () {
  let hoverTimer = null;
  let hintTimer = null;
  let activeCandidateWord = "";
  let lastEvaluatedWord = "";
  let lastEvaluatedSentence = "";
  let activeRect = null;
  let isEnabled = true;
  let hoverDelay = 1000;
  let showHoverHint = true;
  let onWordHoverCallback = null;

  const WORD_REGEXP = /^[\p{L}\p{N}'.-]+$/u;
  const WORD_CHAR_REGEXP = /^[\p{L}\p{N}'.-]$/u;
  const IGNORED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "TEXTAREA",
    "INPUT",
    "CONTEXTDICT-HOST",
    "BUTTON",
    "SELECT",
    "IFRAME",
  ]);

  /**
   * Check if target element should be ignored
   */
  function isIgnoredElement(target) {
    try {
      if (!target) return true;
      if (IGNORED_TAGS.has(target.tagName) || target.isContentEditable) {
        return true;
      }
      if (target.closest && target.closest("contextdict-host")) {
        return true;
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  /**
   * Expand a caret position to get the exact word under cursor
   */
  function getWordAtPosition(textNode, offset) {
    try {
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

      const text = textNode.nodeValue || "";
      if (!text || offset < 0 || offset > text.length) return null;

      // Scan backwards for word start
      let start = offset;
      while (start > 0 && WORD_CHAR_REGEXP.test(text[start - 1])) {
        start--;
      }

      // Scan forwards for word end
      let end = offset;
      while (end < text.length && WORD_CHAR_REGEXP.test(text[end])) {
        end++;
      }

      if (start >= end) return null;

      const rawWord = text.substring(start, end).trim();
      // Strip leading/trailing punctuation like periods, colons, parentheses, quotes, brackets
      const cleanWord = rawWord.replace(
        /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
        "",
      );

      if (!cleanWord) return null;

      // Single character must be a letter (e.g. "a", "I", "왜") to avoid triggering on lone digits or symbols
      if (
        cleanWord.length === 1 &&
        !/\p{L}/u.test(cleanWord)
      ) {
        return null;
      }

      // Must contain at least one alphanumeric character (allows words, decimals/versions like "3.0", "v2", "GPT-4")
      if (!/[\p{L}\p{N}]/u.test(cleanWord)) {
        return null;
      }

      // Adjust start and end offsets to match the cleaned word
      const startAdjust = rawWord.indexOf(cleanWord);
      const adjustedStart = start + (startAdjust >= 0 ? startAdjust : 0);
      const adjustedEnd = adjustedStart + cleanWord.length;

      // Create a range for getting bounding client rect
      try {
        const range = document.createRange();
        range.setStart(textNode, Math.max(0, adjustedStart));
        range.setEnd(textNode, Math.min(text.length, adjustedEnd));
        const rect = range.getBoundingClientRect();
        return { word: cleanWord, range, rect };
      } catch (e) {
        return null;
      }
    } catch (outerErr) {
      return null;
    }
  }

  /**
   * Smart caret range retrieval that penetrates transparent/empty overlay elements
   * (e.g. card overlay links <a class="absolute inset-0"> or pointer-events-none containers)
   */
  function getCaretRangeSmart(x, y) {
    try {
      let range = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
      } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.setEnd(pos.offsetNode, pos.offset);
        }
      }

      // Direct hit on text node
      if (
        range &&
        range.startContainer &&
        range.startContainer.nodeType === Node.TEXT_NODE
      ) {
        return range;
      }

      // If hit was an element node, check if startOffset maps directly to a child text node
      if (
        range &&
        range.startContainer &&
        range.startContainer.nodeType === Node.ELEMENT_NODE
      ) {
        const el = range.startContainer;
        const offset = range.startOffset;
        const candidate =
          el.childNodes[offset] || el.childNodes[offset - 1] || el.firstChild;
        if (candidate && candidate.nodeType === Node.TEXT_NODE) {
          const r = document.createRange();
          r.setStart(candidate, 0);
          r.setEnd(candidate, 0);
          return r;
        }
      }

      // If initial hit was an overlay element without direct text (e.g. card link <a class="absolute inset-0">)
      if (!document.elementsFromPoint) {
        return range;
      }

      const elementsAtPoint = document.elementsFromPoint(x, y);
      const disabledElements = [];

      try {
        for (const el of elementsAtPoint) {
          if (!el || el === document.body || el === document.documentElement)
            continue;
          if (el.closest && el.closest("contextdict-host")) continue;

          const hasDirectText = Array.from(el.childNodes).some(
            (n) =>
              n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0,
          );

          // If element is an overlay (e.g. <a> wrapper, empty container, pointer-events-none container)
          if (
            !hasDirectText ||
            el.tagName === "A" ||
            el.classList.contains("pointer-events-none")
          ) {
            disabledElements.push({ el, prev: el.style.pointerEvents });
            el.style.pointerEvents = "none";

            let nextRange = document.caretRangeFromPoint
              ? document.caretRangeFromPoint(x, y)
              : null;
            if (nextRange && nextRange.startContainer) {
              if (nextRange.startContainer.nodeType === Node.TEXT_NODE) {
                range = nextRange;
                break;
              } else if (
                nextRange.startContainer.nodeType === Node.ELEMENT_NODE
              ) {
                const child =
                  nextRange.startContainer.childNodes[nextRange.startOffset] ||
                  nextRange.startContainer.firstChild;
                if (child && child.nodeType === Node.TEXT_NODE) {
                  const r = document.createRange();
                  r.setStart(child, 0);
                  r.setEnd(child, 0);
                  range = r;
                  break;
                }
              }
            }
          }
        }
      } finally {
        // Always restore pointer-events in reverse order
        for (let i = disabledElements.length - 1; i >= 0; i--) {
          disabledElements[i].el.style.pointerEvents = disabledElements[i].prev;
        }
      }

      return range;
    } catch (caretErr) {
      return null;
    }
  }

  /**
   * Handle mouse move
   */
  function onMouseMove(e) {
    try {
      if (!isEnabled) return;

      // Keep tooltip visible when mouse is over contextdict-host (Shadow DOM host)
      if (
        e.target &&
        e.target.closest &&
        e.target.closest("contextdict-host")
      ) {
        if (window.ContextDictTooltip) {
          window.ContextDictTooltip.cancelHide();
        }
        return;
      }

      if (isIgnoredElement(e.target)) {
        clearTimeout(hoverTimer);
        clearTimeout(hintTimer);
        activeCandidateWord = "";
        if (window.ContextDictTooltip) {
          if (window.ContextDictTooltip.isVisible()) {
            window.ContextDictTooltip.scheduleHide(200);
          } else {
            window.ContextDictTooltip.hideWordHint();
          }
        }
        return;
      }

      // Check if user has an active text selection
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : "";

      if (
        selectedText &&
        selectedText.length >= 1 &&
        selectedText.length <= 300
      ) {
        // User has selected a phrase
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Check if cursor is near selection
          if (
            e.clientX >= rect.left - 20 &&
            e.clientX <= rect.right + 20 &&
            e.clientY >= rect.top - 20 &&
            e.clientY <= rect.bottom + 20
          ) {
            const candidatePhrase = selectedText.toLowerCase();
            if (candidatePhrase === activeCandidateWord) {
              if (window.ContextDictTooltip?.isVisible?.()) {
                window.ContextDictTooltip.cancelHide();
              }
              return;
            }
            activeCandidateWord = candidatePhrase;
            clearTimeout(hoverTimer);
            clearTimeout(hintTimer);

            if (showHoverHint && isEnabled && window.ContextDictTooltip) {
              const res = window.ContextDictCollector.getSentenceContext(
                range.startContainer,
                range.startOffset,
              );
              let sentenceRects = [];
              if (res && res.range) {
                const rects = res.range.getClientRects();
                if (rects) {
                  sentenceRects = Array.from(rects).map(r => ({
                    top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height
                  }));
                }
              }
              window.ContextDictTooltip.showWordHint(rect, hoverDelay, sentenceRects);
            }

            hoverTimer = setTimeout(() => {
              triggerWordHover(
                selectedText,
                range.startContainer,
                range.startOffset,
                rect,
                true,
              );
            }, hoverDelay);
            return;
          }
        } catch (err) {}
      }

      // Smart word hover detection penetrating overlays
      const range = getCaretRangeSmart(e.clientX, e.clientY);

      if (
        !range ||
        !range.startContainer ||
        range.startContainer.nodeType !== Node.TEXT_NODE
      ) {
        clearTimeout(hoverTimer);
        clearTimeout(hintTimer);
        activeCandidateWord = "";
        if (window.ContextDictTooltip) {
          if (window.ContextDictTooltip.isVisible()) {
            window.ContextDictTooltip.scheduleHide(200);
          } else {
            window.ContextDictTooltip.hideWordHint();
          }
        }
        return;
      }

      const wordInfo = getWordAtPosition(
        range.startContainer,
        range.startOffset,
      );
      if (!wordInfo) {
        clearTimeout(hoverTimer);
        clearTimeout(hintTimer);
        activeCandidateWord = "";
        if (window.ContextDictTooltip) {
          if (window.ContextDictTooltip.isVisible()) {
            window.ContextDictTooltip.scheduleHide(200);
          } else {
            window.ContextDictTooltip.hideWordHint();
          }
        }
        return;
      }

      // Ensure mouse cursor is actually within or directly adjacent to the word bounding rect
      // (document.caretRangeFromPoint projects to the nearest text node when cursor is in margins/whitespace)
      const pad = 4;
      const isOverWord =
        e.clientX >= wordInfo.rect.left - pad &&
        e.clientX <= wordInfo.rect.right + pad &&
        e.clientY >= wordInfo.rect.top - pad &&
        e.clientY <= wordInfo.rect.bottom + pad;

      if (!isOverWord) {
        clearTimeout(hoverTimer);
        clearTimeout(hintTimer);
        activeCandidateWord = "";
        if (window.ContextDictTooltip) {
          if (window.ContextDictTooltip.isVisible()) {
            window.ContextDictTooltip.scheduleHide(200);
          } else {
            window.ContextDictTooltip.hideWordHint();
          }
        }
        return;
      }

      const currentWordLower = wordInfo.word.toLowerCase();
      if (
        currentWordLower === lastEvaluatedWord.toLowerCase() &&
        window.ContextDictTooltip?.isVisible?.()
      ) {
        window.ContextDictTooltip.cancelHide();
        activeCandidateWord = currentWordLower;
        return;
      }

      if (currentWordLower === activeCandidateWord) {
        return;
      }

      activeCandidateWord = currentWordLower;
      clearTimeout(hoverTimer);
      clearTimeout(hintTimer);

      // If moving to a new word while previous tooltip was open, hide old tooltip and its underline immediately
      if (window.ContextDictTooltip) {
        if (window.ContextDictTooltip.isVisible()) {
          window.ContextDictTooltip.hide();
          lastEvaluatedWord = "";
        } else {
          window.ContextDictTooltip.hideWordHint();
        }
      }

      const jitterDelay = 40;
      hintTimer = setTimeout(() => {
        const res = window.ContextDictCollector.getSentenceContext(
          range.startContainer,
          range.startOffset,
        );
        let sentenceRects = [];
        if (res && res.range) {
          const rects = res.range.getClientRects();
          if (rects) {
            sentenceRects = Array.from(rects).map(r => ({
              top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height
            }));
          }
        }

        if (showHoverHint && isEnabled && window.ContextDictTooltip) {
          window.ContextDictTooltip.showWordHint(
            wordInfo.rect,
            Math.max(100, hoverDelay - jitterDelay),
            sentenceRects
          );
        }
      }, jitterDelay);

      hoverTimer = setTimeout(() => {
        triggerWordHover(
          wordInfo.word,
          range.startContainer,
          range.startOffset,
          wordInfo.rect,
          false,
        );
      }, hoverDelay);
    } catch (err) {
      console.error("[ContextDict:Detector] onMouseMove error:", err);
    }
  }

  function triggerWordHover(word, node, offset, rect, isSelection) {
    try {
      clearTimeout(hintTimer);
      lastEvaluatedWord = word;
      activeRect = rect;

      const trimmed = String(word || "").trim();
      const isSentence = Boolean(
        isSelection &&
          (trimmed.includes(" ") ||
            trimmed.length > 25 ||
            /[.!?。！？]$/.test(trimmed)),
      );
      const payloadType = isSentence ? "sentence" : "word";

      let sentence = "";
      let sentenceRects = [];

      if (isSentence) {
        sentence = trimmed;
      } else if (window.ContextDictCollector) {
        try {
          const res = window.ContextDictCollector.getSentenceContext(node, offset);
          if (typeof res === "string") {
            sentence = res;
          } else if (res && res.text) {
            sentence = res.text;
            if (res.range) {
              // Convert ClientRectList to a normal array so it can be passed via messages safely
              const rects = res.range.getClientRects();
              if (rects) {
                sentenceRects = Array.from(rects).map((r) => ({
                  top: r.top,
                  left: r.left,
                  bottom: r.bottom,
                  right: r.right,
                  width: r.width,
                  height: r.height,
                }));
              }
            }
          }
        } catch (ctxErr) {
          sentence = "";
        }
      }

      lastEvaluatedSentence = sentence;

      const isKorean = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(
        word || sentence,
      );
      const detectedLanguage = isKorean ? "ko" : "en";

      if (onWordHoverCallback) {
        onWordHoverCallback({
          type: payloadType,
          word: isSentence ? "" : trimmed,
          sentence,
          sentenceRects,
          rect,
          isSelection,
          detectedLanguage,
        });
      }
    } catch (err) {
      console.error("[ContextDict:Detector] triggerWordHover error:", err);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(err, "Detector:triggerWordHover", {
          word,
        });
      }
    }
  }

  function onMouseLeave() {
    try {
      clearTimeout(hoverTimer);
      clearTimeout(hintTimer);
      activeCandidateWord = "";
      lastEvaluatedWord = "";
      if (window.ContextDictTooltip) {
        window.ContextDictTooltip.hide();
      }
    } catch (err) {
      console.error("[ContextDict:Detector] onMouseLeave error:", err);
    }
  }

  window.ContextDictDetector = {
    init: function (options = {}) {
      try {
        isEnabled = options.enabled !== false;
        hoverDelay = options.hoverDelay || 1000;
        showHoverHint = options.showHoverHint !== false;
        onWordHoverCallback = options.onHover;

        document.addEventListener("mousemove", onMouseMove, { passive: true });
        document.addEventListener("mouseleave", onMouseLeave, {
          passive: true,
        });

        // Close on click outside tooltip
        document.addEventListener(
          "pointerdown",
          (e) => {
            try {
              if (!window.ContextDictTooltip?.isVisible?.()) return;
              if (
                e.target &&
                e.target.closest &&
                e.target.closest("contextdict-host")
              ) {
                return;
              }
              clearTimeout(hoverTimer);
              clearTimeout(hintTimer);
              activeCandidateWord = "";
              lastEvaluatedWord = "";
              window.ContextDictTooltip.hide();
            } catch (e) {}
          },
          { passive: true },
        );

        // Close on scroll or esc
        window.addEventListener(
          "scroll",
          () => {
            try {
              clearTimeout(hoverTimer);
              clearTimeout(hintTimer);
              activeCandidateWord = "";
              lastEvaluatedWord = "";
              if (window.ContextDictTooltip) {
                window.ContextDictTooltip.hide();
              }
            } catch (e) {}
          },
          { passive: true },
        );

        window.addEventListener("keydown", (e) => {
          try {
            if (e.key === "Escape") {
              clearTimeout(hoverTimer);
              clearTimeout(hintTimer);
              activeCandidateWord = "";
              lastEvaluatedWord = "";
              if (window.ContextDictTooltip) {
                window.ContextDictTooltip.hide();
              }
            }
          } catch (e) {}
        });
      } catch (err) {
        console.error("[ContextDict:Detector] init error:", err);
      }
    },

    updateConfig: function (config = {}) {
      if (typeof config.enabled === "boolean") isEnabled = config.enabled;
      if (config.hoverDelay) hoverDelay = config.hoverDelay;
      if (typeof config.showHoverHint === "boolean")
        showHoverHint = config.showHoverHint;
    },

    resetActiveWord: function () {
      activeCandidateWord = "";
      lastEvaluatedWord = "";
      lastEvaluatedSentence = "";
      clearTimeout(hoverTimer);
      clearTimeout(hintTimer);
      if (window.ContextDictTooltip) {
        window.ContextDictTooltip.hide();
      }
    },
  };
})();
