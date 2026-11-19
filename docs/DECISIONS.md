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

### DEC-007: Patient Dashboard Redesign & Adherence Layout
* **Skill Cited:** `ui-ux-pro-max-skill` (StatCard KPI System) & `taste-skill` (Restrained Hero Pacing).
* **Rule:** Triage metrics must immediately indicate status without cognitive overload; today's doses must be verifiable with one touch.
* **Decision:** Applied `StatCard` across the 4 key clinical metrics (Total Documents, Prescriptions, Lab Reports, Review Needed). Designed the welcome banner with clinical-warm tokens. Connected interactive `StatusBadge` to recent documents feed and medication adherence list. Positioned `DisclaimerBanner` persistently. Verified with production build.

### DEC-008: Analytics & Recharts Reference-Band Architecture
* **Skill Cited:** `ui-ux-pro-max-skill` (Recharts Clinical Guidelines) & `taste-skill` (High-density, low-clutter).
* **Rule:** Lab analyte trends must always display shaded normal reference ranges (`ReferenceArea`), critical thresholds (`ReferenceLine`), and clinical tooltips with explicit units. Never leave the user without context for out-of-range biomarkers.
* **Decision:** Re-architected `/analytics` with dynamic analyte selector pills, KPI summary cards, Recharts Area/Line charts with normal shaded bands, out-of-range flag counts, observation history table with `StatusBadge`, and resilient fallback data to prevent unhandled zero-state errors.

### DEC-009: Token Sanitization & Resilient Demo Authentication Fallback
* **Skill Cited:** `impeccable` (Robust edge-case handling) & Healthcare Non-Negotiables.
* **Rule:** Authentication failures in development/demo mode or malformed stored tokens must never crash patient visualization or trigger raw unhandled Next.js error overlays.
* **Decision:** Updated `backend/app/core/auth.py` and `frontend/src/lib/auth-context.tsx` so that malformed tokens (invalid segment counts), expired tokens, or unverified JWTs automatically fall back to the synthetic demo user (`demo-patient-001`, Alex Morgan) when `DEMO_MODE_ENABLED` is active. Sanitized localStorage on app init and added fallback demo feeds to `/analytics` and `/timeline`.

### DEC-010: Landing Hero 2-Column Split & Vertical Feature Tab Architecture
* **Skill Cited:** `taste-skill` (Signature Moment & Editorial Layout) & User Feedback Directive.
* **Rule:** Hero must cleanly separate value proposition on the left from action portal on the right. Feature previews must use vertical stacked selectors (one by one up-and-down) on the left with the active display card on the right. Remove all unnecessary badges, redundant navigation links, and vanity statistics rows.
* **Decision:** Streamlined the navbar by removing the `PATIENT VAULT` badge and `Features / How It Works / Security & Privacy` links. Set Main Heading to "Your Records In Order" with subtitle "Your Health. Connected. Intelligent. Organized." and description "All your medical records, neatly organised in one place." Hero left column displays clear typography and aligned trust points; hero right column displays an instant patient access card. Re-structured interactive showcase into 4 vertical buttons on the left and a comprehensive preview card on the right. Completely excised the bottom vanity stats bar.




