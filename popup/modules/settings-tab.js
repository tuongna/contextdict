// popup/modules/settings-tab.js
// Settings tab logic for ContextDict popup

import { ICONS } from "./icons.js";
import { showFeedback } from "./feedback.js";
import { safeReportError } from "./utils.js";

export function initSettingsTab() {
  const toggleEnabled = document.getElementById("toggleEnabled");
  const settingsForm = document.getElementById("settingsForm");
  const apiKeyInput = document.getElementById("apiKey");
  const modelSelect = document.getElementById("modelSelect");
  const errorReportEmail = document.getElementById("errorReportEmail");
  const toggleKeyVisibility = document.getElementById("toggleKeyVisibility");
  const hoverDelay = document.getElementById("hoverDelay");
  const hoverDelayValue = document.getElementById("hoverDelayValue");
  const showHoverHint = document.getElementById("showHoverHint");
  const highlightSaved = document.getElementById("highlightSaved");
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  const submitErrorsBtn = document.getElementById("submitErrorsBtn");
  const copyDebugLogBtn = document.getElementById("copyDebugLogBtn");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const bannerOpenOptionsBtn = document.getElementById("bannerOpenOptionsBtn");
  const linkOpenOptionsBtn = document.getElementById("linkOpenOptionsBtn");
  const footerOptionsLink = document.getElementById("footerOptionsLink");
  const quickModelSelect = document.getElementById("quickModelSelect");
  const quickModelDot = document.getElementById("quickModelDot");
  const quickModelScoreBadge = document.getElementById("quickModelScoreBadge");

  let popupCachedStats = {};

  function updateQuickModelBadge(modelId) {
    if (!quickModelScoreBadge) return;
    const stat = popupCachedStats[modelId];
    if (!stat || !stat.total) {
      quickModelScoreBadge.className = "quick-model-score grade-none";
      quickModelScoreBadge.textContent = "—";
      quickModelScoreBadge.title = "Chưa có lượt request nào cho mô hình này";
      return;
    }

    const grade = stat.grade || "—";
    const score = stat.score != null ? stat.score : 0;
    const rate = stat.successRate || 0;
    let cls = "grade-none";
    if (grade === "A+") cls = "grade-aplus";
    else if (grade === "A") cls = "grade-a";
    else if (grade === "B") cls = "grade-b";
    else if (grade === "C") cls = "grade-c";
    else if (grade === "D") cls = "grade-d";
    else if (grade === "F") cls = "grade-f";

    quickModelScoreBadge.className = `quick-model-score ${cls}`;
    quickModelScoreBadge.textContent = `${grade} ${score}đ`;
    quickModelScoreBadge.title = `Đánh giá: ${grade} (${score}/100đ) • Tỉ lệ thành công: ${rate}% (${stat.success}/${stat.total} lượt • ${stat.pings || 0} ping, ${stat.translations || 0} dịch)`;
  }

  function openOptions() {
    try {
      if (chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL("options/options.html"));
      }
    } catch (err) {
      safeReportError(err, "Popup:openOptions");
    }
  }

  if (openOptionsBtn) openOptionsBtn.addEventListener("click", openOptions);
  if (bannerOpenOptionsBtn) bannerOpenOptionsBtn.addEventListener("click", openOptions);
  if (linkOpenOptionsBtn) linkOpenOptionsBtn.addEventListener("click", openOptions);
  if (footerOptionsLink) footerOptionsLink.addEventListener("click", openOptions);

  function formatModelName(modelId) {
    if (!modelId) return "Gemma 4 26B";
    if (modelId.includes("gemma-4-26b")) return "Gemma 4 26B";
    if (modelId.includes("gemma-4-31b")) return "Gemma 4 31B";
    if (modelId.includes("nemotron-3.5")) return "Nemotron 3.5";
    if (modelId.includes("nemotron-3-super")) return "Nemotron 120B";
    if (modelId.includes("inkling")) return "Inkling";
    if (modelId.includes("gemini-2.5-flash")) return "Gemini 2.5 Flash";
    if (modelId.includes("gemini-2.5-pro")) return "Gemini 2.5 Pro";
    if (modelId.includes("claude-3.5-sonnet")) return "Claude 3.5";
    if (modelId.includes("claude-3-opus")) return "Claude Opus";
    if (modelId.includes("gpt-4o-mini")) return "GPT-4o Mini";
    if (modelId.includes("gpt-4o")) return "GPT-4o";
    if (modelId.includes("deepseek-r1")) return "DeepSeek R1";
    if (modelId.includes("deepseek-chat")) return "DeepSeek V3";
    if (modelId.includes("/")) return modelId.split("/")[1].slice(0, 18);
    return modelId.slice(0, 18);
  }

  function syncQuickModelSelect(modelId) {
    if (!quickModelSelect || !modelId) return;
    let found = false;
    for (const opt of quickModelSelect.options) {
      if (opt.value === modelId) {
        found = true;
        break;
      }
    }
    if (found) {
      quickModelSelect.value = modelId;
    } else {
      // If custom model not in the quick preset list
      let customOpt = quickModelSelect.querySelector('option[data-custom="true"]');
      if (!customOpt) {
        customOpt = document.createElement("option");
        customOpt.setAttribute("data-custom", "true");
        quickModelSelect.insertBefore(customOpt, quickModelSelect.lastElementChild);
      }
      customOpt.value = modelId;
      customOpt.textContent = `⚙️ ${modelId.split("/")[1] || modelId}`;
      quickModelSelect.value = modelId;
    }
    updateQuickModelBadge(modelId);
  }

  if (quickModelSelect) {
    quickModelSelect.addEventListener("change", async () => {
      const chosen = quickModelSelect.value;
      if (chosen === "__open_options__") {
        openOptions();
        try {
          const res = await chrome.storage.sync.get("cd_settings");
          syncQuickModelSelect(res?.cd_settings?.model);
        } catch (_) {}
        return;
      }

      updateQuickModelBadge(chosen);

      // Save immediately to storage and runtime
      try {
        const res = await chrome.storage.sync.get("cd_settings");
        const existing = res?.cd_settings || {};
        existing.model = chosen;
        await chrome.storage.sync.set({ cd_settings: existing });
        chrome.runtime.sendMessage({
          type: "SAVE_SETTINGS",
          settings: { model: chosen },
        });
        showFeedback("Đã chuyển model: " + formatModelName(chosen), "success");
      } catch (err) {
        safeReportError(err, "Popup:quickModelSelect");
      }
    });
  }

  // Load active model & API key status
  try {
    chrome.storage.sync.get("cd_settings", (data) => {
      const s = data?.cd_settings || {};
      if (s.model) syncQuickModelSelect(s.model);
      updateApiKeyBanner(s.apiKey);
      if (toggleEnabled) {
        toggleEnabled.checked = s.enabled !== false;
      }
    });
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
      const s = res?.settings || {};
      if (s.model) syncQuickModelSelect(s.model);
      updateApiKeyBanner(s.apiKey);
      if (toggleEnabled) {
        toggleEnabled.checked = s.enabled !== false;
      }
    });
    chrome.runtime.sendMessage({ type: "GET_MODEL_HEALTH" }, (res) => {
      if (res && res.success && res.stats) {
        popupCachedStats = res.stats;
        const currentModel = quickModelSelect ? quickModelSelect.value : null;
        if (currentModel) {
          updateQuickModelBadge(currentModel);
        }
      }
    });
  } catch (e) {}

  // Toggle API Key visibility
  if (toggleKeyVisibility && apiKeyInput) {
    toggleKeyVisibility.addEventListener("click", () => {
      try {
        if (apiKeyInput.type === "password") {
          apiKeyInput.type = "text";
          toggleKeyVisibility.innerHTML = ICONS.eyeOff;
          toggleKeyVisibility.title = "Ẩn key";
          toggleKeyVisibility.setAttribute("aria-label", "Ẩn API Key");
        } else {
          apiKeyInput.type = "password";
          toggleKeyVisibility.innerHTML = ICONS.eye;
          toggleKeyVisibility.title = "Hiện/ẩn key";
          toggleKeyVisibility.setAttribute("aria-label", "Hiện hoặc ẩn API Key");
        }
      } catch (err) {
        safeReportError(err, "Popup:toggleKeyVisibility");
      }
    });
  }

  // Hover delay slider
  if (hoverDelay && hoverDelayValue) {
    hoverDelay.addEventListener("input", () => {
      try {
        hoverDelayValue.textContent = `${hoverDelay.value} ms`;
        hoverDelay.setAttribute("aria-valuenow", hoverDelay.value);
      } catch (err) {
        safeReportError(err, "Popup:hoverDelayInput");
      }
    });
  }

  // Load Settings from background
  try {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      if (response && response.success && response.settings) {
        const s = response.settings;
        if (apiKeyInput) apiKeyInput.value = s.apiKey || "";
        if (modelSelect) modelSelect.value = s.model || "";
        if (errorReportEmail) errorReportEmail.value = s.errorReportEmail || "";
        if (toggleEnabled) toggleEnabled.checked = s.enabled !== false;
        if (showHoverHint) showHoverHint.checked = s.showHoverHint !== false;
        if (highlightSaved) highlightSaved.checked = s.highlightSaved !== false;
        if (hoverDelay && hoverDelayValue) {
          hoverDelay.value = s.hoverDelay || 1000;
          hoverDelayValue.textContent = `${hoverDelay.value} ms`;
          hoverDelay.setAttribute("aria-valuenow", hoverDelay.value);
        }
        updateApiKeyBanner(s.apiKey);
      }
    });
  } catch (loadErr) {
    safeReportError(loadErr, "Popup:loadSettings");
  }

  // Save Settings
  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const newSettings = {
          apiKey: apiKeyInput ? apiKeyInput.value.trim() : "",
          errorReportEmail: errorReportEmail ? errorReportEmail.value.trim() : "",
          hoverDelay: hoverDelay ? parseInt(hoverDelay.value, 10) : 1000,
          enabled: toggleEnabled ? toggleEnabled.checked : true,
          showHoverHint: showHoverHint ? showHoverHint.checked : true,
          highlightSaved: highlightSaved ? highlightSaved.checked : true,
        };

        if (modelSelect && modelSelect.value) {
          newSettings.model = modelSelect.value;
        }

        chrome.runtime.sendMessage(
          {
            type: "SAVE_SETTINGS",
            settings: newSettings,
          },
          (res) => {
            if (res && res.success) {
              showFeedback("Đã lưu cài đặt thành công!", "success");
              updateApiKeyBanner(newSettings.apiKey);
            } else {
              showFeedback("Lưu cấu hình thất bại.", "error");
            }
          },
        );
      } catch (err) {
        showFeedback("Lỗi khi lưu cài đặt.", "error");
        safeReportError(err, "Popup:saveSettings");
      }
    });
  }

  // Quick toggle extension enabled state
  if (toggleEnabled) {
    const handleToggle = () => {
      try {
        chrome.runtime.sendMessage({
          type: "SAVE_SETTINGS",
          settings: { enabled: toggleEnabled.checked },
        });
      } catch (err) {
        safeReportError(err, "Popup:toggleEnabled");
      }
    };
    toggleEnabled.addEventListener("change", handleToggle);
    toggleEnabled.addEventListener("natChange", (e) => {
      if (e.detail !== undefined) toggleEnabled.checked = e.detail;
      handleToggle();
    });
  }

  // Clear cache button
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ type: "CLEAR_CACHE" }, (res) => {
          if (res && res.success) {
            showFeedback("Đã xoá toàn bộ bộ nhớ đệm bản dịch!", "success");
          }
        });
      } catch (err) {
        safeReportError(err, "Popup:clearCache");
      }
    });
  }

  // Copy Debug Log button
  if (copyDebugLogBtn) {
    copyDebugLogBtn.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage(
          { type: "GET_DEBUG_REPORT" },
          async (res) => {
            if (res && res.success && res.report) {
              const formatted = JSON.stringify(res.report, null, 2);
              try {
                await navigator.clipboard.writeText(formatted);
                showFeedback("Đã sao chép Debug Log vào Clipboard!", "success");
              } catch (err) {
                // Fallback copy using textarea
                const textarea = document.createElement("textarea");
                textarea.value = formatted;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
                showFeedback("Đã sao chép Debug Log vào Clipboard!", "success");
              }
            } else {
              showFeedback("Không thể lấy Debug Log.", "error");
            }
          },
        );
      } catch (err) {
        safeReportError(err, "Popup:copyDebugLog");
      }
    });
  }

  // Submit Errors To Email button
  if (submitErrorsBtn) {
    submitErrorsBtn.addEventListener("click", () => {
      try {
        const email = errorReportEmail ? errorReportEmail.value.trim() : "";
        submitErrorsBtn.disabled = true;
        showFeedback("Đang kiểm tra và chuẩn bị báo cáo lỗi...", "info");

        chrome.runtime.sendMessage(
          {
            type: "SUBMIT_ERRORS_TO_EMAIL",
            email,
          },
          (res) => {
            submitErrorsBtn.disabled = false;
            if (!res) {
              showFeedback("Không nhận được phản hồi từ tiện ích.", "error");
              return;
            }

            if (res.success) {
              if (res.count === 0) {
                showFeedback("Không có lỗi nào đang chờ gửi!", "success");
              } else if (res.sentDirectly) {
                showFeedback(
                  `Đã gửi thành công ${res.count} lỗi về email!`,
                  "success",
                );
              } else {
                showFeedback(
                  `Đã chuẩn bị báo cáo cho ${res.count} lỗi!`,
                  "success",
                );
                if (res.mailtoUrl) {
                  try {
                    window.open(res.mailtoUrl, "_blank");
                  } catch (openErr) {
                    navigator.clipboard?.writeText?.(res.summaryMarkdown || "");
                  }
                }
              }
            } else {
              showFeedback(
                res.error || "Lỗi khi chuẩn bị gửi báo cáo.",
                "error",
              );
            }
          },
        );
      } catch (err) {
        submitErrorsBtn.disabled = false;
        showFeedback("Lỗi: " + err.message, "error");
        safeReportError(err, "Popup:submitErrorsBtn");
      }
    });
  }
}
