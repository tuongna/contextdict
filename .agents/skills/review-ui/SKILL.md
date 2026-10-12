---
name: review-ui
description: >-
  Use this skill to audit, review, or design-lint HTML/CSS/JS frontend code in ContextDict. Verifies token adherence, anti-generic rules, contrast ratios, and accessibility compliance.
---

# Review UI (AI Design Lint) — ContextDict

This skill acts as an **AI Design Linter**, enabling a comprehensive audit of user interface quality, catching token discrepancies, visual defects, or design system violations prior to handoff.

---

## Review Checklist

### 1. Arbitrary Values Scan
Scan all newly added CSS rules or styles:
- [ ] **Colors**: Are there any hardcoded hex/rgb color values that are not in the token list of [design-system.md](../../rules/design-system.md)? (Except pure `#ffffff` or `#000000`).
- [ ] **Spacing**: Are there any margin/padding/gap values that are not divisible by `2px` or fall outside the 4px grid (e.g., `7px`, `11px`, `17px`, `23px`)?
- [ ] **Border Radius**: Do `border-radius` values adhere to the 3 standard tiers: `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px)? Are there any unauthorized pill buttons (9999px)?

### 2. Glassmorphism & Shadows
- [ ] Is `-webkit-backdrop-filter` paired alongside `backdrop-filter` for WebKit compatibility?
- [ ] Are box-shadows overly intense (neon glow) or excessively dark, muddying the screen?
- [ ] Are semi-transparent backgrounds (alpha 0.5 - 0.7) stacked excessively, causing muddy composite colors?

### 3. Typography & Contrast
- [ ] Are there any font sizes smaller than `10px`? (Prohibited due to eye strain).
- [ ] Is `--text-subtle` (`#64748b`) overused, degrading readability of core content?
- [ ] Are labels grammatically correct with no awkward text wrapping or orphan words?

### 4. Accessibility (A11y Lint)
- [ ] Do all icon-only buttons (`<button class="icon-btn">`, `<button class="card-btn">`) have `aria-label` and `title` attributes?
- [ ] Do any interactive elements have `outline: none` without a high-contrast `:focus-visible` ring replacement?
- [ ] Does every input element have an associated `label` via `id`/`for` or `aria-label`?

### 5. Compatibility & Bounded Layout Constraints
- [ ] Popup: Does the width exceed `380px` or height exceed `540px`, triggering unsightly outer body scrollbars?
- [ ] Tooltip: When placed near the right or bottom screen boundary, does the auto-flip algorithm position it safely within the viewport?

---

## Review Report Template

When performing a review, output the report using the following format:

```markdown
### 📋 UI Review Results

| Criteria | Status | Notes |
|---|---|---|
| **Design Tokens** | ✅ Pass / ⚠️ Warning / ❌ Fail | [Violation details if any] |
| **Spacing & Radius** | ✅ Pass / ⚠️ Warning / ❌ Fail | [Details] |
| **Glassmorphism & Prefix** | ✅ Pass / ⚠️ Warning / ❌ Fail | [Details] |
| **Contrast & Typography** | ✅ Pass / ⚠️ Warning / ❌ Fail | [Details] |
| **Accessibility (A11y)** | ✅ Pass / ⚠️ Warning / ❌ Fail | [Details] |
| **Layout & Scopes** | ✅ Pass / ⚠️ Warning / ❌ Fail | [Details] |

**Conclusion:** [Ready for handoff / Needs fixes for the following items before merge]
```
