// content/tooltip-styles.js
// CSS Styles and SVG Icons for the ContextDict Shadow DOM Tooltip
// Premium Liquid Glass Design with Specular Rim Lighting

(function () {
  // Ensure nat-icon-button is defined in isolated content script world
  if (typeof customElements !== "undefined" && customElements && typeof customElements.get === "function" && !customElements.get("nat-icon-button")) {
    try {
      customElements.define(
        "nat-icon-button",
        class extends HTMLElement {
          constructor() {
            super();
            const shadow = this.attachShadow({ mode: "open" });
            shadow.innerHTML = `
              <style>
                :host { display: inline-block; vertical-align: middle; box-sizing: border-box; }
                button {
                  position: relative;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  width: 2rem;
                  height: 2rem;
                  padding: 0;
                  border-radius: var(--md-sys-shape-corner-full, 9999px);
                  border: none;
                  background: transparent;
                  color: var(--md-sys-color-on-surface-variant, #c2c7cf);
                  cursor: pointer;
                  overflow: hidden;
                  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
                }
                :host([size="small"]) button { width: 1.75rem; height: 1.75rem; }
                button:hover:not(:disabled) {
                  background-color: var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.08));
                  color: var(--md-sys-color-primary, #94ccff);
                }
                ::slotted(svg) { width: 1.125rem; height: 1.125rem; fill: currentColor; }
                :host([size="small"]) ::slotted(svg) { width: 0.875rem; height: 0.875rem; }
              </style>
              <button part="button" type="button"><slot></slot></button>
            `;
          }
        },
      );
    } catch (_) {}
  }
  const ICONS = {
    close:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    translate:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>',
    book: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    globe:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    ai: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path></svg>',
    key: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
    alert:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    refresh:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>',
    copy:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  };

  const STYLES = `
    :host {
      --cd-rem-ratio: 1;

      --md-sys-color-primary: #94ccff;
      --md-sys-color-on-primary: #003353;
      --md-sys-color-primary-container: #004b75;
      --md-sys-color-on-primary-container: #cde5ff;

      --md-sys-color-surface: #101418;
      --md-sys-color-on-surface: #e0e2e8;
      --md-sys-color-surface-variant: #42474e;
      --md-sys-color-on-surface-variant: #c2c7cf;

      --md-sys-color-surface-container-lowest: #0b0f12;
      --md-sys-color-surface-container-low: #181c20;
      --md-sys-color-surface-container: #1c2024;
      --md-sys-color-surface-container-high: #272a2f;
      --md-sys-color-surface-container-highest: #31353a;

      --md-sys-color-outline: #8c9199;
      --md-sys-color-outline-variant: #42474e;

      --md-sys-color-error: #ffb4ab;
      --md-sys-color-on-error: #690005;
      --md-sys-color-error-container: #93000a;
      --md-sys-color-on-error-container: #ffdad6;

      --md-sys-color-success: #88da8d;
      --md-sys-color-on-success: #00390f;
      --md-sys-color-success-container: #00531a;

      --md-sys-shape-corner-extra-small: 0.25rem;
      --md-sys-shape-corner-small: 0.5rem;
      --md-sys-shape-corner-medium: 0.75rem;
      --md-sys-shape-corner-large: 1rem;
      --md-sys-shape-corner-full: 9999px;

      --md-sys-state-hover-opacity: 0.08;
      --md-sys-state-focus-opacity: 0.12;
      --md-sys-state-pressed-opacity: 0.12;

      --md-sys-elevation-level1: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.3), 0 0.0625rem 0.1875rem 0.0625rem rgba(0, 0, 0, 0.15);
      --md-sys-elevation-level2: 0 0.125rem 0.375rem 0.125rem rgba(0, 0, 0, 0.4), 0 0.0625rem 0.125rem 0 rgba(0, 0, 0, 0.3);
      --md-sys-elevation-level3: 0 0.25rem 0.5rem 0.1875rem rgba(0, 0, 0, 0.5), 0 0.0625rem 0.1875rem 0 rgba(0, 0, 0, 0.3);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .cd-tooltip-wrapper {
      position: absolute;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 0.8125rem;
      line-height: 1.5;
      color: var(--md-sys-color-on-surface, #e0e2e8);
      display: none;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .cd-tooltip-wrapper.cd-visible {
      display: block;
      pointer-events: auto;
    }

    /* Material 3 Surface Card for Tooltip */
    .cd-card {
      zoom: var(--cd-rem-ratio, 1);
      width: 23.5rem;
      max-width: calc(100vw - 1rem);
      max-height: calc(100vh - 1rem);
      display: flex;
      flex-direction: column;
      position: relative;
      contain: layout style;
      background: var(--md-sys-color-surface-container-high, #272a2f);
      border: 0.0625rem solid var(--md-sys-color-outline-variant, #42474e);
      border-radius: var(--md-sys-shape-corner-medium, 0.75rem);
      box-shadow: var(--md-sys-elevation-level3);
      overflow: hidden;
      opacity: 0;
      transform: translateY(0.375rem);
      transition: 
        opacity 0.16s ease-out,
        transform 0.16s ease-out;
      will-change: transform, opacity;
    }

    .cd-tooltip-wrapper.cd-placement-top .cd-card {
      transform: translateY(-0.375rem);
    }

    .cd-tooltip-wrapper.cd-visible .cd-card {
      opacity: 1;
      transform: translateY(0);
      animation: cd-slide-in 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .cd-tooltip-wrapper.cd-placement-top.cd-visible .cd-card {
      animation: cd-slide-in-top 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes cd-slide-in {
      from {
        opacity: 0;
        transform: translateY(0.375rem);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes cd-slide-in-top {
      from {
        opacity: 0;
        transform: translateY(-0.375rem);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Smooth content entrance animation */
    .cd-content-fade {
      animation: cd-fade-in 0.14s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes cd-fade-in {
      from {
        opacity: 0;
        transform: translateY(0.125rem);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Hover Dotted Word Indicator */
    .cd-hover-indicator {
      position: absolute;
      pointer-events: none;
      z-index: 2147483646;
      opacity: 0;
      transition: opacity 0.15s ease-out;
      height: 0.25rem;
      display: none;
    }

    .cd-hover-indicator.cd-visible {
      display: block;
      opacity: 1;
    }

    .cd-hover-dots {
      position: absolute;
      top: 0.0625rem;
      left: 0;
      right: 0;
      height: 0.125rem;
      border-bottom: 0.125rem dotted rgba(148, 163, 184, 0.55);
    }

    .cd-hover-bar {
      position: absolute;
      top: 0.0625rem;
      left: 0;
      height: 0.125rem;
      width: 0%;
      background: linear-gradient(90deg, #6366f1 0%, #38bdf8 100%);
      box-shadow: 0 0 0.5rem rgba(56, 189, 248, 0.9), 0 0 0.15rem #38bdf8;
      border-radius: 0.125rem;
      will-change: width;
    }

    .cd-sentence-indicator {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }

    .cd-sentence-indicator-rect {
      position: absolute;
      pointer-events: none;
      z-index: 2147483645;
      border-bottom: 0.125rem dashed rgba(99, 102, 241, 0.5);
    }

    .cd-hover-indicator.cd-active .cd-hover-dots {
      border-bottom-color: rgba(99, 102, 241, 0.7);
    }

    .cd-hover-indicator.cd-active .cd-hover-bar {
      width: 100%;
      box-shadow: 0 0 0.6rem rgba(56, 189, 248, 1), 0 0 0.2rem #6366f1;
    }

    @media (prefers-reduced-motion: reduce) {
      .cd-hover-bar {
        width: 100% !important;
        animation: none !important;
      }
      .cd-skeleton,
      .cd-sk-box {
        animation: none !important;
      }
      .cd-tooltip-wrapper,
      .cd-card,
      .cd-content-fade {
        transition: none !important;
        transform: none !important;
        animation: none !important;
      }
    }

    /* Header with Specular Rim Light */
    .cd-header {
      padding: 0.875rem 1.0625rem 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 0.0625rem solid rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 0.0625rem 0 0 rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.625rem;
    }

    .cd-word-info {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
      min-width: 0;
      overflow: visible;
    }

    .cd-word {
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
      letter-spacing: -0.015em;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      max-width: 13rem;
    }

    .cd-phonetic {
      font-size: 0.84375rem;
      line-height: 1.3;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: rgba(51, 65, 85, 0.85);
      padding: 0.125rem 0.5rem;
      border-radius: 0.3125rem;
      border: 0.0625rem solid rgba(255, 255, 255, 0.2);
      overflow: visible;
    }

    .cd-original-form {
      font-size: 0.8125rem;
      line-height: 1.3;
      color: #94a3b8;
      font-weight: 500;
    }

    .cd-badge {
      display: inline-block;
      padding: 0.15rem 0.55rem;
      font-size: 0.71875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 0.375rem;
      background: rgba(99, 102, 241, 0.35);
      color: #e0e7ff;
      border: 0.0625rem solid rgba(165, 180, 252, 0.5);
      box-shadow: inset 0 0.0625rem 0 rgba(255, 255, 255, 0.15);
      overflow: visible;
    }

    .cd-actions {
      display: flex;
      align-items: center;
      gap: 0.4375rem;
      flex-shrink: 0;
    }

    /* Liquid Glass Buttons */
    .cd-btn {
      background: rgba(51, 65, 85, 0.75);
      border: 0.0625rem solid rgba(255, 255, 255, 0.2);
      outline: none;
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f1f5f9;
      box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.3);
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .cd-btn:hover {
      background: rgba(71, 85, 105, 0.95);
      border-color: rgba(255, 255, 255, 0.4);
      color: #ffffff;
      transform: translateY(-0.0625rem);
    }

    .cd-btn:active {
      transform: translateY(0);
    }

    .cd-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 0.125rem rgba(99, 102, 241, 0.6);
    }

    .cd-btn.cd-saved {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.25);
      border-color: rgba(251, 191, 36, 0.6);
      filter: drop-shadow(0 0 0.375rem rgba(251, 191, 36, 0.6));
    }

    .cd-btn svg {
      width: 1.0625rem;
      height: 1.0625rem;
      fill: currentColor;
    }

    /* nat-icon-button overrides in Shadow DOM Tooltip */
    nat-icon-button.cd-btn::part(button) {
      width: 2rem;
      height: 2rem;
      border-radius: var(--md-sys-shape-corner-small, 0.5rem);
      color: var(--md-sys-color-on-surface-variant);
    }
    nat-icon-button.cd-tts-btn:hover::part(button) {
      color: var(--md-sys-color-primary);
      background-color: var(--md-sys-color-surface-container-highest);
    }
    nat-icon-button.cd-save-btn.cd-saved::part(button) {
      color: #fbbf24;
      background-color: rgba(251, 191, 36, 0.2);
    }
    nat-icon-button.cd-save-btn:hover::part(button) {
      color: #f59e0b;
      background-color: var(--md-sys-color-surface-container-highest);
    }
    nat-icon-button.cd-refresh-btn:hover::part(button) {
      color: var(--md-sys-color-primary, #94ccff);
      background-color: var(--md-sys-color-surface-container-highest, rgba(255, 255, 255, 0.08));
    }

    @keyframes cd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .cd-spinning svg,
    nat-icon-button.cd-spinning svg {
      animation: cd-spin 0.75s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .cd-spinning svg,
      nat-icon-button.cd-spinning svg {
        animation: none !important;
        opacity: 0.6;
      }
    }

    /* Body */
    .cd-body {
      padding: 0.9375rem 1.0625rem;
      background: transparent;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-height: min(26rem, calc(100vh - 7rem));
      overflow-y: auto;
    }

    .cd-body::-webkit-scrollbar {
      width: 0.25rem;
    }

    .cd-body::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 0.25rem;
    }

    /* Translation Main */
    .cd-translation-row {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      overflow: visible;
    }

    .cd-translation-label {
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.4;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #94a3b8;
      overflow: visible;
      flex-shrink: 0;
    }

    .cd-translation {
      font-size: 1.1875rem;
      font-weight: 700;
      color: #38bdf8;
      line-height: 1.4;
      overflow: visible;
    }

    /* Context Boxes with High-Contrast Depth */
    .cd-context-box {
      background: rgba(30, 41, 59, 0.85);
      border: 0.0625rem solid rgba(255, 255, 255, 0.15);
      box-shadow: inset 0 0.0625rem 0 0 rgba(255, 255, 255, 0.08);
      border-radius: 0.625rem;
      padding: 0.6875rem 0.875rem;
    }

    .cd-sentence-translation-box {
      background: rgba(30, 41, 59, 0.95);
      border: 0.0625rem solid rgba(56, 189, 248, 0.42);
      box-shadow:
        inset 0 0.0625rem 0 0 rgba(56, 189, 248, 0.25),
        0 0.125rem 0.5rem -0.125rem rgba(0, 0, 0, 0.4);
    }

    .cd-sentence-translation-box .cd-context-header {
      color: #7dd3fc;
    }

    .cd-context-note-box .cd-context-header {
      color: #a5b4fc;
    }

    .cd-sentence-translation-text {
      color: #ffffff;
      font-size: 0.9375rem;
      font-style: italic;
      line-height: 1.6;
      overflow: visible;
    }

    .cd-badge-sentence {
      background: rgba(99, 102, 241, 0.22);
      color: #94ccff;
      border: 0.0625rem solid rgba(99, 102, 241, 0.4);
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.5rem;
      border-radius: var(--md-sys-shape-corner-small, 0.5rem);
      letter-spacing: 0.02em;
    }

    .cd-source-sentence-box {
      margin-bottom: 0.625rem;
      padding: 0.5rem 0.6875rem;
      background: rgba(15, 23, 42, 0.6);
      border-left: 0.125rem solid var(--md-sys-color-primary, #94ccff);
      border-radius: 0 0.375rem 0.375rem 0;
    }

    .cd-source-sentence-text {
      font-size: 0.8125rem;
      color: var(--md-sys-color-on-surface-variant, #c2c7cf);
      line-height: 1.5;
      font-style: italic;
      word-break: break-word;
    }

    .cd-sentence-translation {
      font-size: 0.9375rem;
      line-height: 1.55;
      color: #f8fafc;
      font-weight: 500;
      word-break: break-word;
    }

    .cd-copy-btn.cd-copied {
      color: var(--md-sys-color-success, #88da8d) !important;
    }

    .cd-context-header {
      display: flex;
      align-items: center;
      gap: 0.4375rem;
      margin-bottom: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #e2e8f0;
      overflow: visible;
    }

    .cd-svg-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: -0.0625rem;
      line-height: 0;
      margin-right: 0.25rem;
    }

    .cd-context-header span.icon {
      font-size: 0.875rem;
    }

    .cd-context-desc {
      font-size: 0.875rem;
      color: #f1f5f9;
      line-height: 1.6;
      overflow: visible;
    }

    /* Footer */
    .cd-footer {
      padding: 0.6875rem 1.0625rem;
      background: rgba(15, 23, 42, 0.85);
      border-top: 0.0625rem solid rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 0.0625rem 0 rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.78125rem;
      color: #cbd5e1;
      overflow: visible;
    }

    .cd-source-tag {
      display: flex;
      align-items: center;
      gap: 0.3125rem;
      color: #38bdf8;
      font-weight: 700;
      font-size: 0.78125rem;
      overflow: visible;
    }

    /* High-Visibility Skeleton Loading with Shimmer */
    .cd-sk-card {
      background: rgba(30, 41, 59, 0.75);
      border: 0.0625rem solid rgba(255, 255, 255, 0.14);
      border-radius: 0.625rem;
      padding: 0.6875rem 0.875rem;
      box-shadow: inset 0 0.0625rem 0 rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
    }

    .cd-skeleton {
      display: block;
      border-radius: 0.375rem;
      background: linear-gradient(
        90deg,
        rgba(71, 85, 105, 0.6) 0%,
        rgba(71, 85, 105, 0.6) 20%,
        rgba(255, 255, 255, 0.4) 50%,
        rgba(71, 85, 105, 0.6) 80%,
        rgba(71, 85, 105, 0.6) 100%
      );
      background-size: 200% 100%;
      animation: cd-shimmer 1.5s infinite linear;
      border: 0.0625rem solid rgba(255, 255, 255, 0.18);
    }

    .cd-sk-box {
      border-radius: 0.5rem;
      background: linear-gradient(
        90deg,
        rgba(51, 65, 85, 0.85) 0%,
        rgba(51, 65, 85, 0.85) 20%,
        rgba(255, 255, 255, 0.38) 50%,
        rgba(51, 65, 85, 0.85) 80%,
        rgba(51, 65, 85, 0.85) 100%
      );
      background-size: 200% 100%;
      animation: cd-shimmer 1.5s infinite linear;
      border: 0.0625rem solid rgba(255, 255, 255, 0.18);
    }

    .cd-skeleton-cyan {
      background: linear-gradient(
        90deg,
        rgba(14, 116, 144, 0.6) 0%,
        rgba(14, 116, 144, 0.6) 20%,
        rgba(56, 189, 248, 0.7) 50%,
        rgba(14, 116, 144, 0.6) 80%,
        rgba(14, 116, 144, 0.6) 100%
      );
      background-size: 200% 100%;
      border-color: rgba(56, 189, 248, 0.45);
    }

    @keyframes cd-shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    .cd-sk-text {
      height: 0.9375rem;
      margin-bottom: 0.4375rem;
    }

    .cd-loading-dot {
      width: 0.4375rem;
      height: 0.4375rem;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 0.375rem #38bdf8;
      display: inline-block;
      animation: cd-pulse 1.2s infinite ease-in-out;
    }

    @keyframes cd-pulse {
      0%, 100% { opacity: 0.4; transform: scale(0.85); }
      50% { opacity: 1; transform: scale(1.15); }
    }

    /* Alert / Error Box with Glass Frosting */
    .cd-alert {
      padding: 0.75rem;
      border-radius: 0.625rem;
      background: rgba(239, 68, 68, 0.12);
      border: 0.0625rem solid rgba(239, 68, 68, 0.3);
      box-shadow:
        inset 0 0.0625rem 0 rgba(255, 255, 255, 0.08),
        inset 0 0.125rem 0.25rem rgba(0, 0, 0, 0.2);
      color: #fca5a5;
      font-size: 0.75rem;
      line-height: 1.45;
    }

    .cd-alert-info {
      background: rgba(99, 102, 241, 0.14);
      border-color: rgba(99, 102, 241, 0.35);
      color: #c7d2fe;
    }

    .cd-alert-title {
      font-weight: 700;
      margin-bottom: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .cd-alert-desc {
      color: #cbd5e1;
      font-size: 0.71875rem;
      line-height: 1.4;
    }

    .cd-alert-link {
      display: inline-block;
      margin-top: 0.5rem;
      padding: 0.25rem 0.625rem;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #ffffff;
      border-radius: 0.375rem;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.6875rem;
      box-shadow: 0 0.125rem 0.5rem rgba(99, 102, 241, 0.35), inset 0 0.0625rem 0 rgba(255, 255, 255, 0.3);
    }

    .cd-retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.5rem;
      padding: 0.3125rem 0.625rem;
      background: var(--md-sys-color-surface-container-highest, rgba(255, 255, 255, 0.08));
      border: 0.0625rem solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.15));
      border-radius: var(--md-sys-shape-corner-small, 0.5rem);
      color: var(--md-sys-color-on-surface, #e0e2e8);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .cd-retry-btn:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      border-color: var(--md-sys-color-primary, #94ccff);
    }
    .cd-retry-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 0.125rem rgba(99, 102, 241, 0.6);
    }
    .cd-retry-btn svg {
      width: 0.875rem;
      height: 0.875rem;
      fill: currentColor;
    }
  `;

  window.ContextDictTooltipStyles = {
    ICONS,
    STYLES,
  };
})();
