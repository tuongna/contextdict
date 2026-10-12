// offscreen.js
// Dedicated offscreen audio player for ContextDict (immune to host page CSP restrictions)

let currentAudio = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OFFSCREEN_PLAY_AUDIO") {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }

      const audio = new Audio(msg.url);
      currentAudio = audio;

      if (msg.rate && typeof msg.rate === "number") {
        audio.playbackRate = msg.rate;
      }

      audio.onended = () => {
        currentAudio = null;
      };

      audio
        .play()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.warn("[ContextDict Offscreen] Audio playback error:", err);
          currentAudio = null;
          sendResponse({ success: false, error: err.message });
        });

      return true; // Keep message channel open for async response
    } catch (err) {
      console.warn("[ContextDict Offscreen] Sync error:", err);
      sendResponse({ success: false, error: err.message });
    }
  } else if (msg.type === "OFFSCREEN_STOP_AUDIO") {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    sendResponse({ success: true });
  }
});
