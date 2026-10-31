---
name: Obsidian Capital
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#46fa9c'
  on-secondary: '#00391d'
  secondary-container: '#04dd83'
  on-secondary-container: '#005b33'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff7f8b'
  on-tertiary-container: '#7d0023'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#59ffa4'
  secondary-fixed-dim: '#1ce388'
  on-secondary-fixed: '#00210f'
  on-secondary-fixed-variant: '#00522d'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  financial-xl:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.03em
  financial-xl-mobile:
    fontFamily: JetBrains Mono
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  financial-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.02em
  financial-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system positions itself at the intersection of institutional precision and cutting-edge consumer wealth management. It conveys absolute security, real-time dynamism, and sovereign control over digital and traditional assets. The aesthetic is ultra-modern, technical, and unobtrusive, pairing deep obsidian and slate foundations with high-clarity luminescent accents.

Visual styling combines dark-mode minimalism with refined glassmorphism:
- **Obsidian Dark Foundation**: Deep, near-black slate surfaces eliminate visual fatigue and focus attention strictly on data visualization and portfolio growth.
- **Micro-Illumination**: Vibrant emerald neon and electric cyan accents are deployed surgically to indicate momentum, value shifts, and interaction states without overwhelming the screen.
- **Architectural Precision**: Interfaces leverage hairline structural dividers, backdrop blurs, and strict tabular alignment to evoke executive-grade financial terminals simplified for mobile touchpoints.

## Colors
The palette is engineered specifically for dark interfaces, delivering WCAG AAA contrast ratios on critical financial indicators while retaining a layered atmospheric depth.

### Palette Architecture
- **Canvas & Surface (Neutral Base)**:
  - Base Obsidian: `#0B0F17` (Deepest viewport background)
  - Slate Core: `#111827` (Card and container background base)
  - Elevated Slate: `#1E293B` (Dropdowns, modals, and hover fills)
  - Surface Hairline: `rgba(255, 255, 255, 0.08)` / `#1F2937` (Structural edge boundaries)
- **Primary Accent (Electric Cyan)**: `#06B6D4` / `#3B82F6` (Primary action triggers, selection rings, active tabs, and liquidity sparklines)
- **Secondary / Positive Market Flow (Emerald Neon)**: `#00DC82` / `#10B981` (Profit states, gains, yield indicators, and positive delta values)
- **Tertiary / Drawdown & Loss (Crimson Coral)**: `#F43F5E` / `#EF4444` (Portfolio losses, negative deltas, stop-loss triggers, and destructive confirmations)
- **Text & Foreground Layers**:
  - Primary Text: `#F8FAFC` (Values, titles, active labels)
  - Secondary Text: `#94A3B8` (Data metadata, subtitles, timestamps)
  - Muted Text: `#64748B` (Disabled elements, secondary borders, units)

Always tint background card surfaces subtly when reflecting massive market movements (maximum 4% opacity tint of emerald or coral) to maintain visual hierarchy.

## Typography
Typography is separated strictly between narrative/navigation layers and quantitative financial readouts:

1. **Brand & Headlines (`Plus Jakarta Sans`)**: Delivers geometric confidence, polished curves, and crisp character shapes for section headers and high-level summaries.
2. **Body & Interface Copy (`Inter`)**: Serves as the functional engine for instructions, settings, descriptions, and regular interaction elements.
3. **Quantitative Financial Readouts (`JetBrains Mono`)**: Strict tabular figures ensure that tickers, currency values, trade execution volumes, and percentage deltas never jump or reflow during high-frequency live websocket updates.

All quantitative balance readouts must feature fixed zero-width baseline spacing and explicit decimal alignment.

## Layout & Spacing
The layout follows a mobile-first, strict 4px/8px incremental grid.

- **Mobile Viewports (< 768px)**: 4-column fluid layout with `1rem` outer canvas margins and full-width card modules. Critical trade actions anchor to a bottom sticky safe-area tray.
- **Tablet Viewports (768px – 1024px)**: 8-column layout with `2rem` outer margins. Balance metrics and charts span 8 columns, while order books and order forms split into a balanced 4+4 side-by-side arrangement.
- **Desktop Viewports (> 1024px)**: 12-column layout max-width constrained to `1440px` with `3rem` outer margins. Features a fixed 3-column navigation rail, 6-column interactive chart viewport, and 3-column rapid execution drawer.

## Elevation & Depth
Depth relies on translucent layering, subtle hairline borders, and ambient colored glows rather than heavy drop shadows:

- **Level 0 (Base Canvas)**: Flat `#0B0F17`.
- **Level 1 (Card Containers)**: Semi-transparent `#111827` at 70% opacity, layered over a `16px` backdrop blur (`backdrop-filter: blur(16px)`), bordered with a crisp `1px` solid outline of `rgba(255, 255, 255, 0.08)`.
- **Level 2 (Popovers, Sheets, Flyouts)**: Elevated Slate `#1E293B` at 85% opacity with `24px` backdrop blur, a top-edge highlight of `rgba(255, 255, 255, 0.15)`, and a deep, low-opacity ambient shadow: `0 20px 40px -15px rgba(0, 0, 0, 0.7)`.
- **Dynamic Accent Elevation**: Active primary elements emit a diffuse, low-opacity glow tinted with the respective semantic tone (e.g., cyan primary CTA emits `0 8px 24px -4px rgba(6, 182, 212, 0.35)`; positive profit pills cast `0 4px 12px -2px rgba(0, 220, 130, 0.25)`).

## Shapes
The system relies on modern rounded profiles that soften dense data displays:
- **Small Interactive Targets (Chips, Badges, Pills)**: Full pill geometry (`9999px` / `rounded-full`) to clearly demarcate clickable filters and status chips from structural containers.
- **Form Controls & Inputs**: `0.75rem` (12px) to `1rem` (16px) for comfortable touch boundaries.
- **Primary Data Cards**: `1rem` (16px) on mobile scaling to `1.5rem` (24px) on desktop to frame data neatly without clipping corner content.
- **Modals & Bottom Drawers**: `1.5rem` (24px) rounded top corners for mobile bottom sheets.

## Components

### Buttons
- **Primary Action (Deposit / Buy / Confirm)**: Cyan gradient or solid `#06B6D4` with `#0B0F17` ultra-bold contrast typography. 48px height on mobile for target reachability. Hover state increases cyan luminance with a soft outer glow.
- **Secondary (Inspect / Manage)**: Transparent base, 1px border `rgba(255, 255, 255, 0.12)`, text `#F8FAFC`. Active state transitions fill to `rgba(255, 255, 255, 0.06)`.
- **Direct Trade Execution (Buy/Sell)**: Dedicated Split Buttons. Buy executes in vibrant Emerald (`#00DC82`), Sell executes in Crimson (`#F43F5E`), both featuring solid white or pure deep obsidian text depending on luminance.

### Financial Chips & Status Badges
- **Delta Pill Badge**: JetBrains Mono numbers, uppercase percentage. Positive states use 10% opacity green fill (`rgba(0, 220, 130, 0.1)`), 1px solid green border (`rgba(0, 220, 130, 0.3)`), and `#00DC82` text prefixed with a trending glyph (`▲`). Negative states swap seamlessly to `#F43F5E` (`▼`).
- **Filter Chips**: Pill shape, background `#111827`, border `#1F2937`. When selected, fill turns to `#06B6D4` with black text.

### Cards & Asset Tiles
- Composed of 16px to 24px rounded rectangles with Level 1 glassmorphism (`backdrop-filter: blur(16px)`).
- Interior padding set to `1rem` (mobile) and `1.5rem` (desktop).
- Header houses the asset token icon (32px circular container), symbol name in `Plus Jakarta Sans`, and live sparkline. Value, fiat equivalent, and 24h delta occupy the right edge, set in strict `JetBrains Mono` tabular alignment.

### Input Fields & Numeric Keypads
- **Amount Inputs**: Large display-scale JetBrains Mono numerals with static fiat ticker suffix (`USD`).
- **Field Canvas**: Solid `#111827` inset with 1px border of `rgba(255, 255, 255, 0.08)`. Focus state triggers a clean `1.5px` border glow in `#06B6D4` with no offset ring.

### Lists & Order Book Rows
- Flush edge-to-edge layout with `1px` subtle divider lines (`rgba(255, 255, 255, 0.04)`).
- Dynamic depth visualizations (e.g., depth chart background bars inside bid/ask lists) use 8% opacity horizontal fills of emerald or crimson expanding behind the tabular typography.