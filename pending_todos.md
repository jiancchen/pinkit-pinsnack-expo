# Pending TODOs (Prioritized)

Last updated: 2026-02-14
Status: Planning only (no implementation in this document)

## Priority Guide
- **P0 (Critical):** Blocks core UX, safety, or user trust.
- **P1 (High):** Strong product/UX impact, should follow P0.
- **P2 (Enhancement):** Nice-to-have polish after core flow is stable.

## P0 - Critical

### 1) New User Tutorial Screen (Claude API key onboarding)
**Goal:** Add a first-run tutorial that explains what Claude API is, where to get a key, and how to paste/test it in app.

**Details:**
- Add a guided onboarding flow for new users before they try generation.
- Include step-by-step instructions for creating/finding a Claude API key.
- Include quick links/help text and clear error recovery for invalid keys.
- Keep returning users out of the tutorial unless manually reopened.

**Acceptance criteria:**
- New users can complete onboarding and successfully configure API key without guessing.
- Invalid API key state is clearly handled with actionable fixes.
- Tutorial can be revisited from Settings.

---

### 2) Create Screen: remove bottom-sheet pattern and use regular modal(s)
**Goal:** Remove all bottom modal logic on Create screen (prompt history, advanced model picker, reset flow) and replace with regular centered modal UX.

**Details:**
- Replace bottom-attached interactions with non-bottom full-screen overlay + centered card modal.
- Keep behavior parity (history selection, advanced model controls, reset action).
- Ensure keyboard and tap behavior are stable (no accidental dismiss while editing).

**Acceptance criteria:**
- No bottom-sheet style interactions remain in Create flow.
- Prompt History and Advanced controls are reachable and functionally equivalent.
- Dismiss/open interactions are reliable on iOS and Android.

---

### 3) Create CTA safety + visibility improvements
**Goal:** Make generation action always visible and safer for token usage.

**Details:**
- Move primary Create/Generate action to top-right toolbar area.
- Remove the cost estimate text directly under the “Describe your app” card.
- On Create button press, show a confirmation dialog with:
  - estimated cost for this run
  - model context
  - disclaimer that usage charges tokens/API cost
  - explicit confirm/cancel actions

**Acceptance criteria:**
- User can trigger generation from top-right without scrolling.
- Confirmation dialog appears every generation attempt.
- Estimate and disclaimer are visible before final confirmation.

---

### 4) Improve default app naming readability on Home
**Goal:** Have AI return a short app name and use it as temporary title until user renames.

**Details:**
- Update prompt/spec so generation returns a concise app short name.
- Store and display this short name as title fallback when no user rename exists.
- Ensure title formatting is readable in Home list/cards.

**Acceptance criteria:**
- Newly generated apps show a short readable title by default.
- User rename still overrides temporary/generated name.

## P1 - High

### 5) Replace style 3x2 picker with tag-based multi-select
**Goal:** Modernize “Pick a design style” to a flexible tag system.

**Details:**
- Remove fixed 3x2 style tiles.
- Add tag input area with multi-select chips.
- Allow users to add custom tags and remove tags via “x”.
- Provide horizontal suggestions from:
  - common tags
  - user’s recent/saved tags

**Acceptance criteria:**
- Multiple tags can be selected and edited easily.
- Custom tags can be added/removed reliably.
- Suggested tags are visible and quick to apply.

---

### 6) Revamp Quick Templates into 2-column grid
**Goal:** Improve layout density and scanability for templates.

**Details:**
- Replace single-column list with two-column card grid.
- Keep template tap behavior unchanged.
- Preserve responsive spacing across device sizes.

**Acceptance criteria:**
- Templates render in a clean 2-column grid on supported screen widths.
- Interaction behavior stays identical.

---

### 7) Home screen title emphasis animation near center
**Goal:** Improve readability and focus as cards move through center.

**Details:**
- As card approaches center, title should slightly scale up and glow.
- Effect should be subtle and performance-safe.
- Avoid flicker or harsh snapping at threshold boundaries.

**Acceptance criteria:**
- Title emphasis effect is noticeable but not distracting.
- Frame rate remains smooth on typical device targets.

---

### 8) Add centered “PINSNACKS” title above search bar
**Goal:** Add a persistent branded header label in Home top area.

**Details:**
- Place centered text “PINSNACKS” above search bar.
- Keep it compatible with both Yellow and Universe themes.
- Avoid collision with safe-area/status-bar and search interactions.

**Acceptance criteria:**
- Header text is visible and centered on common device sizes.
- No overlap with search/favorites panel interaction zones.

---

### 9) Add Spanish (Spain) language support (in addition to English)
**Goal:** Introduce initial localization support for `es-ES`.

**Details:**
- Add base translations for main user-facing strings.
- Add language selection support (English + Spanish Spain).
- Ensure date/number formatting follows locale where applicable.

**Acceptance criteria:**
- User can switch between English and Spanish (Spain).
- Core screens show translated text without missing keys.

## P2 - Enhancement

### 10) Scroll-driven, date-focused background animation
**Goal:** Add a stylized background animation tied to app creation date while scrolling Home.

**Details:**
- As user scrolls cards, animate displayed creation date in background.
- Date treatment should be large, design-forward, and theme-aware (Yellow/Universe).
- Maintain legibility of foreground UI while adding visual motion.

**Acceptance criteria:**
- Date changes correctly with focused/active app while scrolling.
- Animation looks intentional and does not hurt readability/performance.

## Suggested Execution Order
1. P0.1 Tutorial onboarding
2. P0.2 Remove bottom-sheet create modals
3. P0.3 Top-right create + confirmation/estimate flow
4. P0.4 Short-name generation/title fallback
5. P1.5 Tag-based style selector
6. P1.6 Templates grid
7. P1.7 Title emphasis animation
8. P1.8 Home “PINSNACKS” header
9. P1.9 Spanish (Spain) localization
10. P2.10 Date-based background animation
