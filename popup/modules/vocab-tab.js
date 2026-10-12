// popup/modules/vocab-tab.js
// Vocabulary notebook tab logic for ContextDict popup

import { ICONS } from "./icons.js";
import { escapeHtml, getDomain, safeReportError } from "./utils.js";
import { showFeedback } from "./feedback.js";

let fullVocabulary = [];

export function initVocabTab() {
  const vocabCountBadge = document.getElementById("vocabCountBadge");
  const vocabSummaryText = document.getElementById("vocabSummaryText");
  const searchVocab = document.getElementById("searchVocab");
  const clearSearch = document.getElementById("clearSearch");
  const vocabList = document.getElementById("vocabList");
  const vocabEmpty = document.getElementById("vocabEmpty");
  const exportVocabBtn = document.getElementById("exportVocabBtn");
  const clearVocabBtn = document.getElementById("clearVocabBtn");
  const vocabLangFilters = document.getElementById("vocabLangFilters");

  let currentLangFilter = "all";

  function updateVocabCount(count) {
    try {
      if (vocabCountBadge) {
        vocabCountBadge.textContent = String(count);
        vocabCountBadge.setAttribute("value", String(count));
      }
      if (vocabSummaryText) vocabSummaryText.textContent = `${count} từ vựng`;
    } catch (e) {}
  }

  function renderVocabCards(items) {
    try {
      if (!vocabList || !vocabEmpty) return;
      vocabList.innerHTML = "";
      if (!items || items.length === 0) {
        vocabEmpty.classList.remove("hidden");
        return;
      }

      vocabEmpty.classList.add("hidden");

      items.forEach((item) => {
        const card = document.createElement("nat-card");
        card.setAttribute("variant", "elevated");
        card.className = "vocab-card";

        const dateStr = item.savedAt
          ? new Date(item.savedAt).toLocaleDateString("vi-VN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        const sourceHostname = item.sourceUrl ? getDomain(item.sourceUrl) : "";
        const langCode =
          item.language === "ko" ||
          /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(item.word)
            ? "ko"
            : "en";
        const langBadge = `<span class="vocab-lang-tag ${langCode === "ko" ? "lang-ko" : "lang-en"}">${langCode.toUpperCase()}</span>`;
        const originalFormHtml =
          item.originalForm && item.originalForm !== item.word
            ? `<span class="vocab-original-form">(Gốc: ${escapeHtml(item.originalForm)})</span>`
            : "";
        const phoneticHtml = item.phonetic
          ? `<span class="vocab-phonetic">${escapeHtml(item.phonetic)}</span>`
          : "";

        card.innerHTML = `
          <div class="vocab-card-header">
            <div class="vocab-word-row">
              ${langBadge}
              <span class="vocab-word">${escapeHtml(item.word)}</span>
              ${originalFormHtml}
              ${phoneticHtml}
              <span class="vocab-trans">${escapeHtml(item.translation)}</span>
            </div>
            <div class="vocab-card-actions">
              <nat-icon-button class="card-btn card-btn-retranslate" size="small" variant="standard" title="Dịch lại (bỏ qua cache & cập nhật)" aria-label="Dịch lại từ này">${ICONS.refresh}</nat-icon-button>
              <nat-icon-button class="card-btn card-btn-tts" size="small" variant="standard" title="Nghe phát âm" aria-label="Phát âm từ vựng">${ICONS.volume}</nat-icon-button>
              <nat-icon-button class="card-btn card-btn-delete" size="small" variant="standard" title="Xoá từ này" aria-label="Xoá từ khỏi sổ từ vựng">${ICONS.trash}</nat-icon-button>
            </div>
          </div>

          ${item.sentence ? `<div class="vocab-sentence">"${escapeHtml(item.sentence)}"</div>` : ""}

          ${
            item.contextNote
              ? `
            <div class="vocab-contexts">
              <div><strong><span class="vocab-ctx-icon">${ICONS.book}</span> Ghi chú:</strong> ${escapeHtml(item.contextNote)}</div>
            </div>
          `
              : ""
          }

          <div class="vocab-meta">
            <span>${dateStr}</span>
            ${item.sourceUrl ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" class="vocab-source" title="${escapeHtml(item.sourceUrl)}">${escapeHtml(sourceHostname || item.pageTitle || "Nguồn")}</a>` : ""}
          </div>
        `;

        // Retranslate Click
        const retransBtn = card.querySelector(".card-btn-retranslate");
        if (retransBtn) {
          retransBtn.addEventListener("click", () => {
            if (retransBtn.classList.contains("btn-spinning")) return;
            retransBtn.classList.add("btn-spinning");
            retransBtn.setAttribute("disabled", "true");

            chrome.runtime.sendMessage(
              {
                type: "TRANSLATE",
                word: item.word,
                sentence: item.sentence || "",
                pageContext: {
                  title: item.pageTitle || "",
                  url: item.sourceUrl || "",
                },
                detectedLanguage: langCode,
                bypassCache: true,
              },
              (res) => {
                retransBtn.classList.remove("btn-spinning");
                retransBtn.removeAttribute("disabled");

                if (chrome.runtime.lastError || !res?.success) {
                  const errMsg =
                    res?.error ||
                    chrome.runtime.lastError?.message ||
                    "Dịch lại thất bại, vui lòng thử lại";
                  showFeedback(errMsg, "error");
                  return;
                }

                if (res.data) {
                  item.translation = res.data.translation || item.translation;
                  if (res.data.phonetic) item.phonetic = res.data.phonetic;
                  if (res.data.originalForm)
                    item.originalForm = res.data.originalForm;
                  if (res.data.contextNote)
                    item.contextNote = res.data.contextNote;

                  const transEl = card.querySelector(".vocab-trans");
                  if (transEl) transEl.textContent = item.translation;

                  const origEl = card.querySelector(".vocab-original-form");
                  if (origEl && item.originalForm) {
                    origEl.textContent = `(Gốc: ${item.originalForm})`;
                  }

                  const noteContainer = card.querySelector(".vocab-contexts");
                  if (noteContainer && item.contextNote) {
                    noteContainer.innerHTML = `<div><strong><span class="vocab-ctx-icon">${ICONS.book}</span> Ghi chú:</strong> ${escapeHtml(item.contextNote)}</div>`;
                  }

                  showFeedback("Đã cập nhật bản dịch mới!", "success");
                }
              },
            );
          });
        }

        // TTS Click
        const ttsBtn = card.querySelector(".card-btn-tts");
        if (ttsBtn) {
          ttsBtn.addEventListener("click", () => {
            try {
              const ttsLang = langCode === "ko" ? "ko" : "en";
              const webSpeechLang = langCode === "ko" ? "ko-KR" : "en-US";
              if (chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage(
                  { type: "PLAY_TTS", text: item.word, lang: ttsLang },
                  (res) => {
                    if (chrome.runtime.lastError || !res?.success) {
                      if ("speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(item.word);
                        u.lang = webSpeechLang;
                        window.speechSynthesis.speak(u);
                      }
                    }
                  }
                );
              } else if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(item.word);
                u.lang = webSpeechLang;
                window.speechSynthesis.speak(u);
              }
            } catch (ttsErr) {
              safeReportError(ttsErr, "Popup:vocabTTS", { word: item.word });
            }
          });
        }

        // Delete Click
        const delBtn = card.querySelector(".card-btn-delete");
        if (delBtn) {
          delBtn.addEventListener("click", () => {
            try {
              chrome.runtime.sendMessage(
                {
                  type: "REMOVE_WORD",
                  identifier: item.id || item.word,
                },
                (res) => {
                  if (res && res.success) {
                    fullVocabulary = fullVocabulary.filter(
                      (v) => (v.id || v.word) !== (item.id || item.word),
                    );
                    updateVocabCount(fullVocabulary.length);
                    renderVocabCards(filterVocabulary(searchVocab?.value));
                  }
                },
              );
            } catch (delErr) {
              safeReportError(delErr, "Popup:vocabDelete", { word: item.word });
            }
          });
        }

        vocabList.appendChild(card);
      });
    } catch (renderErr) {
      safeReportError(renderErr, "Popup:renderVocabCards");
    }
  }

  function filterVocabulary(query) {
    try {
      let filtered = fullVocabulary;
      if (currentLangFilter !== "all") {
        filtered = filtered.filter((item) => {
          const itemLang =
            item.language === "ko" ||
            /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(item.word)
              ? "ko"
              : "en";
          return itemLang === currentLangFilter;
        });
      }
      const q = (query || "").trim().toLowerCase();
      if (!q) return filtered;
      return filtered.filter(
        (item) =>
          (item.word && item.word.toLowerCase().includes(q)) ||
          (item.translation && item.translation.toLowerCase().includes(q)) ||
          (item.sentence && item.sentence.toLowerCase().includes(q)) ||
          (item.originalForm && item.originalForm.toLowerCase().includes(q)) ||
          (item.phonetic && item.phonetic.toLowerCase().includes(q)),
      );
    } catch (e) {
      return fullVocabulary;
    }
  }

  // Filter input
  if (searchVocab) {
    const handleSearch = () => {
      try {
        const q = searchVocab.value || "";
        if (clearSearch) clearSearch.style.display = q ? "block" : "none";
        renderVocabCards(filterVocabulary(q));
      } catch (e) {}
    };

    searchVocab.addEventListener("input", handleSearch);
    searchVocab.addEventListener("natInput", (e) => {
      if (e.detail !== undefined) searchVocab.value = e.detail;
      handleSearch();
    });
    searchVocab.addEventListener("natClear", () => {
      searchVocab.value = "";
      if (clearSearch) clearSearch.style.display = "none";
      renderVocabCards(fullVocabulary);
    });
  }

  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      try {
        if (searchVocab) searchVocab.value = "";
        clearSearch.style.display = "none";
        renderVocabCards(filterVocabulary(""));
      } catch (e) {}
    });
  }

  // Language filter tabs (All / English / Korean)
  if (vocabLangFilters) {
    vocabLangFilters.addEventListener("click", (e) => {
      const pill = e.target.closest(".lang-pill");
      if (!pill) return;
      const selectedLang = pill.getAttribute("data-lang") || "all";
      if (selectedLang === currentLangFilter) return;

      currentLangFilter = selectedLang;
      vocabLangFilters.querySelectorAll(".lang-pill").forEach((p) => {
        const isCurrent = p === pill;
        p.classList.toggle("active", isCurrent);
        p.setAttribute("aria-selected", isCurrent ? "true" : "false");
      });

      renderVocabCards(filterVocabulary(searchVocab?.value));
    });
  }

  // Export vocabulary
  if (exportVocabBtn) {
    exportVocabBtn.addEventListener("click", () => {
      try {
        if (fullVocabulary.length === 0) {
          alert("Chưa có từ vựng nào để xuất.");
          return;
        }
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(fullVocabulary, null, 2));
        const dlAnchor = document.createElement("a");
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute(
          "download",
          `contextdict-vocabulary-${new Date().toISOString().slice(0, 10)}.json`,
        );
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
      } catch (err) {
        safeReportError(err, "Popup:exportVocab");
      }
    });
  }

  // Clear all vocabulary
  if (clearVocabBtn) {
    clearVocabBtn.addEventListener("click", () => {
      try {
        if (fullVocabulary.length === 0) return;
        if (confirm("Bạn có chắc chắn muốn xoá toàn bộ sổ từ vựng không?")) {
          chrome.runtime.sendMessage({ type: "CLEAR_VOCABULARY" }, (res) => {
            if (res && res.success) {
              fullVocabulary = [];
              updateVocabCount(0);
              renderVocabCards([]);
            }
          });
        }
      } catch (err) {
        safeReportError(err, "Popup:clearVocab");
      }
    });
  }

  // Load Vocabulary list
  function loadVocabulary() {
    try {
      chrome.runtime.sendMessage({ type: "GET_VOCABULARY" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          // Fallback to direct chrome.storage.local access
          chrome.storage.local.get(["vocabulary"], (res) => {
            fullVocabulary = res?.vocabulary || [];
            updateVocabCount(fullVocabulary.length);
            renderVocabCards(filterVocabulary(searchVocab?.value));
          });
          return;
        }
        fullVocabulary = response.vocabulary || [];
        updateVocabCount(fullVocabulary.length);
        renderVocabCards(filterVocabulary(searchVocab?.value));
      });
    } catch (err) {
      safeReportError(err, "Popup:loadVocabulary");
      // Fallback
      chrome.storage.local.get(["vocabulary"], (res) => {
        fullVocabulary = res?.vocabulary || [];
        updateVocabCount(fullVocabulary.length);
        renderVocabCards(filterVocabulary(searchVocab?.value));
      });
    }
  }

  // Initial load
  loadVocabulary();

  return {
    loadVocabulary,
  };
}
