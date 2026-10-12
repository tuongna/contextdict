// content/context-collector.js
// Sentence Boundary Detection via Intl.Segmenter + DOM TextNode flattening
//
// Architecture:
//   User selection
//     ↓ Find nearest semantic block container
//     ↓ Flatten TextNodes → LogicalTextBuffer (text + offset↔DOM mapping)
//     ↓ Detect language (html[lang] or heuristic)
//     ↓ Intl.Segmenter(lang, { granularity: "sentence" })
//     ↓ Boundary Repair (abbreviation dict, decimal numbers, URLs)
//     ↓ Find segment containing selection offset
//     ↓ Context expansion heuristics (if sentence too short / too long)
//     ↓ Return { sentence, sentenceBefore, sentenceAfter, language }

(function () {
  let cachedPageContext = null;
  let cachedPageUrl = "";

  // ---------------------------------------------------------------------------
  // 1. Language detection
  // ---------------------------------------------------------------------------

  /**
   * Returns the best-guess ISO language code for the current document.
   * Priority: html[lang] → meta[http-equiv=content-language] → navigator.language → "en"
   */
  function detectLanguage() {
    try {
      const htmlLang = document.documentElement.lang?.trim();
      if (htmlLang) return htmlLang.slice(0, 5); // e.g. "en-US"

      const metaLang = document
        .querySelector('meta[http-equiv="content-language"]')
        ?.getAttribute("content")
        ?.trim();
      if (metaLang) return metaLang.slice(0, 5);

      return navigator.language || "en";
    } catch {
      return "en";
    }
  }

  /**
   * Returns "ko" if text contains Korean Hangul characters,
   * otherwise falls back to document detectLanguage().
   */
  function detectTextLocale(text) {
    if (text && /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(text)) {
      return "ko";
    }
    return detectLanguage();
  }

  // ---------------------------------------------------------------------------
  // 2. Semantic block container finder
  // ---------------------------------------------------------------------------

  // Tags that form natural text boundaries (block-level semantic containers)
  const BLOCK_TAGS = new Set([
    "P", "LI", "TD", "TH", "BLOCKQUOTE", "ARTICLE", "SECTION",
    "MAIN", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
    "FIGCAPTION", "CAPTION", "DT", "DD", "PRE", "ASIDE",
  ]);

  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "MATH",
    "CONTEXTDICT-HOST",
  ]);

  /**
   * Walk up the DOM from `node` to find the nearest semantic block container.
   * Caps at 8 levels to avoid scanning the entire page.
   * Falls back to the node's own parentElement, then body.
   */
  function findSemanticBlock(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    let depth = 0;
    while (el && depth < 8) {
      if (BLOCK_TAGS.has(el.tagName)) return el;
      el = el.parentElement;
      depth++;
    }
    return node.parentElement || document.body;
  }

  // ---------------------------------------------------------------------------
  // 3. DOM TextNode flattening → LogicalTextBuffer
  // ---------------------------------------------------------------------------

  /**
   * Recursively collect visible TextNodes from a container element.
   * Returns [ { node, start, end } ] where start/end are offsets in the
   * joined logical string.
   */
  function flattenTextNodes(container) {
    const segments = [];
    let offset = 0;

    function walk(el) {
      if (!el) return;
      if (SKIP_TAGS.has(el.tagName)) return;

      // Skip hidden elements
      try {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;
      } catch {
        // getComputedStyle can throw in detached trees
      }

      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const raw = child.nodeValue || "";
          if (!raw.trim()) {
            // Whitespace-only node: emit a single space to preserve word boundaries
            if (offset > 0 && segments.length > 0) {
              const last = segments[segments.length - 1];
              // Avoid double-spacing
              if (last && last.end === offset) {
                // Append to logical string implicitly via the joined approach
              }
            }
            offset += 1; // account for a joining space
            continue;
          }
          // Normalize internal whitespace but preserve single spaces
          const normalized = raw.replace(/\s+/g, " ");
          segments.push({ node: child, start: offset, end: offset + normalized.length });
          offset += normalized.length;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          // Insert a space before/after inline elements to avoid word-merging
          const childTag = child.tagName;
          const isInline = !BLOCK_TAGS.has(childTag) && !SKIP_TAGS.has(childTag);
          if (!isInline && offset > 0) {
            offset += 1; // block-level separator
          }
          walk(child);
          if (!isInline) {
            offset += 1;
          }
        }
      }
    }

    walk(container);
    return segments;
  }

  /**
   * Build the logical text string from segments.
   * We reconstruct it by placing each segment's text at its `start` offset.
   */
  function buildLogicalText(segments) {
    if (!segments.length) return "";
    const total = segments[segments.length - 1].end;
    const chars = new Array(total).fill(" ");
    for (const seg of segments) {
      const text = (seg.node.nodeValue || "").replace(/\s+/g, " ");
      for (let i = 0; i < text.length && seg.start + i < total; i++) {
        chars[seg.start + i] = text[i];
      }
    }
    return chars.join("");
  }

  /**
   * Given a TextNode and a character offset within that node,
   * compute the global offset in the logical text buffer.
   */
  function nodeOffsetToLogical(targetNode, targetOffset, segments) {
    for (const seg of segments) {
      if (seg.node === targetNode) {
        return seg.start + Math.min(targetOffset, seg.end - seg.start);
      }
    }
    return 0;
  }

  /**
   * Given a logical index in the logical string, return { node, offset }
   * in the actual DOM TextNode.
   */
  function logicalToDOM(logicalIndex, segments) {
    if (!segments || segments.length === 0) return null;
    if (logicalIndex <= 0) return { node: segments[0].node, offset: 0 };
    for (const seg of segments) {
      if (logicalIndex >= seg.start && logicalIndex < seg.end) {
        return { node: seg.node, offset: logicalIndex - seg.start };
      }
    }
    const lastSeg = segments[segments.length - 1];
    return { node: lastSeg.node, offset: lastSeg.end - lastSeg.start };
  }

  // ---------------------------------------------------------------------------
  // 4. Intl.Segmenter with Boundary Repair
  // ---------------------------------------------------------------------------

  // Abbreviation patterns that should NOT be treated as sentence endings
  const ABBREV_ENDINGS = new Set([
    "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "gov.", "gen.",
    "sgt.", "cpl.", "pvt.", "rep.", "sen.", "rev.", "pres.", "supt.",
    "dept.", "est.", "approx.", "approx", "corp.", "inc.", "ltd.", "co.",
    "vs.", "etc.", "e.g.", "i.e.", "cf.", "al.", "fig.", "no.", "vol.",
    "pp.", "ch.", "art.", "sec.", "para.", "ed.", "eds.", "trans.",
    "repr.", "rev.", "abr.", "abstr.", "adm.", "asst.", "assoc.", "atty.",
  ]);

  const SEGMENTER_CACHE = new Map();

  /**
   * Returns a cached Intl.Segmenter instance for the given locale.
   */
  function getSegmenter(lang) {
    if (!SEGMENTER_CACHE.has(lang)) {
      try {
        SEGMENTER_CACHE.set(
          lang,
          new Intl.Segmenter(lang, { granularity: "sentence" }),
        );
      } catch {
        // Fall back to "en" if locale is unsupported
        if (!SEGMENTER_CACHE.has("en")) {
          SEGMENTER_CACHE.set(
            "en",
            new Intl.Segmenter("en", { granularity: "sentence" }),
          );
        }
        return SEGMENTER_CACHE.get("en");
      }
    }
    return SEGMENTER_CACHE.get(lang);
  }

  /**
   * Segment text with Intl.Segmenter, then apply Boundary Repair:
   * merge segments where the boundary falls inside an abbreviation,
   * a decimal number, URL, email, or version string.
   *
   * Returns array of { segment, index } matching Intl.Segmenter output shape.
   */
  function segmentWithRepair(text, lang) {
    const segmenter = getSegmenter(lang);
    if (!segmenter) return [{ segment: text, index: 0 }];

    const raw = [...segmenter.segment(text)];
    if (raw.length <= 1) return raw;

    const repaired = [];
    let i = 0;

    while (i < raw.length) {
      const current = raw[i];

      // Check if this boundary should be merged with the next segment
      if (i + 1 < raw.length) {
        const prevText = current.segment.trimEnd();
        const lastToken = prevText.split(/\s+/).pop()?.toLowerCase() || "";

        const isAbbrev = ABBREV_ENDINGS.has(lastToken);

        // Decimal / version: ends with digit.digit e.g. "v3.14 is..."
        const isDecimalMid = /\d\.\d$/.test(prevText) || /\d\.$/.test(prevText);

        // Domain / URL: ends with common TLD or contains dot mid-token
        const isUrlLike = /https?:\/\//.test(prevText) ||
          /\b[a-z0-9-]+\.(com|org|net|io|dev|ai|edu|gov|uk|de|fr|jp)\b/.test(prevText);

        // Email address
        const isEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(prevText);

        // Single capital letter (initials) like "U.S." or "A.B."
        const isInitial = /\b[A-Z]\.$/.test(prevText);

        if (isAbbrev || isDecimalMid || isUrlLike || isEmail || isInitial) {
          // Merge current + next into a combined segment
          const next = raw[i + 1];
          raw.splice(i, 2, {
            segment: current.segment + next.segment,
            index: current.index,
          });
          continue; // re-check merged segment
        }
      }

      repaired.push(current);
      i++;
    }

    return repaired;
  }

  // ---------------------------------------------------------------------------
  // 5. Context expansion heuristics
  // ---------------------------------------------------------------------------

  /**
   * Given segments and the index of the matched segment, decide whether to
   * expand context by including adjacent sentences.
   *
   * Rules (Recall > Precision):
   *   - sentence < 25 chars → include adjacent sentence
   *   - sentence > 500 chars → clamp to ±200 chars around selection
   *   - sentence starts with pronoun → include previous sentence
   */
  const PRONOUNS = new Set([
    "he", "she", "it", "they", "we", "this", "that", "these", "those",
    "his", "her", "their", "its", "our", "which", "who", "whom",
  ]);

  function expandContext(segments, matchIdx, selectionStart) {
    let current = segments[matchIdx];
    let startIdx = matchIdx;
    let endIdx = matchIdx;
    let text = current.segment.trim();
    const firstWord = text.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "").toLowerCase();

    // Too short: pull in adjacent sentence (prefer next if available, else previous)
    if (text.length < 25) {
      if (segments[matchIdx + 1]) endIdx = matchIdx + 1;
      else if (segments[matchIdx - 1]) startIdx = matchIdx - 1;
    }

    // Starts with a pronoun → include previous sentence for anaphora resolution
    if (PRONOUNS.has(firstWord) && matchIdx > 0) {
      startIdx = Math.min(startIdx, matchIdx - 1);
    }
    
    let expandedText = "";
    for (let i = startIdx; i <= endIdx; i++) {
      expandedText += segments[i].segment;
    }

    let logicalStart = segments[startIdx].index;
    let logicalEnd = segments[endIdx].index + segments[endIdx].segment.length;

    // Too long: clamp around selection point
    if (expandedText.length > 500) {
      const selInSegment = selectionStart - logicalStart;
      const halfWindow = 200;
      const from = Math.max(0, selInSegment - halfWindow);
      const to = Math.min(expandedText.length, selInSegment + halfWindow);
      expandedText = (from > 0 ? "…" : "") + expandedText.slice(from, to) + (to < expandedText.length ? "…" : "");
      
      logicalStart += from;
      logicalEnd = logicalStart + (to - from);
    }

    return {
      text: expandedText.replace(/\s+/g, " ").trim(),
      logicalStart,
      logicalEnd
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Public API: getSentenceContext
  // ---------------------------------------------------------------------------

  /**
   * Main entry point. Given a TextNode and character offset (from hover-detector),
   * returns the sentence containing the hovered word, with context expansion.
   *
   * @param {Node} node  - The TextNode under cursor
   * @param {number} offset  - Character offset within that node
   * @returns {string}  The contextual sentence string
   */
  function extractSentenceContext(node, offset = 0) {
    try {
      if (!node) return "";

      // Fallback for non-TextNode input
      if (node.nodeType !== Node.TEXT_NODE) {
        const text = (node.textContent || "").replace(/\s+/g, " ").trim();
        return text.slice(0, 300);
      }

      // Step 1: Find semantic container
      const container = findSemanticBlock(node);

      // Step 2: Flatten TextNodes to LogicalTextBuffer
      const segments = flattenTextNodes(container);
      if (!segments.length) {
        // Graceful degradation: return raw text content
        return (node.nodeValue || "").replace(/\s+/g, " ").trim().slice(0, 300);
      }

      // Step 3: Build logical text + compute global offset
      const logicalText = buildLogicalText(segments);
      if (!logicalText.trim()) return "";

      const globalOffset = nodeOffsetToLogical(node, offset, segments);

      // Step 4: Detect language (block-level Korean check with document fallback)
      const lang = detectTextLocale(logicalText);

      // Step 5: Segment with Boundary Repair
      const sentenceSegments = segmentWithRepair(logicalText, lang);

      // Step 6: Find the segment containing the selection offset
      let matchIdx = 0;
      for (let i = 0; i < sentenceSegments.length; i++) {
        const seg = sentenceSegments[i];
        const segEnd = seg.index + seg.segment.length;
        if (seg.index <= globalOffset && globalOffset <= segEnd) {
          matchIdx = i;
          break;
        }
        // Past the offset — take last candidate
        if (seg.index > globalOffset) {
          matchIdx = Math.max(0, i - 1);
          break;
        }
        matchIdx = i; // last segment
      }

      // Step 7: Expand context
      const expanded = expandContext(sentenceSegments, matchIdx, globalOffset);
      let finalString = expanded.text.length > 10 ? expanded.text : logicalText.slice(0, 200).trim();

      let range = null;
      try {
        const startDOM = logicalToDOM(expanded.logicalStart, segments);
        const endDOM = logicalToDOM(expanded.logicalEnd, segments);
        if (startDOM && endDOM) {
          range = document.createRange();
          range.setStart(startDOM.node, startDOM.offset);
          range.setEnd(endDOM.node, endDOM.offset);
        }
      } catch (e) {
        console.warn("[ContextDict:Collector] Error building sentence range", e);
      }

      return { text: finalString, range };

    } catch (err) {
      console.error("[ContextDict:Collector] extractSentenceContext error:", err);
      // Graceful degradation to raw text node content
      try {
        return (node?.nodeValue || "").replace(/\s+/g, " ").trim().slice(0, 300);
      } catch {
        return "";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Page context extractor (unchanged)
  // ---------------------------------------------------------------------------

  function extractPageContext() {
    try {
      const currentUrl = window.location.href;
      if (cachedPageContext && cachedPageUrl === currentUrl) {
        return cachedPageContext;
      }

      let title = document.title || "";
      if (!title && window.top && window.top !== window) {
        try {
          title = window.top.document?.title || "";
        } catch {
          // Cross-origin SOP, safe to ignore
        }
      }

      let description = "";
      const metaDesc =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      if (metaDesc) {
        description = metaDesc.getAttribute("content") || "";
      }

      const headingElements = Array.from(
        document.querySelectorAll("h1, h2, h3"),
      ).slice(0, 6);
      const headings = headingElements
        .map((el) => (el.textContent || "").trim().replace(/\s+/g, " "))
        .filter((text) => text.length > 3 && text.length < 120);

      let summary = "";
      const paragraphs = Array.from(
        document.querySelectorAll("article p, main p, p"),
      );
      for (const p of paragraphs) {
        const text = (p.textContent || "").trim().replace(/\s+/g, " ");
        if (text.length > 50) {
          summary = text.slice(0, 250);
          break;
        }
      }

      cachedPageContext = { title, description, headings, summary, url: currentUrl };
      cachedPageUrl = currentUrl;
      return cachedPageContext;
    } catch (err) {
      console.error("[ContextDict:Collector] extractPageContext error:", err);
      return {
        title: document.title || "",
        description: "",
        headings: [],
        summary: "",
        url: window.location.href || "",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.ContextDictCollector = {
    getPageContext: extractPageContext,
    getSentenceContext: extractSentenceContext,
    // Exposed for testing / debugging
    _internal: {
      detectLanguage,
      detectTextLocale,
      findSemanticBlock,
      flattenTextNodes,
      buildLogicalText,
      segmentWithRepair,
      expandContext,
    },
  };
})();
