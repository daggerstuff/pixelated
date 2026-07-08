# TASTES.md

Aesthetic guidelines and design constraints for Pixelated Empathy.

## 1. Visual & Color System ("Dark Metal")
- **Bg Primary**: `#0a0a0a` (Solid deep space void)
- **Bg Secondary**: `#121212` (Elevated cards and panels)
- **Text Primary**: `#f6f1e8` (Soft warm white, preventing high-contrast eye fatigue)
- **Text Secondary**: `#b0b0b0` (Muted editorial gray)
- **Accent Primary**: `#ff8533` / `#ff7300` (Electric orange for highlights, primary buttons, and link hovers)
- **Accent Secondary**: `#8fb8a2` (Soft clinical green for success and editorial balance)
- **Borders**: Sleek thin lines (`1px solid rgba(255, 255, 255, 0.08)`)
- **Gradients**: Restrained transition from electric orange to soft green for key call-to-actions.

## 2. Typography
- **Monospace Priority**: JetBrains Mono for all code, buttons, interactive labels, badges, and metric displays.
- **Headings**: Outfit (sans) or Fraunces (serif) for high-contrast editorial hierarchy.
- **Body**: Public Sans or Inter (sans-serif) for high readability at smaller scales.

## 3. Structural Constraints (Technical Brutalism)
- **Flat Over Round**: Strict minimal border-radius (Max `4px`).
- **No Heavy Shadows**: Never use soft diffuse box-shadows. Rely on thin border outlines or solid offset shadows.
- **Grid Exposure**: Expose alignment using dotted backgrounds (`radial-gradient`) or thin grid lines.

## 4. Interaction & Motion
- **Micro-Animations**: Hover states must use rapid, subtle translations (`translateY(-1px)`) and fast transitions (`150ms ease-out`).
- **Focus Indicators**: Outline interactive elements explicitly with accent orange (`outline: 2px solid #ff8533; outline-offset: 2px`).
