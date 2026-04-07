# Design System: Technical-Humanist (Final)

## 📁 Canonical CSS Files

The following files are the **source of truth** for design tokens:
- `src/styles/variables.css` - Core design tokens (colors, spacing, animation)
- `src/styles/fonts.css` - Typography definitions (Berkeley Mono)
- `src/styles/design-system.css` - Component DNA and utility classes
- `src/styles/main.css` - Entry point (imports the above)

**Alternative Layouts** (different design systems for specific purposes):
- `BrutalistLayout.astro` → `brutalist-minimal.css` (Outfit/Geist Sans fonts)
- `AdminLayout.astro` → `enhanced-theme.css` (admin dashboard styling)
- `ResearchLayout.astro` → `research.css` (research pages)

> ⚠️ Do NOT modify alternative CSS files unless intentionally changing those layouts.

## 🏛 Architecture: The Monospace Core
Our interface is a refined, terminal-native experience that balances technical precision with high-end aesthetic warmth. It is **Monospace-First** and **Grid-Bound**.

### 🔳 The Canvas (Opencode.ai + Mizu)
- **Primary Surface**: `#201d1d` (Warm Near-Black) with a subtle **0.02 opacity noise overlay** for tactile grain.
- **Primary Text**: `#fdfcfc` (Warm Off-White).
- **Structural Dividers**: Dotted line patterns (1px width, 4px gap) using `rgba(253, 252, 252, 0.1)`.
- **Container**: Max content width at **880px**. Fluid but centered.

### 🌑 Depth: Glass & Grain
- **Elevation**: We prioritize **Backdrop-Blur** over shadows.
  - **Cards & Modals**: `rgba(48, 44, 44, 0.6)` background with `blur(12px)`.
  - **Borders**: `rgba(253, 252, 252, 0.08)` hairline borders.
- **Texture**: Subtle background grain textures and pixelated gradients for "Glow" effects.

### 🖋 Typography: Precision & Command
- **Primary Face**: **Berkeley Mono** (Universal).
- **Heading 1**: 42px (Extended), Weight 700, Line-height 1.4. Large, futurist, and commanding.
- **Interface**: 16px, Weight 510 (Linear influence) for tactical clarity.
- **Emphasis**: Use **Upper-case + 2px Letter-spacing** for metadata and secondary labels.

## 🎨 Palette & Accents
- **Core Accents**:
  - **Primary**: `#FF6B00` (Vivid Mizu Orange) — Used for high-impact CTAs and critical status.
  - **Secondary**: `#007aff` (System Blue) — For standard interactivity.
- **Semantic States**:
  - **Success**: `#30d158` (System Green)
  - **Warning**: `#ff9f0a` (System Orange)
  - **Danger**: `#ff3b30` (System Red)

## 🧩 Component DNA
- **Buttons**: Sharp **4px radius**. High-contrast orange or dark fill. 
- **Inputs**: Generous **20px padding** with **6px radius** (Opencode Influence).
- **Navigation**: Underlined links and dotted-bottom tab indicators.

## 🤖 Agent Execution Guide
This document is declarative. When generating UI:
1.  **Prioritize Whitespace**: Large vertical gaps (64px-120px) between sections.
2.  **No Shadows**: Use background-color shifts or backdrop blurs to define layers.
3.  **Dotted Dividers**: Use `border-style: dotted` for structural separation.
4.  **Monospace Only**: Never mix sans-serif or serif fonts unless explicitly noted.
