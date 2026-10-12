// popup/modules/feedback.js
// Feedback/Toast message utility for Popup UI

let feedbackTimer = null;

/**
 * Show temporary feedback banner in popup
 * @param {string} text
 * @param {'success'|'error'|'info'} type
 */
export function showFeedback(text, type = "success") {
  try {
    const settingsFeedback = document.getElementById("settingsFeedback");
    if (!settingsFeedback) return;

    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }

    settingsFeedback.textContent = text;
    settingsFeedback.className = `feedback-msg ${type}`;

    feedbackTimer = setTimeout(() => {
      settingsFeedback.textContent = "";
      settingsFeedback.className = "feedback-msg";
      feedbackTimer = null;
    }, 3000);
  } catch (e) {}
}
