# ContextDict — AI Agent Guidelines

Welcome Agent to the codebase of **ContextDict** (an AI-powered context-aware translation Chrome Extension).

Before implementing or modifying any user interface (UI) or frontend logic, the Agent **must** thoroughly understand and adhere to the following rules:

---

## 1. Mandatory Rules to Follow

All frontend and UI code changes must comply with the rules located in the directory [.agents/rules/](./rules/):

1. **[design-system.md](./rules/design-system.md)**:
   - Design token system (colors, spacing, border radii, shadows, blur effects).
   - Design philosophy: Dark Glassmorphism, balanced proportions, anti-generic AI aesthetics.
   - MUST / SHOULD / MUST NOT principles (strictly no arbitrary hex/rgb outside the token palette).
2. **[frontend.md](./rules/frontend.md)**:
   - Chrome Extension Manifest V3 architecture, CSP constraints, Popup vs Content Script / Shadow DOM scoping.
   - CSS authoring standards, cross-browser compatibility (`-webkit-backdrop-filter`, `-webkit-user-select`).
3. **[accessibility.md](./rules/accessibility.md)**:
   - Accessibility standards (A11y): keyboard shortcuts, ARIA labels for icon buttons, text contrast, focus rings.

---

## 2. Workflow Skills

When assigned to build or test UI components, activate the corresponding skills in the [.agents/skills/](./skills/) directory:

- **[build-ui](./skills/build-ui/SKILL.md)**: Step-by-step workflow for implementing a new screen, form, or UI feature.
- **[review-ui](./skills/review-ui/SKILL.md)**: UI self-review checklist (AI Design Lint) prior to handing off work.
- **[create-component](./skills/create-component/SKILL.md)**: Design and packaging standards for highly reusable components.
- **[fixing-accessibility](./skills/fixing-accessibility/SKILL.md)**: Audit & fix A11y issues (ARIA labels for icon buttons, keyboard focus traps, WCAG contrast). Source: `ibelick/ui-skills`.
- **[fixing-motion-performance](./skills/fixing-motion-performance/SKILL.md)**: Audit & optimize animation performance, prevent layout thrashing, leverage GPU compositing (`transform`, `opacity`), and optimize `backdrop-filter` blur. Source: `ibelick/ui-skills`.
- **[web-design-guidelines](./skills/web-design-guidelines/SKILL.md)**: Review UI code for Web Interface Guidelines compliance, accessibility, design audits, and UX best practices. Source: `vercel-labs/agent-skills`.
- **[frontend-design](./skills/frontend-design/SKILL.md)**: Distinctive visual design direction, typography, and aesthetic craft to avoid generic AI templated styling. Source: `anthropics/skills`.

---

## 3. Golden Rules When Writing Code

- **Never hardcode arbitrary values:** Always reference CSS Custom Properties (`var(--...)`) or design tokens defined in `design-system.md`.
- **Respect Shadow DOM encapsulation:** The tooltip injected into external web pages must be 100% isolated—preventing host page styles from leaking into the tooltip and vice versa.
- **Self-review before marking as complete:** Execute the `review-ui` skill to detect token violations, contrast deficiencies, and visual bugs.
