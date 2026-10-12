// content/highlight.js
// Highlighting of saved vocabulary words across the page

(function () {
  const HIGHLIGHT_CLASS = "contextdict-highlight";
  const EXCLUDED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "TEXTAREA",
    "INPUT",
    "NOSCRIPT",
    "SVG",
    "CANVAS",
    "IFRAME",
    "CODE",
    "PRE",
    "CONTEXTDICT-HOST",
  ]);

  let savedWordsSet = new Set();
  let isHighlightingEnabled = true;
  let observer = null;
  let isScanning = false;
  let debounceTimeout = null;

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function shouldExcludeNode(node) {
    let parent = node.parentElement;
    while (parent) {
      if (
        EXCLUDED_TAGS.has(parent.tagName) ||
        parent.isContentEditable ||
        parent.classList.contains(HIGHLIGHT_CLASS)
      ) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  /**
   * Clear all current highlights
   */
  function removeHighlights() {
    const highlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    for (const el of highlights) {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      }
    }
  }

  /**
   * Highlight text nodes matching saved words in batches
   */
  async function applyHighlights() {
    if (!isHighlightingEnabled || savedWordsSet.size === 0 || isScanning) {
      return;
    }

    isScanning = true;

    try {
      // Build regex for whole words
      const wordsArray = Array.from(savedWordsSet)
        .filter((w) => w && w.length >= 2)
        .sort((a, b) => b.length - a.length); // Match longer phrases first

      if (wordsArray.length === 0) {
        isScanning = false;
        return;
      }

      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])(${wordsArray.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
        "gui",
      );

      // Collect eligible text nodes with TreeWalker
      const walker = document.createTreeWalker(
        document.body || document.documentElement,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function (node) {
            if (!node.nodeValue || !node.nodeValue.trim())
              return NodeFilter.FILTER_REJECT;
            if (shouldExcludeNode(node)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );

      const matchingNodes = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        if (pattern.test(currentNode.nodeValue)) {
          matchingNodes.push(currentNode);
        }
        currentNode = walker.nextNode();
      }

      // Process in batches of 20 nodes to prevent main thread frame drops
      const BATCH_SIZE = 20;
      for (let i = 0; i < matchingNodes.length; i += BATCH_SIZE) {
        const batch = matchingNodes.slice(i, i + BATCH_SIZE);
        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            for (const textNode of batch) {
              if (!textNode.parentNode || shouldExcludeNode(textNode)) continue;

              const text = textNode.nodeValue;
              pattern.lastIndex = 0;
              let match;
              let lastIdx = 0;
              const fragment = document.createDocumentFragment();
              let hasMatch = false;

              while ((match = pattern.exec(text)) !== null) {
                hasMatch = true;
                const matchStart = match.index;
                const matchEnd = pattern.lastIndex;

                if (matchStart > lastIdx) {
                  fragment.appendChild(
                    document.createTextNode(
                      text.substring(lastIdx, matchStart),
                    ),
                  );
                }

                const mark = document.createElement("mark");
                mark.className = HIGHLIGHT_CLASS;
                mark.textContent = match[0];
                mark.setAttribute("data-word", match[0].toLowerCase());
                fragment.appendChild(mark);

                lastIdx = matchEnd;
              }

              if (hasMatch) {
                if (lastIdx < text.length) {
                  fragment.appendChild(
                    document.createTextNode(text.substring(lastIdx)),
                  );
                }
                textNode.parentNode.replaceChild(fragment, textNode);
              }
            }
            resolve();
          });
        });

        if (typeof scheduler !== "undefined" && scheduler.yield) {
          await scheduler.yield();
        }
      }
    } catch (err) {
      console.warn("[ContextDict Highlight] Error highlighting nodes:", err);
    } finally {
      isScanning = false;
    }
  }

  function scheduleHighlight() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      applyHighlights();
    }, 400);
  }

  function initObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      let hasSignificantAddedNodes = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (
              node.nodeType === 1 &&
              !node.classList?.contains(HIGHLIGHT_CLASS) &&
              node.tagName !== "CONTEXTDICT-HOST"
            ) {
              hasSignificantAddedNodes = true;
              break;
            }
          }
        }
        if (hasSignificantAddedNodes) break;
      }

      if (hasSignificantAddedNodes) {
        scheduleHighlight();
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.ContextDictHighlighter = {
    updateWords: function (vocabularyList, enabled = true) {
      isHighlightingEnabled = enabled;
      savedWordsSet = new Set(
        (vocabularyList || [])
          .map((v) => (v.word || "").trim().toLowerCase())
          .filter(Boolean),
      );
      removeHighlights();
      if (isHighlightingEnabled && savedWordsSet.size > 0) {
        scheduleHighlight();
        initObserver();
      }
    },
    refresh: function () {
      removeHighlights();
      if (isHighlightingEnabled && savedWordsSet.size > 0) {
        scheduleHighlight();
      }
    },
  };
})();
