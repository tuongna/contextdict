// content/tooltip.js
// Shadow DOM Tooltip Component for ContextDict

(function () {
  let hostElement = null;
  let shadowRoot = null;
  let tooltipContainer = null;
  let hoverIndicator = null;
  let hoverIndicatorBar = null;
  let barAnimation = null;
  let currentWordData = null;
  let isMouseInsideTooltip = false;
  let hideTimer = null;
  let exitTimer = null;
  let sentenceIndicator = null;
  const ICONS = window.ContextDictTooltipStyles?.ICONS || {};
  const STYLES = window.ContextDictTooltipStyles?.STYLES || "";

  function cancelExit() {
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
  }

  function initHost() {
    if (hostElement && hostElement.parentNode) return;

    try {
      const existing = document.querySelector("contextdict-host");
      if (existing && existing.shadowRoot) {
        hostElement = existing;
        shadowRoot = existing.shadowRoot;
        tooltipContainer = shadowRoot.querySelector(".cd-tooltip-wrapper");
        hoverIndicator = shadowRoot.querySelector(".cd-hover-indicator");
        hoverIndicatorBar = hoverIndicator
          ? hoverIndicator.querySelector(".cd-hover-bar")
          : null;
        sentenceIndicator = shadowRoot.querySelector(".cd-sentence-indicator");
        return;
      }

      hostElement = document.createElement("contextdict-host");
      hostElement.style.cssText =
        "all: initial; position: absolute; top: 0; left: 0; z-index: 2147483647; pointer-events: none;";

      shadowRoot = hostElement.attachShadow({ mode: "open" });

      const styleEl = document.createElement("style");
      styleEl.textContent = STYLES;
      shadowRoot.appendChild(styleEl);

      tooltipContainer = document.createElement("div");
      tooltipContainer.className = "cd-tooltip-wrapper";
      shadowRoot.appendChild(tooltipContainer);

      hoverIndicator = document.createElement("div");
      hoverIndicator.className = "cd-hover-indicator";
      hoverIndicator.innerHTML =
        '<div class="cd-hover-dots"></div><div class="cd-hover-bar"></div>';
      shadowRoot.appendChild(hoverIndicator);
      hoverIndicatorBar = hoverIndicator.querySelector(".cd-hover-bar");

      sentenceIndicator = document.createElement("div");
      sentenceIndicator.className = "cd-sentence-indicator";
      shadowRoot.appendChild(sentenceIndicator);

      // Keep tooltip visible when mouse hovers over the tooltip
      tooltipContainer.addEventListener("mouseenter", () => {
        isMouseInsideTooltip = true;
        clearTimeout(hideTimer);
      });

      tooltipContainer.addEventListener("mouseleave", () => {
        isMouseInsideTooltip = false;
        scheduleHide(200);
      });

      (document.body || document.documentElement).appendChild(hostElement);
      syncRemRatio();
    } catch (err) {
      console.error("[ContextDict:Tooltip] initHost error:", err);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(err, "Tooltip:initHost");
      }
    }
  }

  function syncRemRatio() {
    try {
      if (!hostElement) return;
      const actualRootFontSize =
        parseFloat(
          window.getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      const remRatio = 16 / actualRootFontSize;
      hostElement.style.setProperty("--cd-rem-ratio", String(remRatio));
    } catch (e) {}
  }

  function renderSentenceRects(rects) {
    if (!sentenceIndicator) return;
    sentenceIndicator.innerHTML = "";
    if (!rects || !rects.length) return;

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    for (const r of rects) {
      if (r.width > 0 && r.height > 0) {
        const div = document.createElement("div");
        div.className = "cd-sentence-indicator-rect";
        div.style.left = `${r.left + scrollX}px`;
        div.style.top = `${r.bottom + scrollY - 2}px`;
        div.style.width = `${r.width}px`;
        sentenceIndicator.appendChild(div);
      }
    }
  }

  function showWordHint(rect, durationMs = 900, sentenceRects = []) {
    if (!rect) return;
    try {
      initHost();
      syncRemRatio();
      if (!hoverIndicator) return;

      if (
        hoverIndicator.classList.contains("cd-active") &&
        window.ContextDictTooltip.isVisible()
      ) {
        return;
      }

      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const wordWidth = Math.max(12, rect.width);

      hoverIndicator.style.left = `${rect.left + scrollX}px`;
      hoverIndicator.style.top = `${rect.bottom + scrollY - 1}px`;
      hoverIndicator.style.width = `${wordWidth}px`;

      hoverIndicator.classList.remove("cd-active");
      hoverIndicator.classList.add("cd-visible");

      if (hoverIndicatorBar) {
        if (barAnimation) {
          try {
            barAnimation.cancel();
          } catch (e) {}
          barAnimation = null;
        }
        hoverIndicatorBar.style.width = "0%";

        barAnimation = hoverIndicatorBar.animate(
          [{ width: "0%" }, { width: "100%" }],
          {
            duration: Math.max(100, durationMs),
            easing: "cubic-bezier(0.12, 0, 0.2, 1)",
            fill: "forwards",
          },
        );
      }

      renderSentenceRects(sentenceRects);
    } catch (err) {
      console.error("[ContextDict:Tooltip] showWordHint error:", err);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(err, "Tooltip:showWordHint");
      }
    }
  }

  function keepWordHintActive(rect, sentenceRects = []) {
    if (!rect) return;
    try {
      initHost();
      if (!hoverIndicator) return;

      if (hoverIndicator.classList.contains("cd-active")) {
        return;
      }

      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const wordWidth = Math.max(12, rect.width);

      hoverIndicator.style.left = `${rect.left + scrollX}px`;
      hoverIndicator.style.top = `${rect.bottom + scrollY - 1}px`;
      hoverIndicator.style.width = `${wordWidth}px`;

      hoverIndicator.classList.add("cd-visible", "cd-active");
      if (hoverIndicatorBar) {
        if (barAnimation) {
          try {
            barAnimation.finish();
          } catch (e) {}
        }
        hoverIndicatorBar.style.width = "100%";
      }
      if (sentenceRects && sentenceRects.length > 0) {
        renderSentenceRects(sentenceRects);
      }
    } catch (err) {
      console.error("[ContextDict:Tooltip] keepWordHintActive error:", err);
    }
  }

  function hideWordHint() {
    try {
      if (!hoverIndicator) return;
      if (barAnimation) {
        try {
          barAnimation.cancel();
        } catch (e) {}
        barAnimation = null;
      }
      hoverIndicator.classList.remove("cd-visible", "cd-active");
      if (hoverIndicatorBar) {
        hoverIndicatorBar.style.width = "0%";
      }
      if (sentenceIndicator) {
        sentenceIndicator.innerHTML = "";
      }
    } catch (err) {
      console.error("[ContextDict:Tooltip] hideWordHint error:", err);
    }
  }

  function cancelHide() {
    try {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    } catch (err) {
      console.error("[ContextDict:Tooltip] cancelHide error:", err);
    }
  }

  function scheduleHide(delay = 200) {
    try {
      if (isMouseInsideTooltip) return;
      if (hideTimer) return; // Keep existing timer running; do not restart countdown on mouse moves
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!isMouseInsideTooltip) {
          hideTooltip();
        }
      }, delay);
    } catch (err) {
      console.error("[ContextDict:Tooltip] scheduleHide error:", err);
    }
  }

  function hideTooltip() {
    try {
      cancelHide();
      cancelExit();
      hideWordHint();
      if (tooltipContainer) {
        tooltipContainer.classList.remove("cd-visible");
        exitTimer = setTimeout(() => {
          exitTimer = null;
          if (!tooltipContainer.classList.contains("cd-visible")) {
            tooltipContainer.style.display = "none";
          }
        }, 190);
      }
    } catch (err) {
      console.error("[ContextDict:Tooltip] hideTooltip error:", err);
    }
  }

  /**
   * Position tooltip smartly avoiding screen overflow and sentence boundaries
   */
  function positionTooltip(rect, sentenceRects = []) {
    try {
      if (!rect || !tooltipContainer) return;
      syncRemRatio();
      const margin = 8;
      const vw =
        window.innerWidth || document.documentElement.clientWidth || 360;
      const vh =
        window.innerHeight || document.documentElement.clientHeight || 400;
      const tooltipWidth = Math.min(376, vw - margin * 2);

      // Get actual rendered height (browser calculates this synchronously if display is block)
      const tooltipHeight = tooltipContainer.offsetHeight || 260;

      let sTop = rect.top;
      let sBottom = rect.bottom;
      if (sentenceRects && sentenceRects.length > 0) {
        sTop = Math.min(...sentenceRects.map((r) => r.top));
        sBottom = Math.max(...sentenceRects.map((r) => r.bottom));
      }

      let left = rect.left + (window.scrollX || window.pageXOffset || 0);
      let top = sBottom + (window.scrollY || window.pageYOffset || 0) + 4; // Default below sentence
      let isTopPlacement = false;

      // If near right edge of viewport
      if (rect.left + tooltipWidth > vw - margin) {
        left =
          vw -
          tooltipWidth -
          margin +
          (window.scrollX || window.pageXOffset || 0);
      }
      if (left < margin + (window.scrollX || window.pageXOffset || 0)) {
        left = margin + (window.scrollX || window.pageXOffset || 0);
      }

      // If bottom overflow, flip to above
      if (sBottom + tooltipHeight > vh - margin) {
        if (sTop > tooltipHeight + margin) {
          // Fits above the entire sentence
          top =
            sTop +
            (window.scrollY || window.pageYOffset || 0) -
            tooltipHeight -
            12;
          isTopPlacement = true;
        } else if (rect.top > tooltipHeight + margin) {
          // Fits above the word (might cover part of the sentence above)
          top =
            rect.top +
            (window.scrollY || window.pageYOffset || 0) -
            tooltipHeight -
            12;
          isTopPlacement = true;
        } else {
          // Doesn't fit above either, fallback to below the word
          top = rect.bottom + (window.scrollY || window.pageYOffset || 0) + 12;
        }
      }

      if (isTopPlacement) {
        tooltipContainer.classList.add("cd-placement-top");
      } else {
        tooltipContainer.classList.remove("cd-placement-top");
      }

      tooltipContainer.style.left = `${Math.max(4, left)}px`;
      tooltipContainer.style.top = `${Math.max(4, top)}px`;
    } catch (err) {
      console.error("[ContextDict:Tooltip] positionTooltip error:", err);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(err, "Tooltip:positionTooltip");
      }
    }
  }

  /**
   * Show loading skeleton
   */
  function showLoading(word, rect, sentenceRects = [], type = "word") {
    try {
      initHost();
      cancelExit();
      cancelHide();
      clearTimeout(hideTimer);
      keepWordHintActive(rect, sentenceRects);

      const isSentence = Boolean(
        type === "sentence" ||
        (!word && sentenceRects.length > 0) ||
        (typeof word === "string" && (word.length > 35 || word.includes(" ")))
      );
      const displayText = typeof word === "string" ? word.trim() : "";
      const truncatedPreview = displayText.length > 35 ? displayText.slice(0, 32) + "…" : displayText;

      tooltipContainer.innerHTML = isSentence
        ? `
        <div class="cd-card cd-sentence-card">
          <div class="cd-header">
            <div class="cd-word-info">
              <span class="cd-badge cd-badge-sentence">Câu văn</span>
              ${truncatedPreview ? `<span class="cd-word" style="font-size: 0.95rem;">${escapeHtml(truncatedPreview)}</span>` : `<span class="cd-skeleton" style="width: 5rem; height: 1.25rem; border-radius: 4px;"></span>`}
            </div>
          </div>
          <div class="cd-body">
            <div class="cd-sk-card">
              <div class="cd-skeleton" style="width: 4rem; height: 0.875rem; margin-bottom: 0.5rem;"></div>
              <div class="cd-skeleton" style="width: 96%; height: 1.1rem; margin-bottom: 0.375rem;"></div>
              <div class="cd-skeleton" style="width: 78%; height: 1.1rem;"></div>
            </div>
          </div>
          <div class="cd-footer">
            <span style="display: inline-flex; align-items: center; gap: 0.45rem;">
              <span class="cd-loading-dot"></span>
              <span style="font-weight: 500;">Đang dịch câu văn…</span>
            </span>
            <span class="cd-source-tag"><span class="cd-svg-icon">${ICONS.ai}</span>AI</span>
          </div>
        </div>
      `
        : `
        <div class="cd-card">
          <div class="cd-header">
            <div class="cd-word-info">
              <span class="cd-word">${escapeHtml(word || "")}</span>
              <span class="cd-skeleton" style="width: 3.5rem; height: 1.25rem; border-radius: 4px;"></span>
            </div>
          </div>
          <div class="cd-body">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <div class="cd-skeleton" style="width: 2.75rem; height: 0.875rem;"></div>
              <div class="cd-skeleton cd-skeleton-cyan" style="width: 10.5rem; height: 1.35rem; border-radius: 0.375rem;"></div>
            </div>
            <div class="cd-sk-card">
              <div class="cd-skeleton" style="width: 6.5rem; height: 0.875rem; margin-bottom: 0.5rem;"></div>
              <div class="cd-skeleton" style="width: 96%; height: 0.9375rem; margin-bottom: 0.375rem;"></div>
              <div class="cd-skeleton" style="width: 72%; height: 0.9375rem;"></div>
            </div>
            <div class="cd-sk-card">
              <div class="cd-skeleton" style="width: 8rem; height: 0.875rem; margin-bottom: 0.5rem;"></div>
              <div class="cd-skeleton" style="width: 92%; height: 0.875rem; margin-bottom: 0.375rem;"></div>
              <div class="cd-skeleton" style="width: 65%; height: 0.875rem;"></div>
            </div>
          </div>
          <div class="cd-footer">
            <span style="display: inline-flex; align-items: center; gap: 0.45rem;">
              <span class="cd-loading-dot"></span>
              <span style="font-weight: 500;">Đang phân tích ngữ cảnh…</span>
            </span>
            <span class="cd-source-tag"><span class="cd-svg-icon">${ICONS.ai}</span>AI</span>
          </div>
        </div>
      `;

      bindBasicEvents();
      positionTooltip(rect, sentenceRects);

      tooltipContainer.style.display = "block";
      tooltipContainer.classList.add("cd-visible");
    } catch (err) {
      console.error("[ContextDict:Tooltip] showLoading error:", err);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(err, "Tooltip:showLoading", { word });
      }
    }
  }

  /**
   * Render error or requirement state
   */
  function showError(word, errorMessage, requiresKey, rect, onRetry) {
    try {
      initHost();
      cancelExit();
      cancelHide();
      clearTimeout(hideTimer);
      if (rect) {
        keepWordHintActive(rect);
      }

      const isAlreadyVisible =
        tooltipContainer.classList.contains("cd-visible") &&
        tooltipContainer.style.display !== "none";

      const retryBtnHtml = !requiresKey && onRetry
        ? `
          <button type="button" class="cd-retry-btn" aria-label="Thử lại bản dịch">
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            <span>Thử lại</span>
          </button>
        `
        : "";

      tooltipContainer.innerHTML = `
        <div class="cd-card">
          <div class="cd-header">
            <div class="cd-word-info">
              <span class="cd-word">${escapeHtml(word)}</span>
            </div>
          </div>
          <div class="cd-body cd-content-fade">
            <div class="cd-alert ${requiresKey ? "cd-alert-info" : ""}">
              <strong><span class="cd-svg-icon">${requiresKey ? ICONS.key : ICONS.alert}</span>${requiresKey ? "Cần API Key" : "Lỗi dịch"}</strong>
              <p style="margin-top: 0.25rem;">${escapeHtml(errorMessage)}</p>
              ${requiresKey ? '<p style="margin-top: 0.375rem; font-size: 0.6875rem; opacity: 0.9;">Bấm vào biểu tượng ContextDict trên thanh tiện ích Chrome để nhập OpenRouter API Key.</p>' : ""}
              ${retryBtnHtml}
            </div>
          </div>
          <div class="cd-footer">
            <span>ContextDict</span>
          </div>
        </div>
      `;

      bindBasicEvents();
      if (onRetry) {
        const retryBtn = tooltipContainer?.querySelector(".cd-retry-btn");
        if (retryBtn) {
          retryBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            retryBtn.classList.add("cd-spinning");
            retryBtn.disabled = true;
            try {
              await onRetry();
            } catch (err) {
              retryBtn.classList.remove("cd-spinning");
              retryBtn.disabled = false;
            }
          });
        }
      }
      positionTooltip(rect);

      tooltipContainer.style.display = "block";
      tooltipContainer.classList.add("cd-visible");
    } catch (err) {
      console.error("[ContextDict:Tooltip] showError error:", err);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(err, "Tooltip:showError", {
          word,
          errorMessage,
        });
      }
    }
  }

  /**
   * Render complete translation card
   */
  function showTranslation({
    type,
    word,
    data,
    fromCache,
    isSaved,
    sentence,
    rect,
    sentenceRects,
    showRomaja = true,
    onSaveToggle,
    onRetranslate,
  }) {
    try {
      initHost();
      cancelExit();
      cancelHide();
      clearTimeout(hideTimer);
      keepWordHintActive(rect, sentenceRects);

      const isSentence = Boolean(
        type === "sentence" ||
          data?.type === "sentence" ||
          (!word && (sentence || data?.sentence))
      );

      currentWordData = { type: isSentence ? "sentence" : "word", isSentence, word, data, isSaved, sentence };

      const isAlreadyVisible =
        tooltipContainer.classList.contains("cd-visible") &&
        tooltipContainer.style.display !== "none";

      const targetText = isSentence ? (data?.sentence || sentence || word || "") : word;
      const isKorean =
        data?.language === "ko" ||
        /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(targetText);

      // Defensive sanitization: ensure no raw JSON or unparsed strings leak into the UI
      let safeTranslation = data?.translation || "";
      if (
        typeof safeTranslation === "string" &&
        (safeTranslation.includes("```") ||
          safeTranslation.includes('{"translation"') ||
          safeTranslation.includes('"translation":'))
      ) {
        const match = safeTranslation.match(
          /"translation"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/i,
        );
        if (match) {
          safeTranslation = match[1].replace(/\\"/g, '"');
        } else {
          safeTranslation = safeTranslation
            .replace(/```(?:json)?/gi, "")
            .replace(/[{}\"]/g, "")
            .replace(/translation:/i, "")
            .trim();
        }
      }

      let safeContextNote = data?.contextNote || "";
      if (
        typeof safeContextNote === "string" &&
        (safeContextNote.includes("```") || safeContextNote.includes('{"'))
      ) {
        safeContextNote = "";
      }

      if (isSentence) {
        // ==========================================
        // SENTENCE TRANSLATION CARD
        // ==========================================
        const langLabel = isKorean ? "Tiếng Hàn" : "Tiếng Anh";

        tooltipContainer.innerHTML = `
          <div class="cd-card cd-sentence-card">
            <div class="cd-header">
              <div class="cd-word-info">
                <span class="cd-badge cd-badge-sentence">${langLabel} • Câu văn</span>
              </div>
              <div class="cd-actions">
                <nat-icon-button class="cd-btn cd-refresh-btn" size="small" variant="standard" title="Dịch lại câu (bỏ qua cache)" aria-label="Dịch lại câu này">
                  <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                </nat-icon-button>
                <nat-icon-button class="cd-btn cd-tts-btn" size="small" variant="standard" title="Nghe phát âm cả câu" aria-label="Phát âm câu">
                  <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                </nat-icon-button>
                <nat-icon-button class="cd-btn cd-copy-btn" size="small" variant="standard" title="Sao chép bản dịch" aria-label="Sao chép bản dịch">
                  ${ICONS.copy}
                </nat-icon-button>
              </div>
            </div>

            <div class="cd-body cd-content-fade">
              <div class="cd-source-sentence-box">
                <div class="cd-source-sentence-text">${escapeHtml(targetText)}</div>
              </div>

              <div class="cd-translation-row cd-sentence-translation-row">
                <span class="cd-translation-label">Bản dịch:</span>
                <span class="cd-translation cd-sentence-translation">${escapeHtml(safeTranslation || "Chưa có bản dịch.")}</span>
              </div>

              ${
                safeContextNote
                  ? `
                <div class="cd-context-box cd-context-note-box">
                  <div class="cd-context-header">
                    <span class="icon cd-svg-icon">${ICONS.book}</span>
                    <span>Ghi chú ngữ cảnh</span>
                  </div>
                  <div class="cd-context-desc">${escapeHtml(safeContextNote)}</div>
                </div>
              `
                  : ""
              }
            </div>

            <div class="cd-footer">
              <span class="cd-source-tag"><span class="cd-svg-icon">${fromCache ? ICONS.bolt : ICONS.ai}</span>${fromCache ? "Bộ nhớ đệm câu" : "AI Dịch câu"}</span>
              <span>ContextDict</span>
            </div>
          </div>
        `;
      } else {
        // ==========================================
        // WORD TRANSLATION CARD
        // ==========================================
        const originalFormHtml =
          data?.originalForm && data.originalForm !== word
            ? `<span class="cd-original-form">(Gốc: ${escapeHtml(data.originalForm)})</span>`
            : "";

        const shouldShowPhonetic = isKorean ? showRomaja !== false : true;
        const phonetic = (data?.phonetic && shouldShowPhonetic)
          ? `<span class="cd-phonetic">${escapeHtml(data.phonetic)}</span>`
          : "";
        const partOfSpeech = data?.partOfSpeech
          ? `<span class="cd-badge">${escapeHtml(data.partOfSpeech)}</span>`
          : "";

        // Sanitize sentenceTranslation — never show raw JSON or template strings
        let safeSentenceTranslation = data?.sentenceTranslation || "";
        if (
          typeof safeSentenceTranslation === "string" &&
          (safeSentenceTranslation.includes("```") ||
            safeSentenceTranslation.includes('{"') ||
            safeSentenceTranslation.includes('"translation"') ||
            safeSentenceTranslation.includes("để trống"))
        ) {
          safeSentenceTranslation = "";
        }

        const starClass = isSaved
          ? "cd-btn cd-save-btn cd-saved"
          : "cd-btn cd-save-btn";
        const starTitle = isSaved ? "Bỏ lưu từ này" : "Lưu vào sổ từ vựng";

        tooltipContainer.innerHTML = `
          <div class="cd-card">
            <div class="cd-header">
              <div class="cd-word-info">
                <span class="cd-word">${escapeHtml(word)}</span>
                ${originalFormHtml}
                ${phonetic}
                ${partOfSpeech}
              </div>
              <div class="cd-actions">
                <nat-icon-button class="cd-btn cd-refresh-btn" size="small" variant="standard" title="Dịch lại (bỏ qua cache)" aria-label="Dịch lại kết quả này">
                  <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                </nat-icon-button>
                <nat-icon-button class="cd-btn cd-tts-btn" size="small" variant="standard" title="Nghe phát âm" aria-label="Phát âm từ vựng">
                  <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                </nat-icon-button>
                <nat-icon-button class="${starClass}" size="small" variant="standard" title="${starTitle}" aria-label="${starTitle}">
                  <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                </nat-icon-button>
              </div>
            </div>

            <div class="cd-body cd-content-fade">
              <div class="cd-translation-row">
                <span class="cd-translation-label">Dịch:</span>
                <span class="cd-translation">${escapeHtml(safeTranslation || "Chưa có bản dịch.")}</span>
              </div>

              ${
                safeSentenceTranslation
                  ? `
                <div class="cd-context-box cd-sentence-translation-box">
                  <div class="cd-context-header">
                    <span class="icon cd-svg-icon">${ICONS.translate || ICONS.book}</span>
                    <span>Dịch cả câu</span>
                  </div>
                  <div class="cd-context-desc cd-sentence-translation-text">${escapeHtml(safeSentenceTranslation)}</div>
                </div>
              `
                  : ""
              }

              ${
                safeContextNote
                  ? `
                <div class="cd-context-box cd-context-note-box">
                  <div class="cd-context-header">
                    <span class="icon cd-svg-icon">${ICONS.book}</span>
                    <span>Ghi chú ngữ cảnh</span>
                  </div>
                  <div class="cd-context-desc">${escapeHtml(safeContextNote)}</div>
                </div>
              `
                  : ""
              }
            </div>

            <div class="cd-footer">
              <span class="cd-source-tag"><span class="cd-svg-icon">${fromCache ? ICONS.bolt : ICONS.ai}</span>${fromCache ? "Bộ nhớ đệm" : "AI Phân tích"}</span>
              <span>ContextDict</span>
            </div>
          </div>
        `;
      }

      bindInteractiveEvents(onSaveToggle, onRetranslate);
      positionTooltip(rect, sentenceRects);

      tooltipContainer.style.display = "block";
      tooltipContainer.classList.add("cd-visible");
    } catch (renderError) {
      console.error("[ContextDict:Tooltip] Render error:", renderError);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(renderError, "Tooltip:showTranslation", {
          word,
        });
      }
      showError(
        word,
        "Lỗi kết xuất bản dịch: " + renderError.message,
        false,
        rect,
        onRetranslate,
      );
    }
  }

  function bindBasicEvents() {
    try {
      const closeBtn = tooltipContainer?.querySelector(".cd-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          hideTooltip();
        });
      }
    } catch (err) {
      console.error("[ContextDict:Tooltip] bindBasicEvents error:", err);
    }
  }

  function bindInteractiveEvents(onSaveToggle, onRetranslate) {
    try {
      bindBasicEvents();

      const refreshBtn = tooltipContainer?.querySelector(".cd-refresh-btn");
      if (refreshBtn && onRetranslate) {
        refreshBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (refreshBtn.classList.contains("cd-spinning")) return;
          try {
            refreshBtn.classList.add("cd-spinning");
            refreshBtn.setAttribute("disabled", "true");
            refreshBtn.title = "Đang phân tích dịch lại…";

            // Update footer status while re-translating
            const footer = tooltipContainer?.querySelector(".cd-footer");
            if (footer) {
              const sourceTag = footer.querySelector(".cd-source-tag");
              if (sourceTag) {
                sourceTag.innerHTML = `<span class="cd-loading-dot"></span> Đang dịch lại…`;
              }
            }

            await onRetranslate();
          } catch (retransErr) {
            console.error(
              "[ContextDict:Tooltip] Retranslate click error:",
              retransErr,
            );
            refreshBtn.classList.remove("cd-spinning");
            refreshBtn.removeAttribute("disabled");
            refreshBtn.title = "Dịch lại (bỏ qua cache)";
          }
        });
      }

      const ttsBtn = tooltipContainer?.querySelector(".cd-tts-btn");
      if (ttsBtn && currentWordData) {
        ttsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          try {
            if (window.ContextDictTTS) {
              const textToSpeak = currentWordData.isSentence
                ? (currentWordData.sentence || currentWordData.word)
                : (currentWordData.word || currentWordData.sentence);
              const isKo =
                currentWordData.data?.language === "ko" ||
                /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(textToSpeak);
              window.ContextDictTTS.speak(textToSpeak, isKo ? "ko" : "en");
            }
          } catch (ttsErr) {
            console.error("[ContextDict:Tooltip] TTS click error:", ttsErr);
            if (typeof window.ContextDictReportError === "function") {
              window.ContextDictReportError(ttsErr, "Tooltip:ttsClick", {
                word: currentWordData?.word,
              });
            }
          }
        });
      }

      const copyBtn = tooltipContainer?.querySelector(".cd-copy-btn");
      if (copyBtn && currentWordData) {
        copyBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            const textToCopy = currentWordData.data?.translation || "";
            if (textToCopy && navigator.clipboard) {
              await navigator.clipboard.writeText(textToCopy);
              copyBtn.classList.add("cd-copied");
              copyBtn.title = "Đã sao chép bản dịch!";
              setTimeout(() => {
                copyBtn.classList.remove("cd-copied");
                copyBtn.title = "Sao chép bản dịch";
              }, 1500);
            }
          } catch (copyErr) {
            console.warn("[ContextDict:Tooltip] Copy failed:", copyErr);
          }
        });
      }

      const saveBtn = tooltipContainer?.querySelector(".cd-save-btn");
      if (saveBtn && currentWordData && onSaveToggle) {
        saveBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            const nextSavedState = !currentWordData.isSaved;
            currentWordData.isSaved = nextSavedState;

            if (nextSavedState) {
              saveBtn.classList.add("cd-saved");
              saveBtn.title = "Bỏ lưu từ này";
              saveBtn.setAttribute("aria-label", "Bỏ lưu từ này");
            } else {
              saveBtn.classList.remove("cd-saved");
              saveBtn.title = "Lưu vào sổ từ vựng";
              saveBtn.setAttribute("aria-label", "Lưu vào sổ từ vựng");
            }

            await onSaveToggle(currentWordData, nextSavedState);
          } catch (saveErr) {
            console.error("[ContextDict:Tooltip] Save toggle error:", saveErr);
            if (typeof window.ContextDictReportError === "function") {
              window.ContextDictReportError(saveErr, "Tooltip:saveToggle", {
                word: currentWordData?.word,
              });
            }
          }
        });
      }
    } catch (err) {
      console.error("[ContextDict:Tooltip] bindInteractiveEvents error:", err);
      if (typeof window.ContextDictReportError === "function") {
        window.ContextDictReportError(err, "Tooltip:bindInteractiveEvents");
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.ContextDictTooltip = {
    showLoading,
    showError,
    showTranslation,
    scheduleHide,
    cancelHide,
    hide: hideTooltip,
    showWordHint,
    keepWordHintActive,
    hideWordHint,
    isVisible: () =>
      !!(tooltipContainer && tooltipContainer.classList.contains("cd-visible")),
  };
})();
