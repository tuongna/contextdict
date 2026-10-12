// popup/modules/utils.js
// Utility functions for ContextDict popup

/**
 * Safely report unexpected popup-side errors to background queue
 */
export function safeReportError(err, scope = "Popup", context = {}) {
  try {
    if (!chrome.runtime?.id) return;
    const errorPayload = {
      name: err?.name || "Error",
      message: err?.message || String(err),
      stack: err?.stack || "",
    };
    chrome.runtime.sendMessage(
      {
        type: "REPORT_ERROR",
        error: errorPayload,
        scope,
        context,
      },
      () => {
        if (chrome.runtime.lastError) {
          /* ignore context invalidated */
        }
      },
    );
  } catch (e) {}
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Extract clean hostname domain from URL
 */
export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}
