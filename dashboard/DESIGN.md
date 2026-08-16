---
name: "Real Estate CRM Dashboard"
description: "A quiet, tactile operational ledger for property CRM work."
colors:
  paper: "oklch(1 0 0)"
  paper-subtle: "oklch(0.972 0.003 230)"
  paper-muted: "oklch(0.94 0.004 230)"
  graphite: "oklch(0.19 0.012 230)"
  graphite-muted: "oklch(0.46 0.012 230)"
  ledger-blue: "oklch(0.48 0.105 230)"
  ledger-blue-ink: "oklch(0.36 0.09 230)"
  ledger-blue-wash: "oklch(0.94 0.018 230)"
  rule: "oklch(0.86 0.006 230)"
  success-ink: "oklch(0.40 0.075 150)"
  success-wash: "oklch(0.94 0.025 150)"
  warning-ink: "oklch(0.43 0.085 65)"
  warning-wash: "oklch(0.95 0.035 75)"
  destructive-ink: "oklch(0.48 0.15 25)"
  destructive-wash: "oklch(0.95 0.025 25)"
  dark-paper: "oklch(0.16 0.006 230)"
  dark-surface: "oklch(0.205 0.007 230)"
  dark-graphite: "oklch(0.92 0.006 230)"
  dark-muted: "oklch(0.70 0.01 230)"
  dark-rule: "oklch(0.31 0.008 230)"
typography:
  headline:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0.01em"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.01em"
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ledger-blue}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    height: "36px"
  navigation-active:
    backgroundColor: "{colors.ledger-blue-wash}"
    textColor: "{colors.ledger-blue-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    height: "36px"
  status-neutral:
    backgroundColor: "{colors.paper-muted}"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "3px 6px"
---

<!-- PRE-IMPLEMENTATION NORMATIVE SPEC: re-run the Impeccable document scan after the first complete UI implementation to verify that code and tokens still match. -->

# Design System: Real Estate CRM Dashboard

## 1. Overview

**Creative North Star: "The Quiet Ledger"**

The interface should feel like precise operational information printed on an exceptionally clean e-ink surface. It combines the calm shell and broad hierarchy of the approved Quiet Ledger probe with the dense table-and-inspector topology of the approved Archival Index probe. The metaphor is expressed through flat surfaces, fine rules, crisp typography, restrained color, and stable spatial relationships—not through literal paper props.

The design serves mixed CRM staff who spend long periods scanning and editing records. It must be fast to parse, familiar to operate, and quiet under pressure. Desktop pages preserve context through route-driven inspectors; small screens translate the same records into compact lists and full-page details. Motion communicates state only.

The system explicitly rejects generic SaaS dashboard card walls, vibrant gradients, neon accents, glassmorphism, cream or beige surfaces, literal notebook skeuomorphism, nested cards, and fabricated analytics.

**Key Characteristics:**

- Flat paper-like surfaces separated by 1px rules.
- Low-radius controls and compact, readable density.
- Graphite text with one low-chroma ledger-blue accent.
- Tables and split inspectors as the primary desktop workspace.
- Standard shadcn affordances with complete interaction states.
- English LTR today, logical-property and RTL-safe construction throughout.

## 2. Colors

The palette is a restrained monochrome ledger with one quiet blue annotation color and subdued semantic washes.

### Primary

- **Ledger Blue:** the only brand/action accent. Use it for primary actions, current selection, and interactive links. It must occupy no more than 10% of a screen.
- **Ledger Blue Ink:** use for text and icons on the pale Ledger Blue Wash.
- **Ledger Blue Wash:** use for selected navigation, selected rows, and informational badges. Never use it as a large page background.

### Secondary

- **Success Ink and Wash:** use only for confirmed positive states such as qualified or won.
- **Warning Ink and Wash:** use for states that require attention without implying failure.
- **Destructive Ink and Wash:** reserve for destructive actions and error states.

### Neutral

- **Paper:** the light-mode canvas and the default control surface.
- **Paper Subtle:** the single secondary surface for sidebars, inspectors, toolbars, and grouped regions.
- **Paper Muted:** the quietest selected, disabled, or status-chip surface.
- **Graphite:** default text and icons.
- **Graphite Muted:** secondary metadata; never use it where body-copy contrast would fail.
- **Rule:** the shared 1px divider, input border, table rule, and container boundary.
- **Dark Paper, Dark Surface, Dark Graphite, Dark Muted, and Dark Rule:** the dark-mode equivalents. Dark mode remains neutral and print-like; it does not become neon or tinted purple.

**The Ten Percent Rule.** Ledger Blue is functional annotation, never decoration. If blue dominates the screen, the design has failed.

**The Neutral Paper Rule.** Main surfaces remain chroma-zero or cool-neutral. Cream, beige, parchment, and faux-aged paper are prohibited.

**The Semantic Wash Rule.** Status colors use dark ink on pale washes. Solid saturated status pills are prohibited.

## 3. Typography

**Display Font:** Inter Variable with system sans-serif fallback

**Body Font:** Inter Variable with system sans-serif fallback

**Label/Mono Font:** the platform monospace stack for identifiers, dates, amounts, and tabular numerals only

**Character:** One disciplined sans-serif keeps the product familiar and quiet. Monospace is a data tool, not a decorative voice; it adds archival precision only where character alignment improves scanning.

### Hierarchy

- **Headline** (600, 1.5rem, 1.25): route titles and major inspector titles. Use one per page region.
- **Title** (600, 1.125rem, 1.35): section headings, grouped form titles, and dialog titles.
- **Body** (400, 0.875rem, 1.5): controls, table cells, descriptions, and operational copy. Prose is capped at 70ch.
- **Label** (500, 0.75rem, 0.01em): field labels, metadata, table headers, and compact badges. Sentence case is mandatory.
- **Data** (500, 0.8125rem, 1.4): IDs, money, percentages, and timestamps where aligned glyphs materially improve comparison.

**The One Sans Rule.** Do not introduce a display font into headings, labels, buttons, or navigation.

**The Sentence Case Rule.** Uppercase labels with wide tracking are prohibited. Use weight and placement for hierarchy.

**The Data Only Rule.** Monospace is restricted to identifiers and aligned quantitative data. Paragraphs and navigation never use it.

## 4. Elevation

The system is flat by default. Depth comes from tonal surface changes, rules, sticky positioning, and selected-row inversion. Shadows appear only where a floating layer must be distinguished from the document plane: dropdowns, popovers, sheets, dialogs, and tooltips.

### Shadow Vocabulary

- **Floating Low** (`0 8px 24px rgb(15 23 42 / 0.08)`): dropdown menus, popovers, and command results.
- **Floating High** (`0 18px 48px rgb(15 23 42 / 0.14)`): dialogs and mobile sheets.

**The Flat-by-Default Rule.** Cards, table regions, sidebars, inspectors, and form sections never receive ambient shadows at rest.

**The One Plane Rule.** Do not stack rounded cards inside rounded cards. Use a heading, spacing, or a 1px rule to express hierarchy.

## 5. Components

### Buttons

- **Shape:** compact and gently squared (4px radius), 36px default height, and at least 44px touch target on coarse-pointer devices.
- **Primary:** Ledger Blue with Paper text. One primary action per local region.
- **Hover / Focus:** darken the fill slightly on hover; active state compresses through color, never bounce or scale choreography.
- **Secondary:** Paper surface, Graphite text, and a 1px Rule border.
- **Ghost:** transparent at rest and Paper Muted on hover. Icon-only buttons always have an accessible name and tooltip.
- **Destructive:** destructive ink and border at rest; use a filled destructive treatment only inside the final confirmation action.

### Chips

- **Style:** compact 2px-radius status labels using pale semantic washes, dark semantic ink, and an optional 1px border.
- **State:** selection must be communicated by more than color. Filter chips include text or an icon plus a visible selected state.

### Cards / Containers

- **Corner Style:** low radius (6px maximum) when containment is necessary.
- **Background:** Paper or Paper Subtle.
- **Shadow Strategy:** none at rest.
- **Border:** one complete 1px Rule border or simple horizontal rules. Colored side stripes are forbidden.
- **Internal Padding:** 16px compact regions, 24px primary regions. Dense tables use cell padding rather than a padded outer card.

### Inputs / Fields

- **Style:** 36px controls with Paper background, Graphite text, 1px Rule border, and 4px radius.
- **Focus:** keep the control visually flat. Never add a focus-visible border, outline, ring, or box-shadow to an input, textarea, select, combobox, or input group. Placeholder text must remain readable.
- **Error / Disabled:** error text appears adjacent to the field and is connected with `aria-describedby`; disabled controls use Paper Muted without reducing text below readable contrast.
- **Forms:** use shadcn `Field`, React Hook Form, and Zod. Server validation remains authoritative and maps back to the relevant field.

### Navigation

- The desktop sidebar collapses to icons and becomes an off-canvas sheet on small screens.
- Default items use Graphite Muted; hover uses Paper Muted; active items use Ledger Blue Wash with Ledger Blue Ink.
- Navigation groups follow product domains, not database internals. Items and actions are filtered by documented permissions.
- The header contains breadcrumbs, route-specific actions, and the user menu. A command palette may navigate and launch documented quick actions, but cannot pretend to search records without an API.

### Data Workspace

- Desktop entity pages use an Archival Index layout: page header, compact toolbar, data table, and route-addressable detail inspector.
- Selected rows use a full-row neutral or blue wash, not a colored edge.
- Sorting, filtering, pagination, and bulk actions appear only when their backend contract exists.
- Mobile replaces wide tables with compact record summaries and a full-page detail route using the same query state.
- Loading uses structural skeletons; empty states teach the next permitted action; errors preserve context and provide retry.

### Overlays

- Use an Alert Dialog for destructive confirmation.
- Use Sheets for mobile navigation and mobile inspectors, not as a default desktop form container.
- Use Dialog only for brief, interruptive decisions. Complex create/edit work remains route-based.
- Portaled content must escape table and inspector overflow boundaries and preserve direction.

## 6. Do's and Don'ts

### Do:

- **Do** use the approved Quiet Ledger reference for the shell and the Archival Index reference for entity-page topology.
- **Do** create hierarchy with fixed typography, alignment, 4/8/12/16/24/32px spacing, and 1px rules.
- **Do** keep Ledger Blue below 10% of visible surface area.
- **Do** use complete component states: default, hover, focus-visible, active, disabled, loading, error, and selected where applicable.
- **Do** keep form-control focus states free of borders, outlines, rings, and box-shadows, including styles inherited from global selectors.
- **Do** preserve selected-record context in the URL.
- **Do** use logical inline/block properties and verify an RTL smoke case.
- **Do** keep animations between 150ms and 200ms, state-driven, and removable under `prefers-reduced-motion`.
- **Do** maintain WCAG 2.2 AA contrast and keyboard-operable workflows.

### Don't:

- **Don't** build generic SaaS dashboard card walls with oversized metrics and decorative charts.
- **Don't** use vibrant purple or blue gradients, neon accents, or glassmorphism.
- **Don't** use cream, beige, parchment, or faux-vintage warmth as the main surface.
- **Don't** imitate literal notebook skeuomorphism: no spiral bindings, torn paper, sticky notes, leather, or handwriting.
- **Don't** use over-rounded controls, nested cards, heavy shadows, or decorative motion.
- **Don't** use `focus-visible:ring-*`, `focus-within:ring-*`, focus borders, or focus box-shadows on form controls.
- **Don't** use a colored border-left or border-right greater than 1px as an accent.
- **Don't** use gradient text, uppercase tracked eyebrows, or numbered headings as visual scaffolding.
- **Don't** invent analytics, global record search, filters, role choices, payment behavior, or ordering that is absent from OpenAPI.
- **Don't** hide contract uncertainty with `any`, placeholder records, or UI-only behavior presented as real.
