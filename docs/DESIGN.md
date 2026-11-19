# HealthSync AI — Design Direction & System Specification (`DESIGN.md`)

> **Document Type:** Design System Specification  
> **Status:** Active & Locked (Step B)  
> **Target Stack:** Next.js 15, React 19, Tailwind CSS 3.4, Recharts, Lucide React, Radix UI  
> **Compliance:** WCAG AA (≥ 4.5:1 text, ≥ 3.0:1 UI), HIPAA Security Alignment, Zero-Motion Public Emergency  

---

## 1. Concept & Brand Identity

### 1.1 The Concept (3 Sentences)
HealthSync AI is a calm, surgical health intelligence workspace that transforms messy paper prescriptions and fragmented diagnostic reports into an organized, longitudinal medical history. It balances clinical rigor with warm human clarity, giving patients total command of their medical data while strictly avoiding diagnostic speculation. Every interaction inspires psychological safety, deep trust, and immediate comprehension through disciplined data hierarchy and effortless readability.

### 1.2 Core Brand Adjectives
1. **Clinical-Warm**: Uncompromisingly precise and authoritative like a premier diagnostic lab, yet welcoming and protective.
2. **Surgical**: Impeccable optical alignment, calibrated data density, and zero ambiguous statuses.
3. **Restrained**: Confident without neon gradients, loud badges, or distracting decorative motion.

### 1.3 What This Must NOT Feel Like
* It must **NOT** feel like a consumer wellness or astrology app with bubbly pastel buttons, playful gamification, or emojis as status icons.
* It must **NOT** feel like a generic crypto/fintech dark dashboard drenched in neon cyan glow, glassmorphic blur overload, and spinning gradients.
* It must **NOT** feel like an impenetrable, legacy 1990s EHR (Electronic Health Record) with tiny cramped tables, harsh raw borders, and intimidating medical jargon.

---

## 2. Color System & Semantic Tokens

All colors are defined as CSS variables at `:root` (and `.dark`) using HSL values, compatible with Tailwind CSS 3.4 utility classes.

### 2.1 Base Surfaces & Typography Tokens

| Token Name | CSS Variable | Light Theme | Dark Theme | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas / Base** | `--bg-base` | `hsl(210 40% 98%)` (`#F8FAFC`) | `hsl(222 47% 7%)` (`#0B0F19`) | Global body canvas ground |
| **Surface Raised** | `--surface-card` | `hsl(0 0% 100%)` (`#FFFFFF`) | `hsl(222 40% 12%)` (`#131B2E`) | Cards, panels, review containers |
| **Surface Inset** | `--surface-subtle` | `hsl(210 40% 96%)` (`#F1F5F9`) | `hsl(222 35% 16%)` (`#1A243B`) | Table headers, chip backgrounds |
| **Surface Overlay** | `--surface-overlay`| `hsl(0 0% 100% / 0.95)` | `hsl(222 40% 12% / 0.95)` | Modals, drawers, tooltips |
| **Border Subtle** | `--border-subtle` | `hsl(214 32% 91%)` (`#E2E8F0`) | `hsl(217 33% 22%)` (`#243048`) | Inset dividers, card borders |
| **Border Strong** | `--border-strong` | `hsl(215 25% 82%)` (`#CBD5E1`) | `hsl(217 25% 32%)` (`#374663`) | Active tabs, form inputs on hover |
| **Text Primary** | `--text-primary` | `hsl(222 47% 11%)` (`#0F172A`) | `hsl(210 40% 98%)` (`#F8FAFC`) | High-contrast headings and data |
| **Text Muted** | `--text-muted` | `hsl(215 16% 47%)` (`#64748B`) | `hsl(215 20% 65%)` (`#94A3B8`) | Subtitles, labels, timestamps |
| **Text Inverted** | `--text-inverse` | `hsl(0 0% 100%)` (`#FFFFFF`) | `hsl(222 47% 11%)` (`#0F172A`) | Text on brand buttons |

### 2.2 Brand Accent Tokens

| Token Name | CSS Variable | Light Theme | Dark Theme | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Brand Primary** | `--brand-primary` | `hsl(173 80% 36%)` (`#0D9488`) | `hsl(173 70% 48%)` (`#14B8A6`) | Primary CTA, active nav, focus rings |
| **Brand Hover** | `--brand-hover` | `hsl(173 84% 31%)` (`#0F766E`) | `hsl(173 80% 36%)` (`#0D9488`) | Hover/active states on primary buttons |
| **Brand Subtle** | `--brand-subtle` | `hsl(168 76% 96%)` (`#F0FDFA`) | `hsl(173 80% 12%)` (`#064E3B`) | Active menu item background, pills |
| **Brand Secondary**| `--brand-secondary`| `hsl(199 89% 48%)` (`#0284C7`) | `hsl(199 89% 56%)` (`#38BDF8`) | Secondary actions, biomarker links |

### 2.3 Status Tokens & Mandatory Icon Pairings
> [!IMPORTANT]
> **Healthcare Rule:** Never rely on color alone. Statuses must include both text labels and their designated icon.

| Clinical Status | Background Token | Border Token | Text Token | Mandatory Icon (Lucide) | Clinical Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Optimal / Normal** | `--status-normal-bg` (`#ECFDF5`) | `--status-normal-border` (`#A7F3D0`) | `--status-normal-text` (`#047857`) | `<CheckCircle2 className="w-3.5 h-3.5" />` | Biomarker in range, dose verified |
| **Warning / Elevated**| `--status-warning-bg` (`#FFFBEB`)| `--status-warning-border` (`#FDE68A`)| `--status-warning-text` (`#B45309`)| `<AlertTriangle className="w-3.5 h-3.5" />` | Analyte borderline, refill soon |
| **Critical / Out of Range**| `--status-critical-bg` (`#FEF2F2`)| `--status-critical-border` (`#FECACA`)| `--status-critical-text` (`#B91C1C`)| `<AlertOctagon className="w-3.5 h-3.5" />` | High-risk lab analyte, urgent allergy |
| **Informational** | `--status-info-bg` (`#F0F9FF`) | `--status-info-border` (`#BAE6FD`) | `--status-info-text` (`#0369A1`) | `<Info className="w-3.5 h-3.5" />` | Routine notice, disclaimer, metadata |

---

## 3. Typography System & Multi-Script Fallback

### 3.1 Font Family Hierarchy
* **Display / Headings**: `Plus Jakarta Sans`, sans-serif (Weights: 600, 700, 800) — authoritative, human-geometric.
* **Body / Interface**: `Inter`, sans-serif (Weights: 400, 500, 600) — optimal x-height for clinical tables and reading.
* **Devanagari Fallback (Hindi)**: `Noto Sans Devanagari`, sans-serif — ensures Hindi health terms render without glyph clipping or vertical misalignments.
* **Tabular Figures**: Every numeric value, biomarker result, and timestamp must use `font-variant-numeric: tabular-nums` (Tailwind: `tabular-nums`).

### 3.2 Type Scale

| Level | Size | Line Height | Tracking | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display 2XL** | `2.5rem` (40px) | `1.15` | `-0.03em` | `800` | Landing Page Hero |
| **Display XL** | `2.0rem` (32px) | `1.20` | `-0.025em`| `700` | Screen Titles, Modal Headlines |
| **Heading L** | `1.5rem` (24px) | `1.30` | `-0.02em` | `700` | Section Cards, Review Headers |
| **Heading M** | `1.125rem` (18px)| `1.40` | `-0.01em` | `600` | Sub-sections, Drawer Titles |
| **Body Standard** | `0.9375rem` (15px)| `1.50` | `0` | `400 / 500`| Clinical notes, AI assistant responses |
| **Body Small** | `0.8125rem` (13px)| `1.45` | `+0.01em` | `500` | Table data, metadata labels |
| **Micro / Tag** | `0.6875rem` (11px)| `1.35` | `+0.03em` | `600` | Badges, Reference ranges, Footers |

---

## 4. Spacing, Radius, Elevation & Borders

### 4.1 Spacing Scale (8pt Grid)
* Base unit: `4px` (`0.25rem`). Standard steps: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`.
* Target touch area: Minimum `44px × 44px` for all interactive buttons and mobile elements.

### 4.2 Nested Border Radius Formula (Jakub Krehel Rule)
Where nested elements share a visible inset:
$$\text{Outer Radius} = \text{Inner Radius} + \text{Padding}$$
* Outer Card: `rounded-2xl` (`16px`)
* Container Padding: `p-3` (`12px`)
* Inner Button / Thumbnail: `rounded-lg` (`16px - 12px = 4px` to `8px`)
* Standard Corner Radii:
  * Small Badges: `rounded-md` (`6px`)
  * Buttons / Inputs: `rounded-xl` (`12px`)
  * Cards / Containers: `rounded-2xl` (`16px`)
  * Master Panels / Hero Cards: `rounded-3xl` (`24px`)

### 4.3 Elevation & Shadows (Tailwind 3.4)
* **Shadow Flat / Border Only**: `border border-slate-200/90 shadow-2xs` (standard table rows, non-elevated cards).
* **Shadow Card (Rest)**: `0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)`
* **Shadow Card (Hover)**: `0 10px 20px -3px rgba(15, 23, 42, 0.06), 0 4px 6px -4px rgba(15, 23, 42, 0.03)`
* **Shadow Modal / Sheet**: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`

---

## 5. Motion Tokens & Physics (Emil Kowalski Restraint Lens)

Motion serves comprehension and functional feedback. Animate state transitions only; never animate data just to be decorative.

### 5.1 Duration & Easing Tokens

| Token | Duration | Easing Curve | Use Case |
| :--- | :--- | :--- | :--- |
| `--motion-instant` | `0ms` | `linear` | Focus rings, `prefers-reduced-motion` |
| `--motion-micro` | `150ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Button press, toggle switch, icon cross-fade |
| `--motion-enter` | `200ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Dropdown enter, toast slide-in, tab transition |
| `--motion-exit` | `150ms` | `cubic-bezier(0.4, 0, 1, 1)` | Modal dismiss, toast exit (faster than enter) |
| `--motion-modal` | `240ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Drawer slide-in, modal scale-in |

### 5.2 Motion Rules
1. **Property Lockdown**: Animate `opacity` and `transform` exclusively. Never animate `width`, `height`, `top`, `left`, or `margin`.
2. **Spring Physics**: For interactive drags or sliders: `stiffness: 400`, `damping: 30`, `mass: 1` (zero wobble/overshoot).
3. **Reduced Motion**: Under `@media (prefers-reduced-motion: reduce)`, all transitions collapse to `0.01ms` and content renders immediately.

---

## 6. Recharts Clinical Style Guide

Biomarker tracking requires strict visual discipline to prevent clinical misinterpretation.

### 6.1 Reference-Range Bands & Lines
* **Optimal Range Band**: Rendered as a shaded `<ReferenceArea>` in `--status-normal-bg` (`rgba(16, 185, 129, 0.08)`) with subtle dashed green boundaries (`stroke="#10b981" strokeDasharray="3 3"`).
* **Critical Threshold Line**: Rendered as a `<ReferenceLine>` in `--status-critical-text` (`#b91c1c`) with prominent warning label.
* **Analyte Line**: Solid 2.5px stroke with active dot radius `5px`. Never use smoothed bezier curves that invent false intermediate data points; use `type="monotone"` or `type="linear"` with distinct data points.

### 6.2 Tooltips & Axes
* **X-Axis**: Clear date intervals (`MMM DD, YYYY`) with tick margin `10px`, color `#64748B`, font-size `11px`.
* **Y-Axis**: Tabular values accompanied by unit (`mg/dL`, `%`, `mmol/L`).
* **Clinical Tooltip**: Card background (`#FFFFFF`), border (`#E2E8F0`), displaying:
  * Analyte Name + Date
  * Measured Value (large, bold, tabular figures)
  * Reference Interval (`70 - 99 mg/dL`)
  * Clinical Status Badge (Icon + Text)

---

## 7. Component Principles & Do / Don't Rules

### DO:
* **DO** wrap every numeric value in `tabular-nums` for clean visual alignment in tables.
* **DO** combine icon + label + color on every status chip (`CheckCircle2` for Normal, `AlertOctagon` for Critical).
* **DO** show clear empty states with a helpful illustration, explanation, and primary action.
* **DO** preserve original document provenance: every extracted entity links directly to its source PDF page.
* **DO** display the persistent medical disclaimer at the bottom of all clinical views.

### DON'T:
* **DON'T** use `transition: all` anywhere in the codebase. Specify exact transitioned properties.
* **DON'T** use purple-to-blue neon gradients or dark glassmorphic cards with glowing neon borders.
* **DON'T** rely on hover tooltips for essential medical information; vital data must be readable without hovering.
* **DON'T** use auto-advancing carousels or timed sliders in any health interface.
* **DON'T** truncate drug dosage numbers or clinical units with an ellipsis.
