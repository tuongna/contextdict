// popup/modules/model-health-tab.js
// Model health check & interactive model selection for Popup UI

import { showFeedback } from "./feedback.js";
import { escapeHtml, safeReportError } from "./utils.js";

export function initModelHealthUI() {
  const pingModelsBtn = document.getElementById("pingModelsBtn");
  const modelHealthList = document.getElementById("modelHealthList");
  const modelSelect = document.getElementById("modelSelect");

  function renderHealthList(data) {
    if (!modelHealthList) return;
    const { models = [], health = {}, stats = {}, currentModel } = data;
    if (!models.length) return;

    const now = Date.now();
    const HEALTH_TTL = 15 * 60 * 1000;

    modelHealthList.innerHTML = models
      .map((model) => {
        const s = health[model.id];
        const st = stats[model.id];
        const isFresh = s && now - s.lastChecked <= HEALTH_TTL;

        let dotClass = "unknown";
        let latencyText = "Chưa kiểm tra";
        let latencyClass = "";

        if (isFresh) {
          dotClass = s.ok ? "ok" : "fail";
          if (s.ok && s.latencyMs != null) {
            const ms = s.latencyMs;
            latencyText = `${ms}ms`;
            latencyClass = ms < 1500 ? "fast" : ms < 4000 ? "medium" : "slow";
          } else if (!s.ok) {
            latencyText = s.error
              ? (s.error.length > 28 ? s.error.slice(0, 28) + "…" : s.error)
              : "Không kết nối";
            latencyClass = "slow";
          }
        }

        const tierBadge = model.tier === "primary" ? " ★" : "";
        const displayName = `${model.provider} ${model.name}${tierBadge}`;

        let scoreBadge = "";
        if (st && st.total > 0) {
          const g = st.grade || "—";
          const gradeCls = g === "A+" ? "grade-aplus" : `grade-${g.toLowerCase()}`;
          scoreBadge = `<span class="quick-model-score ${gradeCls}" style="margin-left:auto; margin-right: 6px;">${g} ${st.score}đ</span>`;
        }

        const isSelected = model.id === currentModel;
        const selectedClass = isSelected ? "selected" : "";
        const checkIcon = isSelected
          ? `<span class="health-selected-icon" style="${scoreBadge ? '' : 'margin-left:auto; '}font-size:12px;">✔️</span>`
          : "";

        return `
          <div class="health-model-row ${selectedClass}" style="cursor:pointer;" role="listitem" title="${escapeHtml(model.id)}" data-model-id="${escapeHtml(model.id)}">
            <div class="health-dot ${dotClass}" aria-label="${dotClass === "ok" ? "Online" : dotClass === "fail" ? "Offline" : "Chưa rõ"}"></div>
            <span class="health-model-name">${escapeHtml(displayName)}</span>
            ${scoreBadge}
            <span class="health-latency ${latencyClass}">${escapeHtml(latencyText)}</span>
            ${checkIcon}
          </div>`;
      })
      .join("");

    const rows = modelHealthList.querySelectorAll(".health-model-row");
    rows.forEach((row) => {
      row.addEventListener("click", () => {
        const modelId = row.dataset.modelId;
        if (!modelId) return;

        rows.forEach((r) => {
          r.classList.remove("selected");
          const icon = r.querySelector(".health-selected-icon");
          if (icon) icon.remove();
        });

        row.classList.add("selected");
        row.insertAdjacentHTML(
          "beforeend",
          `<span class="health-selected-icon" style="margin-left:auto; font-size:12px;">✔️</span>`,
        );

        if (modelSelect) {
          modelSelect.value = modelId;
        }

        chrome.runtime.sendMessage(
          {
            type: "SAVE_SETTINGS",
            settings: { model: modelId },
          },
          (res) => {
            if (res && res.success) {
              showFeedback("Đã chọn model: " + modelId, "success");
            }
          },
        );
      });
    });
  }

  /**
   * Load existing health data from SW and render it.
   */
  async function loadHealthStatus() {
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settingsRes) => {
        const currentModel = settingsRes?.settings?.model;
        if (modelSelect && currentModel) {
          modelSelect.value = currentModel;
        }
        chrome.runtime.sendMessage({ type: "GET_MODEL_HEALTH" }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res?.success) {
            renderHealthList({ models: res.models, health: res.health, stats: res.stats, currentModel });
          }
        });
      });
    } catch (e) {}
  }

  /**
   * Trigger a manual ping, poll for result after 15s.
   */
  if (pingModelsBtn) {
    pingModelsBtn.addEventListener("click", async () => {
      try {
        if (!chrome.runtime?.id) return;
        pingModelsBtn.classList.add("pinging");
        pingModelsBtn.disabled = true;

        // Show loading state immediately
        if (modelHealthList) {
          modelHealthList.innerHTML =
            '<div class="health-loading" role="listitem">⏳ Đang ping tất cả model…</div>';
        }

        chrome.runtime.sendMessage({ type: "PING_MODELS" }, () => {
          if (chrome.runtime.lastError) {
            pingModelsBtn.classList.remove("pinging");
            pingModelsBtn.disabled = false;
            return;
          }

          // Poll for results — health check takes ~5-15s depending on model count
          let attempts = 0;
          const poll = setInterval(() => {
            attempts++;
            chrome.runtime.sendMessage({ type: "GET_MODEL_HEALTH" }, (res) => {
              if (chrome.runtime.lastError) {
                clearInterval(poll);
                pingModelsBtn.classList.remove("pinging");
                pingModelsBtn.disabled = false;
                return;
              }
              if (res?.success && res.models?.length) {
                const hasResults = Object.values(res.health || {}).some(
                  (s) => Date.now() - s.lastChecked < 60_000,
                );
                if (hasResults || attempts >= 8) {
                  clearInterval(poll);
                  pingModelsBtn.classList.remove("pinging");
                  pingModelsBtn.disabled = false;
                  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settingsRes) => {
                    renderHealthList({
                      models: res.models,
                      health: res.health,
                      stats: res.stats,
                      currentModel: settingsRes?.settings?.model,
                    });
                  });
                }
              }
            });
          }, 2500);
        });
      } catch (err) {
        safeReportError(err, "Popup:PingModels");
        pingModelsBtn.classList.remove("pinging");
        pingModelsBtn.disabled = false;
      }
    });
  }

  // Auto-load health status when popup opens
  loadHealthStatus();
}
