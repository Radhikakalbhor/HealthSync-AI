# HealthSync AI — Architectural & Design Decisions Log (`DECISIONS.md`)

> **Log Authority:** Principal UX/UI Designer & Design Engineer  
> **Traceability Format:** Date | Step | Skill Cited | Rule / Policy | Decision Rationale  

---

## Step B Decisions (Design Direction & System Tokens)

### DEC-001: Font Pairing & Multi-Script Fallback Stack
* **Skill Cited:** `ui-ux-pro-max-skill` (Typography Pairing Rule 14) & `jakubkrehel/skills` (better-typography).
* **Rule:** Pair geometric display font with high-readability body font; enforce tabular figures for numerical health data (`font-variant-numeric: tabular-nums`); guarantee multi-script fallback for Hindi.
* **Decision:** Selected **Plus Jakarta Sans** (weights 600, 700, 800) for Display/Headings + **Inter** (weights 400, 500, 600) for UI & Body + **Noto Sans Devanagari** fallback for Hindi language support. Configured in `globals.css` and `tailwind.config.js`.

### DEC-002: Clinical Palette & Non-Negotiable Semantic Status System
* **Skill Cited:** `ui-ux-pro-max-skill` (Clinical Data-Dense Profile) & Healthcare Non-Negotiables.
* **Rule:** Never rely on color alone for clinical status. Must pair icon + label + accessible contrast (WCAG AA).
* **Decision:** 
  * Primary Brand: Clinical Deep Teal (`#0D9488` / `hsl(173 80% 36%)`) + Cyan accent (`#0284C7`).
  * Normal / Optimal: Emerald (`#047857`) paired with `<CheckCircle2 />`.
  * Warning / Elevated: Amber (`#B45309`) paired with `<AlertTriangle />`.
  * Critical / Out-of-Range: Rose Red (`#B91C1C`) paired with `<AlertOctagon />`.
  * Info: Sky Blue (`#0369A1`) paired with `<Info />`.
  Mapped into CSS variables at `:root` and `.dark` in `globals.css`.

### DEC-003: Interaction Physics & Emil Kowalski Restraint Framework
* **Skill Cited:** `design-motion-principles` (Emil Kowalski Lens).
* **Rule:** "Should this animate at all?" — Keep interaction speeds fast (150ms–240ms), animate `transform` and `opacity` only (never width/height), and zero spring overshoot on functional data controls.
* **Decision:** Declared motion tokens `--motion-micro: 150ms`, `--motion-enter: 200ms`, `--motion-exit: 150ms`, and `--ease-clinical: cubic-bezier(0.16, 1, 0.3, 1)`. Enforced `prefers-reduced-motion` reset to 0.01ms.

### DEC-004: Nested Border Radius Geometry
* **Skill Cited:** `jakubkrehel/skills` (better-ui optical radius formula).
* **Rule:** $\text{Outer Radius} = \text{Inner Radius} + \text{Padding}$.
* **Decision:** Standardized `rounded-2xl` (`16px`) for cards with `p-3` (`12px`) holding inner `rounded-lg` (`4px–8px`) elements. Standardized buttons and inputs at `rounded-xl` (`12px`).

---

## Step C Decisions (Component Foundation & Accessible Kit)

### DEC-005: Accessible Component Foundation & Tailwind 3.4 Lock
* **Skill Cited:** `shadcn-ui/ui`, `jakubkrehel/skills` (`better-accessibility`), and user Tailwind lock.
* **Rule:** Convert all component primitives to strict Tailwind 3.4 syntax (no `@theme`, no `size-*`); integrate visible focus rings (`:focus-visible`), aria roles, 44px target touch areas, and error messaging.
* **Decision:** Implemented pure React 19 + Tailwind 3.4 primitives (`Button`, `Card`, `Input`, `Select`, `Dialog`, `Sheet`, `Tabs`, `Table`, `Badge`, `Toast`, `Tooltip`, `Skeleton`, `Progress`, `Checkbox`, `Switch`, `BentoGrid`, `BackgroundBeams`). Added custom clinical components (`StatusBadge` with mandatory icon pairing, `StatCard`, `EmptyState`, `DocumentCard`, `AnalyteRow`, `DisclaimerBanner`). Created `/dev/components` showcasing all component states. Verified via successful production build.

---

## Step D Decisions (Screen-by-Screen Clinical Redesign)

### DEC-006: Document Review Hero Split-Screen Architecture
* **Skill Cited:** `taste-skill` (Real Product UI / No empty ground), `ui-ux-pro-max-skill` (Clinical Validation & Provenance), and Healthcare Non-Negotiables.
* **Rule:** Clinical verification requires co-locating the ground-truth document alongside extracted fields to eliminate hallucination risk. Mobile layouts must provide a seamless switcher without horizontal squishing.
* **Decision:** Re-architected `/documents/[id]/review` into a balanced split-screen layout. Left Pane (6 cols) displays original scanned document with zoom/rotation/fullscreen controls, raw OCR text drawer, and SHA-256 integrity check. Right Pane (6 cols) provides calibrated confidence scoring, flagged field alerts, editable encounter metadata, medication tables, analyte rows with `StatusBadge`, clinician certification dialog, and persistent `DisclaimerBanner`. Added responsive tab toggle for mobile viewports.


