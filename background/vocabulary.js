// background/vocabulary.js
// Vocabulary storage management using chrome.storage.local

const VOCABULARY_KEY = "cd_vocabulary";

/**
 * Get all saved vocabulary items
 * @returns {Promise<Array>}
 */
export async function getVocabulary() {
  try {
    const result = await chrome.storage.local.get(VOCABULARY_KEY);
    const list = result[VOCABULARY_KEY] || [];
    // Ensure all items have a language tag for backward compatibility
    return list.map((item) => ({
      ...item,
      language:
        item.language ||
        (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(item.word)
          ? "ko"
          : "en"),
      originalForm: item.originalForm || "",
      phonetic: item.phonetic || "",
    }));
  } catch (err) {
    console.error("[ContextDict Vocab] Error getting vocabulary:", err);
    return [];
  }
}

/**
 * Save or update a vocabulary word
 */
export async function saveWord(wordItem) {
  try {
    const vocab = await getVocabulary();
    const cleanWord = (wordItem.word || "").trim();
    if (!cleanWord) return false;

    const detectedLang =
      wordItem.language ||
      (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(cleanWord)
        ? "ko"
        : "en");

    // Check if word already exists (case-insensitive)
    const existingIndex = vocab.findIndex(
      (item) => item.word.toLowerCase() === cleanWord.toLowerCase(),
    );

    const newEntry = {
      id:
        existingIndex >= 0
          ? vocab[existingIndex].id
          : `vocab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      word: cleanWord,
      language: detectedLang,
      originalForm: wordItem.originalForm || "",
      phonetic: wordItem.phonetic || "",
      translation: wordItem.translation || "",
      contextNote: wordItem.contextNote || "",
      sentence: wordItem.sentence || "",
      sourceUrl: wordItem.sourceUrl || "",
      pageTitle: wordItem.pageTitle || "",
      savedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      vocab[existingIndex] = newEntry;
    } else {
      vocab.unshift(newEntry); // Newest first
    }

    await chrome.storage.local.set({ [VOCABULARY_KEY]: vocab });
    return newEntry;
  } catch (err) {
    console.error("[ContextDict Vocab] Error saving word:", err);
    return null;
  }
}

/**
 * Remove word by ID or by exact word text
 */
export async function removeWord(identifier) {
  try {
    const vocab = await getVocabulary();
    const updated = vocab.filter((item) => {
      if (item.id === identifier) return false;
      if (item.word.toLowerCase() === String(identifier).trim().toLowerCase())
        return false;
      return true;
    });

    await chrome.storage.local.set({ [VOCABULARY_KEY]: updated });
    return true;
  } catch (err) {
    console.error("[ContextDict Vocab] Error removing word:", err);
    return false;
  }
}

/**
 * Check if a word is already in vocabulary
 */
export async function isWordSaved(word) {
  try {
    const vocab = await getVocabulary();
    const clean = (word || "").trim().toLowerCase();
    return vocab.some((item) => item.word.toLowerCase() === clean);
  } catch (err) {
    return false;
  }
}

/**
 * Clear all vocabulary items
 */
export async function clearVocabulary() {
  try {
    await chrome.storage.local.set({ [VOCABULARY_KEY]: [] });
    return true;
  } catch (err) {
    console.error("[ContextDict Vocab] Error clearing vocabulary:", err);
    return false;
  }
}
