// background/logger.js
// Comprehensive Structured Logger for ContextDict Dev & Debugging

const DEBUG_LOGS_KEY = "cd_debug_logs";
const MAX_LOG_ENTRIES = 150;
export const FORMSPREE_ENDPOINT = "https://formspree.io/f/mppwprbr";

/**
 * Format timestamp to HH:mm:ss.SSS
 */
function formatTime(timestamp = Date.now()) {
  const d = new Date(timestamp);
  const pad = (n, s = 2) => String(n).padStart(s, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/**
 * Color map for DevTools Console
 */
const CONSOLE_COLORS = {
  SW: "color: #38bdf8; font-weight: bold;",
  API: "color: #a855f7; font-weight: bold;",
  Cache: "color: #34d399; font-weight: bold;",
  Content: "color: #f59e0b; font-weight: bold;",
  Popup: "color: #ec4899; font-weight: bold;",
  Vocab: "color: #60a5fa; font-weight: bold;",
};

/**
 * Append a log entry to chrome.storage.local ring buffer
 */
async function appendLogEntry(entry) {
  try {
    const result = await chrome.storage.local.get(DEBUG_LOGS_KEY);
    let logs = result[DEBUG_LOGS_KEY] || [];
    logs.push(entry);

    // Keep only latest MAX_LOG_ENTRIES
    if (logs.length > MAX_LOG_ENTRIES) {
      logs = logs.slice(logs.length - MAX_LOG_ENTRIES);
    }

    await chrome.storage.local.set({ [DEBUG_LOGS_KEY]: logs });
  } catch (err) {
    // Storage write failed or quota exceeded, fallback silently
  }
}

/**
 * Core logging method
 */
function record(level, scope, message, details = null) {
  const timestamp = Date.now();
  const timeStr = formatTime(timestamp);

  // 1. Console Output with styling
  const color = CONSOLE_COLORS[scope] || "color: #94a3b8; font-weight: bold;";
  const prefix = `%c[ContextDict:${scope}]%c [${level}] ${message}`;

  if (level === "ERROR") {
    if (details !== null && details !== undefined) {
      console.error(prefix, color, "color: inherit;", details);
    } else {
      console.error(prefix, color, "color: inherit;");
    }
  } else if (level === "WARN") {
    if (details !== null && details !== undefined) {
      console.warn(prefix, color, "color: inherit;", details);
    } else {
      console.warn(prefix, color, "color: inherit;");
    }
  } else {
    if (details !== null && details !== undefined) {
      console.log(prefix, color, "color: inherit;", details);
    } else {
      console.log(prefix, color, "color: inherit;");
    }
  }

  // 2. Persist to storage buffer (sanitize details to ensure serializable)
  let safeDetails = null;
  if (details !== null && details !== undefined) {
    try {
      safeDetails = JSON.parse(JSON.stringify(details));
    } catch (e) {
      safeDetails = String(details);
    }
  }

  const logEntry = {
    timestamp,
    timeStr,
    level,
    scope,
    message,
    details: safeDetails,
  };

  appendLogEntry(logEntry);
}

export const logger = {
  debug: (scope, msg, details) => record("DEBUG", scope, msg, details),
  info: (scope, msg, details) => record("INFO", scope, msg, details),
  warn: (scope, msg, details) => record("WARN", scope, msg, details),
  error: (scope, msg, details) => record("ERROR", scope, msg, details),
};

const ERROR_QUEUE_KEY = "cd_error_queue";
const MAX_ERROR_QUEUE_ENTRIES = 100;

/**
 * Chuẩn hoá và ghi nhận lỗi vào Error Queue phục vụ gửi báo cáo
 */
export async function captureException(
  rawError,
  scope = "General",
  context = {},
) {
  try {
    const timestamp = Date.now();
    const timeStr = formatTime(timestamp);

    let message = "Unknown Error";
    let stack = "";
    let name = "Error";

    if (rawError instanceof Error) {
      message = rawError.message || String(rawError);
      stack = rawError.stack || "";
      name = rawError.name || "Error";
    } else if (typeof rawError === "string") {
      message = rawError;
    } else if (rawError && typeof rawError === "object") {
      message = rawError.message || rawError.error || JSON.stringify(rawError);
      stack = rawError.stack || "";
      name = rawError.name || "ObjectError";
    }

    // Ghi log vào console & debug logs
    record("ERROR", scope, message, { stack, context });

    // Kiểm tra trùng lặp gần đây (trong 5 giây) để tránh spam cùng 1 lỗi
    const errorId = `err_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await chrome.storage.local.get(ERROR_QUEUE_KEY);
    let queue = result[ERROR_QUEUE_KEY] || [];

    const isDuplicate = queue.some(
      (item) =>
        item.message === message &&
        item.scope === scope &&
        timestamp - item.timestamp < 5000,
    );

    if (isDuplicate) {
      return null;
    }

    let safeContext = null;
    try {
      safeContext = JSON.parse(JSON.stringify(context));
    } catch (e) {
      safeContext = { raw: String(context) };
    }

    const browserInfo = {
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
      platform:
        typeof navigator !== "undefined" ? navigator.platform : "Unknown",
      extensionVersion: chrome.runtime?.getManifest?.()?.version || "1.0.0",
    };

    const errorEntry = {
      id: errorId,
      timestamp,
      timeStr,
      isoDate: new Date(timestamp).toISOString(),
      scope,
      name,
      message,
      stack,
      context: safeContext,
      browser: browserInfo,
      submitted: false,
    };

    queue.push(errorEntry);
    if (queue.length > MAX_ERROR_QUEUE_ENTRIES) {
      queue = queue.slice(queue.length - MAX_ERROR_QUEUE_ENTRIES);
    }

    await chrome.storage.local.set({ [ERROR_QUEUE_KEY]: queue });
    return errorEntry;
  } catch (err) {
    console.error("[ContextDict:Logger] Failed to capture exception:", err);
    return null;
  }
}

/**
 * Lấy danh sách các lỗi đang chờ gửi báo cáo
 */
export async function getPendingErrors() {
  try {
    const result = await chrome.storage.local.get(ERROR_QUEUE_KEY);
    const queue = result[ERROR_QUEUE_KEY] || [];
    return queue.filter((item) => !item.submitted);
  } catch (err) {
    return [];
  }
}

/**
 * Đánh dấu các lỗi đã được gửi báo cáo
 */
export async function markErrorsAsSubmitted(errorIds = []) {
  try {
    const result = await chrome.storage.local.get(ERROR_QUEUE_KEY);
    let queue = result[ERROR_QUEUE_KEY] || [];
    const idSet = new Set(errorIds);
    queue = queue.map((item) => {
      if (idSet.has(item.id)) {
        return Object.assign({}, item, {
          submitted: true,
          submittedAt: new Date().toISOString(),
        });
      }
      return item;
    });
    await chrome.storage.local.set({ [ERROR_QUEUE_KEY]: queue });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Xoá toàn bộ hàng đợi lỗi
 */
export async function clearErrorQueue() {
  try {
    await chrome.storage.local.remove(ERROR_QUEUE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Chuẩn bị và kích hoạt gửi báo cáo lỗi về email người dùng
 *
 * @param {string} targetEmail - Địa chỉ email nhận báo cáo lỗi (User sẽ bổ sung sau)
 * @param {Object} options - Tuỳ chọn thêm (forceAll, customSender)
 * @returns {Promise<Object>} Kết quả xử lý
 *
 * =========================================================================
 * 📌 HƯỚNG DẪN DÀNH CHO USER: BỔ SUNG LOGIC GỬI EMAIL TẠI ĐÂY
 * -------------------------------------------------------------------------
 * Bạn có thể tích hợp một trong các phương thức gửi email sau:
 *
 * 1. Dùng EmailJS / Formspree / SendGrid / Resend API:
 *    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({
 *        service_id: 'YOUR_SERVICE_ID',
 *        template_id: 'YOUR_TEMPLATE_ID',
 *        user_id: 'YOUR_PUBLIC_KEY',
 *        template_params: {
 *          to_email: targetEmail,
 *          subject: payload.subject,
 *          message: payload.textSummary,
 *          error_data: JSON.stringify(payload.errors, null, 2)
 *        }
 *      })
 *    });
 *
 * 2. Dùng Webhook Serverless (Cloudflare Worker / Vercel / AWS Lambda):
 *    await fetch('https://your-domain.com/api/report-error', {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify(payload)
 *    });
 *
 * 3. Hoặc tạo mailto: URL để mở trình duyệt mail mặc định của OS (đã tích hợp sẵn dự phòng).
 * =========================================================================
 */
export async function submitErrorsToEmail(targetEmail = "", options = {}) {
  try {
    const result = await chrome.storage.local.get(ERROR_QUEUE_KEY);
    const queue = result[ERROR_QUEUE_KEY] || [];
    const pendingErrors = options.forceAll
      ? queue
      : queue.filter((e) => !e.submitted);

    if (pendingErrors.length === 0) {
      return {
        success: true,
        count: 0,
        message: "Không có lỗi nào đang chờ gửi.",
      };
    }

    const payload = {
      recipient: targetEmail || "chua_cau_hinh_email@domain.com",
      generatedAt: new Date().toISOString(),
      errorCount: pendingErrors.length,
      subject: `[ContextDict Error Report] ${pendingErrors.length} lỗi phát sinh (${new Date().toLocaleDateString("vi-VN")})`,
      textSummary: pendingErrors
        .map(
          (err, idx) => `
#${idx + 1} [${err.timeStr}] [${err.scope}] ${err.message}
URL: ${err.context?.url || "N/A"}
Stack: ${err.stack || "No stack trace"}
Context: ${JSON.stringify(err.context || {}, null, 2)}
--------------------------------------------------
`,
        )
        .join("\n"),
      errors: pendingErrors,
    };

    logger.info(
      "SW",
      `Prepared email error report for ${targetEmail || "(no email)"}`,
      {
        errorCount: pendingErrors.length,
      },
    );

    // Tạo link mailto dự phòng
    const mailtoSubject = encodeURIComponent(payload.subject);
    const mailtoBody = encodeURIComponent(
      `Báo cáo lỗi ContextDict:\n\n${payload.textSummary.slice(0, 1800)}`,
    );
    payload.mailtoUrl = `mailto:${targetEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

    let dispatchSuccess = false;
    let dispatchMethod = "staged";

    if (options.customSender && typeof options.customSender === "function") {
      await options.customSender(payload);
      dispatchSuccess = true;
      dispatchMethod = "custom_sender";
    } else {
      // Gửi trực tiếp đến Formspree API
      try {
        const fsRes = await fetch(FORMSPREE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email: targetEmail || "error-reporter@contextdict.app",
            subject: payload.subject,
            message: payload.textSummary,
            errorCount: payload.errorCount,
            errors: payload.errors,
          }),
        });

        if (fsRes.ok) {
          dispatchSuccess = true;
          dispatchMethod = "formspree";
        } else {
          dispatchSuccess = true;
          dispatchMethod = "mailto_fallback";
        }
      } catch (fsErr) {
        logger.warn("SW", "Formspree dispatch failed, fallback to mailto:", {
          error: fsErr.message,
        });
        dispatchSuccess = true;
        dispatchMethod = "mailto_fallback";
      }
    }

    if (dispatchSuccess) {
      await markErrorsAsSubmitted(pendingErrors.map((e) => e.id));
    }

    return {
      success: true,
      sentDirectly: dispatchMethod === "formspree",
      method: dispatchMethod,
      count: pendingErrors.length,
      mailtoUrl: payload.mailtoUrl,
      payload,
      message: `Đã xử lý báo cáo ${pendingErrors.length} lỗi thành công!`,
    };
  } catch (err) {
    logger.error("SW", `Error during submitErrorsToEmail: ${err.message}`, {
      stack: err.stack,
    });
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Generate a comprehensive Markdown/JSON diagnostic report
 */
export async function getDebugReport(currentSettings = null) {
  try {
    const result = await chrome.storage.local.get([
      DEBUG_LOGS_KEY,
      ERROR_QUEUE_KEY,
      "cd_cache_word_index_v1",
      "cd_cache_sentence_index_v1",
      "cd_cache_index_v2",
      "cd_vocabulary",
    ]);
    const logs = result[DEBUG_LOGS_KEY] || [];
    const errorQueue = result[ERROR_QUEUE_KEY] || [];
    const wordCache = result["cd_cache_word_index_v1"] || [];
    const sentenceCache = result["cd_cache_sentence_index_v1"] || [];
    const legacyCache = result["cd_cache_index_v2"] || [];
    const vocab = result["cd_vocabulary"] || [];

    // Mask API Key safely
    const safeSettings = currentSettings
      ? {
          model: currentSettings.model,
          hoverDelay: currentSettings.hoverDelay,
          enabled: currentSettings.enabled,
          highlightSaved: currentSettings.highlightSaved,
          apiKeyConfigured: Boolean(
            currentSettings.apiKey && currentSettings.apiKey.trim(),
          ),
          apiKeyPrefix: currentSettings.apiKey
            ? `${currentSettings.apiKey.slice(0, 10)}...`
            : "(none)",
        }
      : {};

    const pendingErrors = errorQueue.filter((e) => !e.submitted);

    const report = {
      generatedAt: new Date().toISOString(),
      extension: {
        name: "ContextDict",
        version: chrome.runtime.getManifest()?.version || "1.0.0",
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
      },
      settings: safeSettings,
      stats: {
        wordCacheCount: wordCache.length,
        sentenceCacheCount: sentenceCache.length,
        cacheEntriesCount: wordCache.length + sentenceCache.length + legacyCache.length,
        savedWordsCount: vocab.length,
        totalLogsCaptured: logs.length,
        totalErrorsCaptured: errorQueue.length,
        pendingErrorsCount: pendingErrors.length,
      },
      pendingErrors,
      recentLogs: logs.slice(-60), // Latest 60 log entries
    };

    return report;
  } catch (err) {
    return {
      error: `Failed to generate report: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Clear all captured debug logs
 */
export async function clearDebugLogs() {
  try {
    await chrome.storage.local.remove([DEBUG_LOGS_KEY, ERROR_QUEUE_KEY]);
    return true;
  } catch (err) {
    return false;
  }
}
