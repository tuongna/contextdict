// popup/popup.js
// Main entry point for ContextDict simplified popup (Vocabulary Notebook & Quick Controls)

import { safeReportError } from "./modules/utils.js";
import { initSettingsTab } from "./modules/settings-tab.js";
import { initVocabTab } from "./modules/vocab-tab.js";
import "nat-ui/dist/components/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Global error listeners for popup window
  window.addEventListener("error", (event) => {
    try {
      safeReportError(event.error || event.message, "Popup:Global", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    } catch (e) {}
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      safeReportError(event.reason, "Popup:UnhandledRejection");
    } catch (e) {}
  });

  // Initialize quick controls (options buttons, toggle enable, missing API key banner)
  initSettingsTab();

  // Initialize and render vocabulary notebook directly
  initVocabTab();
});
