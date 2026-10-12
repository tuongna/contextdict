// content/tts.js
// Text-To-Speech helper for ContextDict
// Primary engine: Google Translate TTS (via offscreen audio player, immune to page CSP)
// Secondary engine: Direct HTML5 Audio
// Fallback engine: Web Speech API (speechSynthesis)

(function () {
  let activeAudio = null;

  function detectLanguage(text, fallback = "en") {
    if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(text)) return "ko";
    if (/[\u3040-\u30ff]/u.test(text)) return "ja";
    if (/[\u4e00-\u9fff]/u.test(text)) return "zh";
    return fallback;
  }

  window.ContextDictTTS = {
    speak: function (text, lang = "en") {
      try {
        const cleanText = (text || "").trim();
        if (!cleanText) return;

        const effectiveLang = detectLanguage(cleanText, lang);

        // 1. Send request to background offscreen player (immune to host page CSP)
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage(
            {
              type: "PLAY_TTS",
              text: cleanText,
              lang: effectiveLang,
            },
            (response) => {
              if (chrome.runtime.lastError || !response || !response.success) {
                // Background offscreen player failed, try direct HTML5 audio or Web Speech
                playWithDirectAudioOrWebSpeech(cleanText, effectiveLang);
              }
            },
          );
          return;
        }

        // 2. Direct fallback if chrome.runtime is unavailable
        playWithDirectAudioOrWebSpeech(cleanText, effectiveLang);
      } catch (err) {
        console.warn("[ContextDict TTS] speak error:", err);
        fallbackWebSpeech(text, lang);
      }
    },

    stop: function () {
      try {
        if (activeAudio) {
          activeAudio.pause();
          activeAudio.currentTime = 0;
          activeAudio = null;
        }
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: "STOP_TTS" }, () => {
            if (chrome.runtime.lastError) {}
          });
        }
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {}
    },
  };

  function playWithDirectAudioOrWebSpeech(cleanText, lang) {
    try {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }

      const ttsLang = lang.startsWith("en") ? "en" : lang;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(ttsLang)}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
      const audio = new Audio(url);
      activeAudio = audio;

      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
      };

      audio.play().catch((err) => {
        // CSP or network error, fallback to Web Speech
        if (activeAudio === audio) activeAudio = null;
        fallbackWebSpeech(cleanText, lang);
      });
    } catch (e) {
      fallbackWebSpeech(cleanText, lang);
    }
  }

  function fallbackWebSpeech(cleanText, lang) {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const effectiveLang = detectLanguage(cleanText, lang);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = effectiveLang === "ko" ? "ko-KR" : effectiveLang === "ja" ? "ja-JP" : effectiveLang === "zh" ? "zh-CN" : (effectiveLang.includes("-") ? effectiveLang : "en-US");
      utterance.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith(effectiveLang) &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Siri") ||
            v.name.includes("Samantha")),
      ) || voices.find((v) => v.lang.startsWith(effectiveLang));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("[ContextDict TTS] WebSpeech fallback failed:", e);
    }
  }
})();
