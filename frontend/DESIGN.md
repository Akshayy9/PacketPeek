# PacketPeek — Design System

> **Source:** Stitch MCP · Project `1991849065632301339`
> **Theme name:** Saffron Health Pulse
> **Color mode:** Light
> **Device target:** Desktop (responsive down to mobile)
> **Last synced:** 2026-08-30

---

## Brand & Philosophy

The design system is built for the fast-paced Indian retail environment, capturing the "Quick-commerce energy" of apps like Zepto or Blinkit while maintaining the authority of a health advisor. The brand personality is **optimistic, transparent, and urgent**.

The visual style is **Modern / Tactile**, utilizing high-vibrancy saffron tones to evoke familiarity and trust. It employs a **"Verdict-First" hierarchy** where health grades are presented with the confidence of a physical stamp. The interface prioritizes speed—using bold typography and clear semantic signaling to tell a story in seconds.

---

## Color Palette

### Core Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#8C4F00` | Primary text-on-light-orange, heavy UI elements |
| `primary-container` | `#FF9505` | **Deep Saffron** — primary buttons, active icons, key highlights |
| `on-primary` | `#FFFFFF` | Text on primary surfaces |
| `on-primary-container` | `#643700` | Text on saffron containers |
| `inverse-primary` | `#FFB874` | Primary color on dark surfaces |
| `secondary` | `#9A4600` | Secondary actions, supporting text |
| `secondary-container` | `#FD8532` | Secondary surface fills |
| `on-secondary` | `#FFFFFF` | Text on secondary surfaces |
| `on-secondary-container` | `#642B00` | Text on secondary containers |
| `tertiary` | `#7E5703` | Tertiary UI elements |
| `tertiary-container` | `#D9A753` | Sunflower Gold — nutritional info card surfaces |
| `on-tertiary` | `#FFFFFF` | Text on tertiary surfaces |
| `on-tertiary-container` | `#5A3D00` | Text on tertiary containers |

### Surface & Background

| Token | Hex | Usage |
|---|---|---|
| `background` | `#FCF9F8` | App background |
| `surface` | `#FCF9F8` | Default surface |
| `surface-dim` | `#DCD9D9` | Dimmed surface state |
| `surface-bright` | `#FCF9F8` | Bright surface state |
| `surface-container-lowest` | `#FFFFFF` | Pure white — medical/clean feel |
| `surface-container-low` | `#F6F3F2` | Low-elevation panels |
| `surface-container` | `#F0EDED` | Standard card backgrounds |
| `surface-container-high` | `#EAE7E7` | Higher elevation containers |
| `surface-container-highest` | `#E5E2E1` | Highest elevation containers |
| `surface-variant` | `#E5E2E1` | Variant surface |
| `surface-tint` | `#8C4F00` | Tint color for elevated surfaces |

### Text & Content

| Token | Hex | Usage |
|---|---|---|
| `on-background` | `#1C1B1B` | Primary text on background |
| `on-surface` | `#1C1B1B` | Primary text on surface |
| `on-surface-variant` | `#554334` | Secondary/muted text |
| `inverse-surface` | `#313030` | Dark surface for inverse components |
| `inverse-on-surface` | `#F3F0EF` | Text on dark inverse surface |

### Outline & Borders

| Token | Hex | Usage |
|---|---|---|
| `outline` | `#887362` | Standard borders, dividers |
| `outline-variant` | `#DBC2AE` | Subtle borders, low-emphasis dividers |

### Semantic — Error

| Token | Hex | Usage |
|---|---|---|
| `error` | `#BA1A1A` | Error states |
| `on-error` | `#FFFFFF` | Text on error |
| `error-container` | `#FFDAD6` | Error container background |
| `on-error-container` | `#93000A` | Text on error container |

### Fixed / Extended Tokens

| Token | Hex |
|---|---|
| `primary-fixed` | `#FFDCBF` |
| `primary-fixed-dim` | `#FFB874` |
| `on-primary-fixed` | `#2D1600` |
| `on-primary-fixed-variant` | `#6B3B00` |
| `secondary-fixed` | `#FFDBC9` |
| `secondary-fixed-dim` | `#FFB68C` |
| `on-secondary-fixed` | `#321200` |
| `on-secondary-fixed-variant` | `#753400` |
| `tertiary-fixed` | `#FFDEAD` |
| `tertiary-fixed-dim` | `#F3BE67` |
| `on-tertiary-fixed` | `#281900` |
| `on-tertiary-fixed-variant` | `#604100` |

### Semantic — Health Grade Traffic Light

> These are not token values but **application rules** for the Verdict Stamp component.

| Grade | Color | Usage |
|---|---|---|
| **A / B** | Success Green | Clean, healthy product |
| **C** | Warning Orange | Moderate concern |
| **D / E** | Danger Red (`#BA1A1A`) | High-risk product |

### Ingredient Chip Semantics

| Ingredient Type | Background | Text |
|---|---|---|
| High-risk (Sugar, Palm Oil) | Light red | Dark red |
| Clean / safe | Light saffron | `on-primary-container` |

---

## Typography

PacketPeek uses a **tri-font strategy** to balance character, readability, and data precision.

### Font Families

| Role | Font | Rationale |
|---|---|---|
| **Display / Headlines** | Bricolage Grotesque | Quirky, expressive — makes the app approachable, not clinical |
| **Body / UI** | Plus Jakarta Sans | High x-height — legible on low-end mobile even for ingredient lists |
| **Utility / Data** | JetBrains Mono | Monospaced — allows vertical numeric alignment in nutrition tables |

### Type Scale

| Token | Font Family | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| `display-verdict` | Bricolage Grotesque | **72px** | **800** | `1` | `-0.04em` |
| `headline-lg` | Bricolage Grotesque | **32px** | **700** | `40px` | — |
| `headline-lg-mobile` | Bricolage Grotesque | **24px** | **700** | `32px` | — |
| `headline-md` | Bricolage Grotesque | **20px** | **600** | `28px` | — |
| `body-lg` | Plus Jakarta Sans | **18px** | **500** | `28px` | — |
| `body-md` | Plus Jakarta Sans | **16px** | **400** | `24px` | — |
| `utility-data` | JetBrains Mono | **14px** | **600** | `20px` | `-0.02em` |
| `label-caps` | Plus Jakarta Sans | **12px** | **700** | `16px` | — |

---

## Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `base` | `4px` | Minimum spacing unit |
| `stack-sm` | `8px` | Tight intra-component gaps |
| `stack-md` | `16px` | Standard vertical gap between related cards |
| `stack-lg` | `32px` | Section-level spacing |
| `gutter` | `16px` | Column gutter width |
| `container-margin-mobile` | `16px` | Side margins on mobile |
| `container-margin-desktop` | `120px` | Side margins on desktop |

> **Rhythm rule:** Use an 8px linear scale (4, 8, 16, 24, 32, 48, 64). Always prefer `stack-md` (16px) for vertical gaps between related cards.

---

## Layout & Grid

### Mobile (Default)
- **Columns:** 4-column grid
- **Side margins:** `16px` (`container-margin-mobile`)
- **Gutter:** `16px`
- **Cards:** Full-width
- **Product image:** Occupies top **35%** of the viewport

### Desktop
- **Columns:** 12-column grid
- **Max-width:** `1280px` (centered)
- **Side margins:** `120px` (`container-margin-desktop`)
- **Layout split:** Two-column — Left (Sticky Product Image & Grade) · Right (Scrollable Nutrients & Warnings)

---

## Elevation & Depth

Depth is communicated through **Tonal Layers** combined with **Ambient Shadows**.

| Level | Color / Style | Usage |
|---|---|---|
| **Level 0 — Base** | `#FFFFFF` | App canvas |
| **Level 1 — Cards** | `#FDFCFB` + 1px border `#F1F1F1` | Standard cards, panels |
| **Level 2 — Active/Floating** | Saffron-tinted shadow: `0 10px 25px -5px rgba(255, 149, 5, 0.15)` | Scan FAB, primary action cards |
| **Verdict Stamp** | Inset shadow ("pressed" / ink-stamp effect) | Health grade badge only |

---

## Shape Language

| Element | Border Radius | Token |
|---|---|---|
| **Standard Cards** | `16px` | `rounded-lg` |
| **Buttons** | `24px` | `rounded-xl` (pill) |
| **Verdict Stamp** | Circular / rough-edge | Unique — distinguishes from standard UI |
| **Icons** | Lucide icons, `2px` stroke, rounded joins | — |

### Radius Scale

| Token | Value |
|---|---|
| `rounded-sm` | `0.25rem` (4px) |
| `rounded` (DEFAULT) | `0.5rem` (8px) |
| `rounded-md` | `0.75rem` (12px) |
| `rounded-lg` | `1rem` (16px) |
| `rounded-xl` | `1.5rem` (24px) |
| `rounded-full` | `9999px` |

---

## Components

### Primary Button
- **Size:** Large
- **Background:** `#FF9505` (Deep Saffron)
- **Text:** White, Plus Jakarta Sans Bold
- **Shape:** Pill (`rounded-xl` — 24px)

### Verdict Stamp
- **Size:** `80x80px` (circular or badge-shaped)
- **Position:** Top-right of the product card
- **Grade letter (A-E):** Bricolage Grotesque, `72px`, `display-verdict` token
- **Color logic:** Follows traffic-light semantic (Green / Orange / Red)
- **Effect:** "Pressed" inset shadow — resembles a physical ink stamp

### Ingredient Chips
- **Shape:** `rounded-lg` (16px)
- **High-risk (Sugar, Palm Oil):** Light red background
- **Clean ingredients:** Light saffron background

### Nutrient Table
- **Font:** JetBrains Mono (`utility-data` token)
- **Key values (Calories):** Bold weight
- **Row alternation:** Subtle 4% opacity saffron tint for readability

### Scan FAB
- **Size:** `64px` circular
- **Position:** Floating, bottom-center
- **Background:** Deep Saffron (`#FF9505`)
- **Icon:** Lucide `Scan`

### Risk Indicators
- **Icons:** Lucide `AlertTriangle`, `CheckCircle`, `Info`
- **Placement:** Alongside nutrient headings
- **Purpose:** Instant visual context — no reading required

---

## CSS Custom Properties

```css
:root {
  /* --- Brand Colors --- */
  --color-primary:                  #8C4F00;
  --color-primary-container:        #FF9505;
  --color-on-primary:               #FFFFFF;
  --color-on-primary-container:     #643700;
  --color-inverse-primary:          #FFB874;
  --color-secondary:                #9A4600;
  --color-secondary-container:      #FD8532;
  --color-on-secondary:             #FFFFFF;
  --color-on-secondary-container:   #642B00;
  --color-tertiary:                 #7E5703;
  --color-tertiary-container:       #D9A753;
  --color-on-tertiary:              #FFFFFF;
  --color-on-tertiary-container:    #5A3D00;

  /* --- Surfaces --- */
  --color-background:               #FCF9F8;
  --color-surface:                  #FCF9F8;
  --color-surface-dim:              #DCD9D9;
  --color-surface-bright:           #FCF9F8;
  --color-surface-container-lowest: #FFFFFF;
  --color-surface-container-low:    #F6F3F2;
  --color-surface-container:        #F0EDED;
  --color-surface-container-high:   #EAE7E7;
  --color-surface-container-highest:#E5E2E1;
  --color-surface-variant:          #E5E2E1;
  --color-surface-tint:             #8C4F00;

  /* --- Text --- */
  --color-on-background:            #1C1B1B;
  --color-on-surface:               #1C1B1B;
  --color-on-surface-variant:       #554334;
  --color-inverse-surface:          #313030;
  --color-inverse-on-surface:       #F3F0EF;

  /* --- Borders --- */
  --color-outline:                  #887362;
  --color-outline-variant:          #DBC2AE;

  /* --- Error --- */
  --color-error:                    #BA1A1A;
  --color-on-error:                 #FFFFFF;
  --color-error-container:          #FFDAD6;
  --color-on-error-container:       #93000A;

  /* --- Typography --- */
  --font-display:   'Bricolage Grotesque', sans-serif;
  --font-body:      'Plus Jakarta Sans', sans-serif;
  --font-mono:      'JetBrains Mono', monospace;

  /* --- Spacing --- */
  --space-base:              4px;
  --space-stack-sm:          8px;
  --space-stack-md:          16px;
  --space-stack-lg:          32px;
  --space-gutter:            16px;
  --space-container-mobile:  16px;
  --space-container-desktop: 120px;

  /* --- Border Radius --- */
  --radius-sm:      0.25rem;   /* 4px  */
  --radius-default: 0.5rem;    /* 8px  */
  --radius-md:      0.75rem;   /* 12px */
  --radius-lg:      1rem;      /* 16px — cards */
  --radius-xl:      1.5rem;    /* 24px — buttons */
  --radius-full:    9999px;

  /* --- Elevation Shadows --- */
  --shadow-level-2: 0 10px 25px -5px rgba(255, 149, 5, 0.15);
}
```

---

*Generated from Stitch MCP · `projects/1991849065632301339` · Theme: Saffron Health Pulse*
