// options/options.js
// Logic for the dedicated ContextDict Options Page
import "nat-ui/dist/components/index.js";

document.addEventListener("DOMContentLoaded", () => {
  const optionsForm = document.getElementById("optionsForm");
  const apiKeyInput = document.getElementById("apiKey");
  const toggleKeyVisibility = document.getElementById("toggleKeyVisibility");
  const testApiKeyBtn = document.getElementById("testApiKeyBtn");
  const testResultFeedback = document.getElementById("testResultFeedback");
  const modelSelect = document.getElementById("modelSelect");
  const hoverDelay = document.getElementById("hoverDelay");
  const hoverDelayValue = document.getElementById("hoverDelayValue");
  const ttsSpeed = document.getElementById("ttsSpeed");
  const ttsSpeedValue = document.getElementById("ttsSpeedValue");
  const showHoverHint = document.getElementById("showHoverHint");
  const highlightSaved = document.getElementById("highlightSaved");
  const showRomaja = document.getElementById("showRomaja");
  const errorReportEmail = document.getElementById("errorReportEmail");
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  const copyDebugLogBtn = document.getElementById("copyDebugLogBtn");
  const submitErrorsBtn = document.getElementById("submitErrorsBtn");
  const refreshHealthBtn = document.getElementById("refreshHealthBtn");
  const resetStatsBtn = document.getElementById("resetStatsBtn");
  const modelHealthList = document.getElementById("modelHealthList");
  const healthSortBtns = document.querySelectorAll(".health-sort-btn");
  const saveFeedback = document.getElementById("saveFeedback");
  const globalStatusPill = document.getElementById("globalStatusPill");
  const globalStatusText = document.getElementById("globalStatusText");

  let feedbackTimer = null;

  function showSaveFeedback(message, type = "success") {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    saveFeedback.textContent = message;
    saveFeedback.className = `save-feedback ${type}`;
    feedbackTimer = setTimeout(() => {
      saveFeedback.textContent = "";
      saveFeedback.className = "save-feedback";
      feedbackTimer = null;
    }, 4000);
  }

  function updateGlobalStatus(hasKey) {
    if (!globalStatusPill || !globalStatusText) return;
    if (hasKey) {
      globalStatusPill.className = "status-pill configured";
      if (globalStatusPill.setAttribute) globalStatusPill.setAttribute("color", "primary");
      globalStatusText.textContent = "Đã cấu hình API Key";
    } else {
      globalStatusPill.className = "status-pill unconfigured";
      if (globalStatusPill.setAttribute) globalStatusPill.setAttribute("color", "error");
      globalStatusText.textContent = "Chưa cấu hình API Key";
    }
  }

  const saveOptionsBtn = document.getElementById("saveOptionsBtn");
  if (saveOptionsBtn && optionsForm) {
    saveOptionsBtn.addEventListener("click", () => {
      if (typeof optionsForm.requestSubmit === "function") {
        optionsForm.requestSubmit();
      } else {
        optionsForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    });
  }

  // Toggle API Key visibility
  if (toggleKeyVisibility && apiKeyInput) {
    toggleKeyVisibility.addEventListener("click", () => {
      if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        toggleKeyVisibility.title = "Ẩn key";
        toggleKeyVisibility.setAttribute("aria-label", "Ẩn API Key");
      } else {
        apiKeyInput.type = "password";
        toggleKeyVisibility.title = "Hiện key";
        toggleKeyVisibility.setAttribute("aria-label", "Hiện API Key");
      }
    });
  }

  // Sliders input handlers
  if (hoverDelay && hoverDelayValue) {
    hoverDelay.addEventListener("input", () => {
      hoverDelayValue.textContent = `${hoverDelay.value} ms`;
      hoverDelay.setAttribute("aria-valuenow", hoverDelay.value);
    });
  }

  if (ttsSpeed && ttsSpeedValue) {
    ttsSpeed.addEventListener("input", () => {
      ttsSpeedValue.textContent = `${parseFloat(ttsSpeed.value).toFixed(1)}x`;
      ttsSpeed.setAttribute("aria-valuenow", ttsSpeed.value);
    });
  }

  const customModelGroup = document.getElementById("customModelGroup");
  const customModelInput = document.getElementById("customModelInput");

  let currentModelId = "google/gemma-4-26b-a4b-it:free";
  let currentSortMode = "default";
  let cachedHealthMap = {};
  let cachedStatsMap = {};
  let cachedModelsList = [];

  function setModelInUI(modelId, triggerSave = false) {
    if (!modelId) return;
    currentModelId = modelId;

    // Check if modelId exists in modelSelect options
    let existsInSelect = false;
    if (modelSelect) {
      for (const opt of modelSelect.options) {
        if (opt.value === modelId) {
          existsInSelect = true;
          break;
        }
      }

      if (existsInSelect) {
        modelSelect.value = modelId;
        if (customModelGroup) customModelGroup.classList.add("hidden");
      } else {
        modelSelect.value = "__custom__";
        if (customModelGroup) {
          customModelGroup.classList.remove("hidden");
          if (customModelInput) customModelInput.value = modelId;
        }
      }
    }

    // Re-render health list to update selected highlight
    renderHealth();

    if (triggerSave) {
      saveSpecificSetting({ model: modelId }, `Đã chọn mô hình: ${getModelDisplayName(modelId)}`);
    }
  }

  function getModelDisplayName(id) {
    const found = cachedModelsList.find(m => m.id === id);
    if (found) return `${found.provider} ${found.name}`;
    if (id.includes("/")) return id.split("/")[1];
    return id;
  }

  async function saveSpecificSetting(partialSettings, feedbackMessage) {
    try {
      if (chrome?.storage?.sync) {
        const data = await chrome.storage.sync.get("cd_settings");
        const existing = data?.cd_settings || {};
        const updated = Object.assign({}, existing, partialSettings);
        await chrome.storage.sync.set({ cd_settings: updated });
        if (typeof chrome.runtime?.sendMessage === "function") {
          chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: updated }, () => {
            if (chrome.runtime.lastError) {
              // Silently ignore inactive SW
            }
          });
        }
        showSaveFeedback(feedbackMessage || "Đã lưu thay đổi!", "success");
        updateGlobalStatus(Boolean(updated.apiKey));
        return;
      }

      // Fallback messaging
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
        const existing = res?.settings || {};
        const updated = Object.assign({}, existing, partialSettings);
        chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: updated }, (saveRes) => {
          if (saveRes && saveRes.success) {
            showSaveFeedback(feedbackMessage || "Đã lưu thay đổi!", "success");
            updateGlobalStatus(Boolean(updated.apiKey));
          }
        });
      });
    } catch (e) {
      console.warn("Failed to auto-save:", e);
    }
  }

  // Handle Model Select changes
  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      const val = modelSelect.value;
      if (val === "__custom__") {
        if (customModelGroup) {
          customModelGroup.classList.remove("hidden");
          if (customModelInput) {
            customModelInput.focus();
            if (customModelInput.value.trim()) {
              setModelInUI(customModelInput.value.trim(), true);
            }
          }
        }
      } else {
        if (customModelGroup) customModelGroup.classList.add("hidden");
        setModelInUI(val, true);
      }
    });
  }

  // Handle Custom Model Input
  if (customModelInput) {
    customModelInput.addEventListener("change", () => {
      const customVal = customModelInput.value.trim();
      if (customVal) {
        currentModelId = customVal;
        saveSpecificSetting({ model: customVal }, `Đã chọn mô hình tuỳ chỉnh: ${customVal}`);
      }
    });
    customModelInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        customModelInput.blur();
      }
    });
  }

  // Load Settings
  function loadSettings() {
    try {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success || !res.settings) return;
        const s = res.settings;
        if (apiKeyInput) apiKeyInput.value = s.apiKey || "";
        if (s.model) {
          setModelInUI(s.model, false);
        }
        if (errorReportEmail) errorReportEmail.value = s.errorReportEmail || "";
        if (showHoverHint) showHoverHint.checked = s.showHoverHint !== false;
        if (highlightSaved) highlightSaved.checked = s.highlightSaved !== false;
        if (showRomaja) showRomaja.checked = s.showRomaja !== false;
        if (hoverDelay && hoverDelayValue) {
          hoverDelay.value = s.hoverDelay || 1000;
          hoverDelayValue.textContent = `${hoverDelay.value} ms`;
          hoverDelay.setAttribute("aria-valuenow", hoverDelay.value);
        }
        if (ttsSpeed && ttsSpeedValue) {
          ttsSpeed.value = s.ttsSpeed || 1.0;
          ttsSpeedValue.textContent = `${parseFloat(ttsSpeed.value).toFixed(1)}x`;
          ttsSpeed.setAttribute("aria-valuenow", ttsSpeed.value);
        }

        updateGlobalStatus(Boolean(s.apiKey && s.apiKey.trim()));
      });
    } catch (e) {
      console.warn("[ContextDict Options] Error loading settings:", e);
    }
  }

  // Save Settings
  if (optionsForm) {
    optionsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        let finalModel = modelSelect ? modelSelect.value : "";
        if (finalModel === "__custom__" && customModelInput) {
          finalModel = customModelInput.value.trim() || currentModelId;
        }

        const newSettings = {
          apiKey: apiKeyInput ? apiKeyInput.value.trim() : "",
          model: finalModel,
          hoverDelay: hoverDelay ? parseInt(hoverDelay.value, 10) : 1000,
          ttsSpeed: ttsSpeed ? parseFloat(ttsSpeed.value) : 1.0,
          showHoverHint: showHoverHint ? showHoverHint.checked : true,
          highlightSaved: highlightSaved ? highlightSaved.checked : true,
          showRomaja: showRomaja ? showRomaja.checked : true,
          errorReportEmail: errorReportEmail ? errorReportEmail.value.trim() : "",
        };

        chrome.runtime.sendMessage(
          { type: "SAVE_SETTINGS", settings: newSettings },
          (res) => {
            if (res && res.success) {
              showSaveFeedback("Đã lưu cài đặt thành công!", "success");
              updateGlobalStatus(Boolean(newSettings.apiKey));
              currentModelId = newSettings.model;
              renderHealth(cachedHealthMap, cachedModelsList);
            } else {
              showSaveFeedback("Lưu cài đặt thất bại. Vui lòng thử lại.", "error");
            }
          },
        );
      } catch (err) {
        showSaveFeedback("Lỗi khi lưu cài đặt: " + err.message, "error");
      }
    });
  }

  // Test Connection Button
  if (testApiKeyBtn && apiKeyInput && testResultFeedback) {
    testApiKeyBtn.addEventListener("click", () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        testResultFeedback.className = "test-feedback error";
        testResultFeedback.textContent = "Vui lòng nhập API Key trước khi kiểm tra kết nối.";
        testResultFeedback.classList.remove("hidden");
        return;
      }

      testApiKeyBtn.disabled = true;
      testResultFeedback.className = "test-feedback loading";
      testResultFeedback.textContent = "Đang gửi tín hiệu kiểm tra đến OpenRouter…";
      testResultFeedback.classList.remove("hidden");

      chrome.runtime.sendMessage({ type: "TEST_API_KEY", apiKey: key }, (res) => {
        testApiKeyBtn.disabled = false;
        if (!res) {
          testResultFeedback.className = "test-feedback error";
          testResultFeedback.textContent = "Không thể liên lạc với tiện ích mở rộng.";
          return;
        }

        if (res.success) {
          testResultFeedback.className = "test-feedback success";
          testResultFeedback.textContent = `✅ Kết nối thành công! Độ trễ phản hồi: ${res.latencyMs || "<1000"} ms.`;
        } else {
          testResultFeedback.className = "test-feedback error";
          testResultFeedback.textContent = `❌ Kết nối thất bại: ${res.error || "Mã lỗi " + res.status}`;
        }
      });
    });
  }

  // Model Health & Stats Monitoring & Interactive Selection
  function renderHealth(healthMap, models, statsMap) {
    if (!modelHealthList) return;
    if (healthMap !== undefined) cachedHealthMap = healthMap || {};
    if (models !== undefined) cachedModelsList = models || [];
    if (statsMap !== undefined) cachedStatsMap = statsMap || {};

    const currentModels = [...cachedModelsList];
    if (currentModels.length === 0) {
      modelHealthList.innerHTML = '<div class="health-loading" role="listitem">Chưa có thông tin mô hình.</div>';
      return;
    }

    // Sort models based on currentSortMode
    if (currentSortMode === "score") {
      currentModels.sort((a, b) => {
        const sA = cachedStatsMap[a.id]?.score ?? -1;
        const sB = cachedStatsMap[b.id]?.score ?? -1;
        if (sB !== sA) return sB - sA;
        const tA = cachedStatsMap[a.id]?.total ?? 0;
        const tB = cachedStatsMap[b.id]?.total ?? 0;
        return tB - tA;
      });
    } else if (currentSortMode === "latency") {
      currentModels.sort((a, b) => {
        const latA = cachedStatsMap[a.id]?.avgLatencyMs || cachedHealthMap[a.id]?.latencyMs || 999999;
        const latB = cachedStatsMap[b.id]?.avgLatencyMs || cachedHealthMap[b.id]?.latencyMs || 999999;
        return latA - latB;
      });
    }

    modelHealthList.innerHTML = "";
    currentModels.forEach((m) => {
      const h = cachedHealthMap[m.id];
      const s = cachedStatsMap[m.id] || { total: 0, success: 0, failure: 0, pings: 0, translations: 0, avgLatencyMs: 0, score: 0, grade: "—", successRate: 0 };
      const isSelected = m.id === currentModelId;
      const row = document.createElement("div");
      row.className = `health-row ${isSelected ? "selected" : ""}`;
      row.setAttribute("role", "listitem");
      row.setAttribute("tabindex", "0");
      row.setAttribute("title", `Bấm để chọn mô hình: ${m.name}`);

      let dotClass = "unknown";
      let latencyText = "—";
      let latencyClass = "";

      if (h) {
        if (h.ok) {
          dotClass = "ok";
          latencyText = `${h.latencyMs} ms`;
          latencyClass = h.latencyMs < 1200 ? "fast" : h.latencyMs < 2500 ? "medium" : "slow";
        } else {
          dotClass = "fail";
          latencyText = h.status === 429 ? "Quá tải (429)" : "Lỗi";
          latencyClass = "slow";
        }
      } else if (s.avgLatencyMs > 0) {
        latencyText = `${s.avgLatencyMs} ms`;
        latencyClass = s.avgLatencyMs < 1200 ? "fast" : s.avgLatencyMs < 2500 ? "medium" : "slow";
      }

      const selectedBadge = isSelected
        ? `<span class="health-select-indicator">✓ Đang dùng</span>`
        : "";

      // Grade formatting
      const grade = s.grade || "—";
      const score = s.score != null ? s.score : 0;
      let gradeClass = "grade-none";
      if (grade === "A+") gradeClass = "grade-aplus";
      else if (grade === "A") gradeClass = "grade-a";
      else if (grade === "B") gradeClass = "grade-b";
      else if (grade === "C") gradeClass = "grade-c";
      else if (grade === "D") gradeClass = "grade-d";
      else if (grade === "F") gradeClass = "grade-f";

      const gradeBadge = s.total > 0
        ? `<span class="model-grade ${gradeClass}" title="Điểm: ${score}/100">${grade} <small>${score}đ</small></span>`
        : `<span class="model-grade grade-none" title="Chưa có lượt request nào">—</span>`;

      // Success Rate Bar & text
      const totalAttempts = s.total || 0;
      const successRate = s.successRate || 0;
      let successFillColor = "var(--text-subtle)";
      if (totalAttempts > 0) {
        if (successRate >= 85) successFillColor = "var(--success)";
        else if (successRate >= 70) successFillColor = "var(--accent-cyan)";
        else if (successRate >= 50) successFillColor = "var(--warning)";
        else successFillColor = "var(--danger)";
      }

      const successHtml = totalAttempts > 0
        ? `
          <div class="model-success-cell">
            <div class="success-rate-line">
              <span class="success-rate-pct" style="color: ${successFillColor};">${successRate}%</span>
              <span class="success-rate-counts">(${s.success}/${totalAttempts} lượt)</span>
            </div>
            <div class="success-bar-track">
              <div class="success-bar-fill" style="width: ${successRate}%; background: ${successFillColor};"></div>
            </div>
            <div class="success-breakdown">${s.pings || 0} ping • ${s.translations || 0} dịch</div>
          </div>
        `
        : `
          <div class="model-success-cell empty">
            <span class="success-empty-text">Chưa có lượt (0)</span>
          </div>
        `;

      const latencyCell = `
        <div class="model-latency-cell">
          <span class="health-latency ${latencyClass}">${latencyText}</span>
          ${s.avgLatencyMs > 0 && h?.latencyMs ? `<span class="latency-avg-sub">TB: ${s.avgLatencyMs}ms</span>` : ""}
        </div>
      `;

      row.setAttribute(
        "aria-label",
        `${isSelected ? "Đang dùng: " : "Chọn mô hình: "}${m.provider || ""} ${m.name}, Hạng ${grade}, Tỉ lệ thành công ${successRate}%, Độ trễ ${latencyText}`
      );

      row.innerHTML = `
        <div class="health-name-col">
          <span class="health-dot ${dotClass}" title="${dotClass === "ok" ? "Hoạt động tốt" : dotClass === "fail" ? "Gặp sự cố" : "Chưa kiểm tra"}"></span>
          <div class="health-name-wrapper">
            <span class="health-provider">${m.provider || ""}</span>
            <span class="health-model-title">${m.name}</span>
          </div>
          ${selectedBadge}
        </div>
        <div class="health-score-col">
          ${gradeBadge}
        </div>
        <div class="health-success-col">
          ${successHtml}
        </div>
        <div class="health-latency-col">
          ${latencyCell}
        </div>
      `;

      // Click to instantly select model
      row.addEventListener("click", () => {
        setModelInUI(m.id, true);
      });

      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setModelInUI(m.id, true);
        }
      });

      modelHealthList.appendChild(row);
    });
  }

  function loadHealth() {
    chrome.runtime.sendMessage({ type: "GET_MODEL_HEALTH" }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) return;
      renderHealth(res.health || {}, res.models || [], res.stats || {});
    });
  }

  // Sort buttons handler
  if (healthSortBtns && healthSortBtns.length) {
    healthSortBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        healthSortBtns.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-checked", "true");
        currentSortMode = btn.dataset.sort || "default";
        renderHealth();
      });
    });
  }

  // Reset Stats Button
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener("click", () => {
      if (!confirm("Bạn có chắc chắn muốn đặt lại tất cả thống kê và điểm số mô hình về 0?")) {
        return;
      }
      resetStatsBtn.disabled = true;
      chrome.runtime.sendMessage({ type: "RESET_MODEL_STATS" }, (res) => {
        resetStatsBtn.disabled = false;
        if (res && res.success) {
          showSaveFeedback("Đã đặt lại toàn bộ thống kê mô hình!", "success");
          cachedStatsMap = res.stats || {};
          renderHealth();
        } else {
          showSaveFeedback("Không thể đặt lại thống kê.", "error");
        }
      });
    });
  }

  if (refreshHealthBtn) {
    refreshHealthBtn.addEventListener("click", () => {
      refreshHealthBtn.disabled = true;
      refreshHealthBtn.innerHTML = `<span>Đang đo độ trễ…</span>`;
      chrome.runtime.sendMessage({ type: "PING_MODELS" }, () => {
        setTimeout(() => {
          loadHealth();
          refreshHealthBtn.disabled = false;
          refreshHealthBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
            <span>Đo độ trễ (Ping All)</span>
          `;
        }, 2000);
      });
    });
  }

  // Clear Cache Button
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CLEAR_CACHE" }, (res) => {
        if (res && res.success) {
          showSaveFeedback("Đã dọn sạch toàn bộ cache bản dịch!", "success");
        } else {
          showSaveFeedback("Không thể xóa cache.", "error");
        }
      });
    });
  }

  // Copy Debug Log Button
  if (copyDebugLogBtn) {
    copyDebugLogBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "GET_DEBUG_REPORT" }, async (res) => {
        if (res && res.success && res.report) {
          const text = JSON.stringify(res.report, null, 2);
          try {
            await navigator.clipboard.writeText(text);
            showSaveFeedback("Đã sao chép Debug Log vào Clipboard!", "success");
          } catch {
            showSaveFeedback("Không thể sao chép vào Clipboard.", "error");
          }
        } else {
          showSaveFeedback("Không thể lấy dữ liệu Debug Log.", "error");
        }
      });
    });
  }

  // Submit Errors Button
  if (submitErrorsBtn) {
    submitErrorsBtn.addEventListener("click", () => {
      const email = errorReportEmail ? errorReportEmail.value.trim() : "";
      submitErrorsBtn.disabled = true;
      chrome.runtime.sendMessage(
        { type: "SUBMIT_ERRORS_TO_EMAIL", email },
        (res) => {
          submitErrorsBtn.disabled = false;
          if (res && res.success) {
            if (res.count === 0) {
              showSaveFeedback("Hàng đợi lỗi hiện đang trống.", "success");
            } else if (res.sentDirectly) {
              showSaveFeedback(`Đã gửi thành công ${res.count} lỗi qua email!`, "success");
            } else if (res.mailtoUrl) {
              showSaveFeedback(`Đã chuẩn bị báo cáo cho ${res.count} lỗi!`, "success");
              window.open(res.mailtoUrl, "_blank");
            }
          } else {
            showSaveFeedback(res?.error || "Lỗi khi gửi báo cáo.", "error");
          }
        },
      );
    });
  }

  // Formspree Direct Feedback Form Handler
  const feedbackForm = document.getElementById("feedbackForm");
  const feedbackEmail = document.getElementById("feedbackEmail");
  const feedbackMessage = document.getElementById("feedbackMessage");
  const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
  const feedbackStatus = document.getElementById("feedbackStatus");

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = feedbackEmail ? feedbackEmail.value.trim() : "";
      const message = feedbackMessage ? feedbackMessage.value.trim() : "";

      if (!message) {
        if (feedbackStatus) {
          feedbackStatus.className = "feedback-status error";
          feedbackStatus.textContent = "Vui lòng nhập nội dung góp ý hoặc mô tả sự cố.";
        }
        return;
      }

      if (submitFeedbackBtn) submitFeedbackBtn.disabled = true;
      if (feedbackStatus) {
        feedbackStatus.className = "feedback-status loading";
        feedbackStatus.textContent = "Đang gửi phản hồi qua Formspree…";
      }

      try {
        const response = await fetch("https://formspree.io/f/mppwprbr", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email || "anonymous@contextdict.app",
            message: message,
            userAgent: navigator.userAgent,
            extensionVersion:
              chrome.runtime?.getManifest?.()?.version || "1.0.0",
            timestamp: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          if (feedbackStatus) {
            feedbackStatus.className = "feedback-status success";
            feedbackStatus.textContent =
              "✅ Đã gửi thành công! Cảm ơn bạn đã đóng góp ý kiến.";
          }
          if (feedbackMessage) feedbackMessage.value = "";
        } else {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Mã trạng thái ${response.status}`);
        }
      } catch (err) {
        try {
          feedbackForm.submit();
        } catch {
          if (feedbackStatus) {
            feedbackStatus.className = "feedback-status error";
            feedbackStatus.textContent = "❌ Lỗi khi gửi: " + err.message;
          }
        }
      } finally {
        if (submitFeedbackBtn) submitFeedbackBtn.disabled = false;
      }
    });
  }

  // Initial loads
  loadSettings();
  loadHealth();
});
