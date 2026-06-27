---
name: ChemFox
description: Approachable pro lab workflow UI — Linear clarity, Mantine structure, status-first hierarchy.
colors:
  staff-nav: "#111318"
  accent-green: "#2f9e44"
  accent-green-bright: "#51cf66"
  accent-green-tint: "#b2f2bb"
  client-active: "#228be6"
  client-active-bg: "#e7f5ff"
  body: "#ffffff"
  surface-muted: "#f1f3f5"
  text-primary: "#212529"
  text-dimmed: "#868e96"
  border-default: "#dee2e6"
  status-blue-bg: "#e7f5ff"
  status-blue-fg: "#1864ab"
  status-cyan-bg: "#e3fafc"
  status-cyan-fg: "#0b7285"
  status-yellow-bg: "#fff4e6"
  status-yellow-fg: "#c04a00"
  status-teal-bg: "#f3fbe8"
  status-teal-fg: "#2b6b10"
  status-green-bg: "#ebfbee"
  status-green-fg: "#1a6b2a"
  status-red-bg: "#fff5f5"
  status-red-fg: "#c92a2a"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  nav-staff:
    backgroundColor: "{colors.staff-nav}"
    textColor: "#ffffff"
    height: "54px"
  nav-staff-active:
    textColor: "#ffffff"
  nav-client:
    backgroundColor: "{colors.body}"
    textColor: "{colors.text-primary}"
    height: "56px"
  nav-client-active:
    backgroundColor: "{colors.client-active-bg}"
    textColor: "{colors.client-active}"
    rounded: "{rounded.sm}"
  button-primary:
    backgroundColor: "{colors.accent-green}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  card-default:
    backgroundColor: "{colors.body}"
    rounded: "{rounded.md}"
    padding: "16px"
  status-badge:
    backgroundColor: "{colors.status-blue-bg}"
    textColor: "{colors.status-blue-fg}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: ChemFox

## Overview

**Creative North Star: "The Status Board"**

ChemFox is a workflow instrument, not a brochure. Visual hierarchy follows experiment lifecycle: where a sample is, who owns it, and what happens next should read faster than any decorative chrome. The system builds on Mantine 9 defaults for forms, inputs, and density, then layers two deliberate registers — a **light client shell** (blue active states, white body) and a **dark staff shell** (charcoal nav, green accent) — that still feel like one product.

Approachable pro means Linear-grade clarity without cold minimalism: readable type, confident status color, subtle hover feedback on interactive cards and rows. Motion is functional (0.15–0.18s ease on hovers and lifts), never ornamental. Surfaces stay flat at rest; depth appears on interaction or when grouping kanban lanes.

The system rejects consumer/playful UI, generic SaaS marketing patterns, legacy enterprise gray mush, and dark-neon tool theatrics — per PRODUCT.md.

**Key Characteristics:**

- Status color is semantic and reserved — lifecycle hues (blue → cyan → yellow → teal → green → red) never double as brand decoration.
- Staff brand green (`#2f9e44`) appears on admin nav, bold cards, and primary actions — not on every badge.
- Client surfaces use Mantine blue for navigation active states; staff surfaces use green underline tabs on dark chrome.
- Cards and tables carry data; borders and muted fills separate groups, not nested card stacks.
- Custom CSS (`bold-card`, `bold-row`) extends Mantine for catalog/onboarding hover affordances — use sparingly, not as a default card pattern.

## Colors

The palette is **restrained product UI**: white body, gray borders, a lifecycle status spectrum, and two accent voices (green for staff brand, blue for client navigation).

### Primary

- **Lab Green** (`#2f9e44`): Staff brand accent — admin nav underline, logo stroke, bold-card top bar, primary CTAs on staff flows. The signal that an action moves lab work forward.
- **Bright Green** (`#51cf66`): Gradient partner in bold-card accent bars only; never used alone for text on white.

### Secondary

- **Client Blue** (`#228be6` / bg `#e7f5ff`): Client nav active pill and focus within the experiment requester shell. Keeps client wayfinding distinct from staff green without introducing a second brand.

### Tertiary

- **Staff Charcoal** (`#111318`): Admin top nav background. Anchors the staff register; do not use as page body fill.

### Neutral

- **Body White** (`#ffffff`): Default page background (Mantine `body`).
- **Surface Muted** (`#f1f3f5`): Kanban lane backgrounds, table hover fills, secondary panels (`default-hover`).
- **Text Primary** (`#212529`): Body copy and headings (Mantine `text`).
- **Text Dimmed** (`#868e96`): Metadata, timestamps, placeholders — must still meet 4.5:1 on white; bump toward primary if contrast fails on tinted surfaces.
- **Border Default** (`#dee2e6`): Card borders, nav dividers, input outlines.

### Lifecycle status (semantic — not brand)

Each status maps to `{ bg, fg, dot }` in `AdminExperimentsView` and Mantine `Badge variant="light"` elsewhere:

| Stage | Background | Foreground | Dot |
|-------|------------|------------|-----|
| Requested / Open | `#e7f5ff` | `#1864ab` | `#339af0` |
| Sample received | `#e3fafc` | `#0b7285` | `#22b8cf` |
| In progress | `#fff4e6` | `#c04a00` | `#fd7e14` |
| Finalizing | `#f3fbe8` | `#2b6b10` | `#74c214` |
| Closed / Completed | `#ebfbee` | `#1a6b2a` | `#40c057` |
| Cancelled | `#fff5f5` | `#c92a2a` | `#fa5252` |

Collaborative editor presence colors (`grape`, `violet`, `indigo`, `cyan`, `pink`, `orange`, `lime`) are intentionally **excluded** from status hues.

### Named Rules

**The Status-Color Rule.** Lifecycle colors communicate ticket state only. Never use status yellow or red as marketing accent, and never reuse editor presence hues for status badges.

**The Two-Shell Rule.** Client routes use light header + blue active nav. Staff routes use dark `#111318` header + green active underline. Do not mix shells on the same page.

## Typography

**Display Font:** System UI stack (Mantine default — no custom webfont loaded)
**Body Font:** Same system stack
**Label/Mono Font:** Mantine monospace (`ui-monospace, SFMono-Regular, …`) for JSON, formulas, and code blocks

**Character:** Neutral, fast-reading grotesque via system fonts — no editorial serif pairing. Feels native to macOS/Windows, appropriate for dense tables and forms.

### Hierarchy

- **Display** (700, clamp 1.75–2.25rem, lh 1.2): Page titles (`Title order={1}`), auth landing. Max one per view.
- **Headline** (600, 1.25rem, lh 1.3): Section headers, kanban lane labels, admin stat banners.
- **Title** (600, 1rem, lh 1.4): Card titles, table column headers, experiment names in lists.
- **Body** (400, 0.875rem / 14px, lh 1.55): Default UI copy. Cap prose blocks at 65–75ch where long text appears.
- **Label** (500, 0.75rem, lh 1.4): Badge text, timestamps, secondary metadata.
- **Mono** (400, ~13px, lh 1.5): Context IDs, raw JSON, formula editor — never for marketing headings.

### Named Rules

**The System-Font Rule.** Do not introduce a second geometric sans for "personality." If custom fonts arrive later, pair on contrast (e.g. serif display + sans body), not two similar sans families.

## Elevation

ChemFox is **flat-by-default with interactive lift**. Resting cards use `withBorder` and no shadow (Mantine `Card`, `Paper`). Auth uses `shadow="sm"` as an exception for the login panel.

Depth on interaction:

- **Bold card hover:** `box-shadow: 0 6px 24px rgba(0,0,0,0.1)`, `translateY(-2px)`, green border tint — catalog/onboarding cards only.
- **Admin table rows:** No shadow; hover background shift and green left accent on first cell (`bold-row`).
- **Sticky navs:** `z-index: 100`, solid backgrounds — no blur/glass.

### Shadow Vocabulary

- **Hover lift** (`0 6px 24px rgba(0,0,0,0.1)`): Bold cards on hover only.
- **Auth panel** (Mantine `shadow="sm"`): Single elevated Paper on auth screen.

### Named Rules

**The No Ghost-Card Rule.** Never pair a 1px border with a wide soft shadow (≥16px blur) on the same resting element. Pick border OR shadow, not both as decoration.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to hover or isolated auth containment.

## Components

### Buttons

- **Shape:** Mantine default — `radius="sm"` (4px). Full pill only for tiny badges/tags.
- **Primary:** Mantine `Button` color `green` on staff flows; default filled blue acceptable on generic Mantine defaults — prefer green when the action is lab/staff-specific.
- **Hover / Focus:** Mantine built-in; no custom bounce. Respect `prefers-reduced-motion`.
- **Secondary / Ghost:** `variant="subtle"` or `variant="light"` for toolbar actions; `LinkButton` wrapper for Next.js navigation from server components.

### Chips / Badges

- **Style:** `Badge variant="light"` with lifecycle `color` prop — tinted bg + saturated fg from status palette.
- **State:** Status is read-only label; filter chips in admin use filled banner tiles (`BANNERS` in AdminExperimentsView) for group selection.

### Cards / Containers

- **Corner Style:** `radius="md"` (8px) — cards, papers, auth panel. Never 24px+ on data cards.
- **Background:** White card on white or muted lane background; kanban lanes use `default-hover` fill.
- **Shadow Strategy:** None at rest; bold-card class adds hover lift (see Elevation).
- **Border:** `withBorder` — 1px `#dee2e6`. Bold-card hover shifts border to `#b2f2bb`.
- **Internal Padding:** `md` (16px) for experiment cards; `sm` (12px) for lane containers.

### Inputs / Fields

- **Style:** Mantine `TextInput`, `Select`, etc. — default border, `radius="sm"`.
- **Focus:** Mantine focus ring — do not suppress.
- **Error / Disabled:** Mantine validation colors; keep error text specific (see `$impeccable clarify` for copy).

### Navigation

- **Staff (`AdminNav`):** 54px dark bar, max-width 1280px centered. Tabs are text links with 2px bottom border — active `#2f9e44`, inactive `rgba(255,255,255,.45)`. Logo: green stroke flask icon + white wordmark.
- **Client (`ClientNav`):** 56px light bar, `Container size="xl"`. Active item: blue text on `blue-light` pill; inactive dimmed. Emoji 🧪 prefix on wordmark (client-only quirk).
- **Mobile:** Horizontal scroll on kanban; nav items `nowrap` — test narrow viewports for overflow.

### Bold Card (signature)

- **Use:** Sample catalog cards, onboarding template picks — not generic list rows.
- **Structure:** Mantine `Card` + `.bold-card` class. Top 3px green gradient bar (`#2f9e44` → `#51cf66`), opacity 0.25 → 1 on hover.
- **Arrow:** `.bold-card-arrow` translates +3px on hover.

### Status Board (signature)

- **Client kanban:** `MyExperimentsBoard` — flex lanes, min-width 240px, lifecycle-ordered columns, count badges per lane.
- **Admin table:** Sortable dense table with group banner filters (Total / Active / Pending / Closed) using solid color tiles `#1c2128`, `#1864ab`, `#c94a00`, `#1a6b2a`.

## Do's and Don'ts

### Do:

- **Do** lead every list and board view with status — badge, lane, or banner before secondary metadata.
- **Do** use Mantine spacing scale (`xs`–`xl`) and components before inventing custom layout primitives.
- **Do** keep staff green for brand moments and primary lab actions; keep lifecycle colors for ticket state.
- **Do** use `bold-card` / `bold-row` hover language consistently when building catalog or admin list affordances.
- **Do** provide `@media (prefers-reduced-motion: reduce)` alternatives when adding custom transitions beyond Mantine defaults.

### Don't:

- **Don't** use consumer / playful UI — rounded blobs, mascot illustrations, gamification, celebration confetti, or "fun" empty states that undermine lab credibility.
- **Don't** use generic SaaS marketing patterns — cream hero backgrounds, gradient text, eyebrow kickers on every section, identical icon-card grids.
- **Don't** use legacy enterprise gray — tiny muted text, modal-heavy flows, tables that bury status.
- **Don't** use dark neon / cyberpunk tool aesthetic — decorative glow, high-chroma accents everywhere, glassmorphism as default.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe on cards or alerts (the `bold-row` 3px green is a hover-only list affordance — do not copy to static callouts).
- **Don't** nest cards inside cards — use spacing and muted lane backgrounds to group instead.
- **Don't** apply bold-card hover lift to dense data tables or form fields — it signals "pick me" navigation, not data entry.
