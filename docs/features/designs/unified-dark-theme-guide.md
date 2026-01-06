# Unified Dark Theme - Comprehensive Design System

A sophisticated dark theme CSS framework that combines the best elements from brutalist precision, minimalist purity, corporate sleekness, enterprise brevity, and Antfu elegance.

## 🎯 Design Philosophy

This design system synthesizes five distinct aesthetic approaches:

- **Brutalist Precision** (`astromaxx.com`) - Raw, bold, structural elements
- **Minimalist Purity** (`litos.com`) - Clean, uncluttered, essential
- **Corporate Sleekness** (`dato-multilaunch.vercel.app`) - Professional, polished, trustworthy
- **Enterprise Brevity** (`one.ie`) - Efficient, functional, purposeful
- **Antfu Elegance** (`antfu.me`) - Refined, sophisticated, harmonious

## 📦 Installation with pnpm

```bash
# Install the theme (if published as a package)
pnpm add @pixelated/unified-dark-theme

# Or include the CSS file directly in your project
cp src/styles/unified-dark-theme-comprehensive.css your-project/styles/
```

## 🎨 Color System

### Foundation Colors
```css
:root {
  --color-void: #000000;          /* Pure black */
  --color-primary: #0a0a0a;       /* Main background */
  --color-secondary: #111111;     /* Secondary surfaces */
  --color-tertiary: #181818;      /* Tertiary elements */
  --color-elevated: #1f1f1f;      /* Elevated surfaces */
}
```

### Text Hierarchy
```css
--text-primary: #ffffff;       /* Pure white */
--text-secondary: #f8f8f8;     /* Subtle secondary */
--text-tertiary: #e8e8e8;      /* Supporting text */
--text-muted: #b8b8b8;         /* Muted text */
--text-subtle: #8a8a8a;        /* Subtle hints */
--text-disabled: #666666;      /* Disabled state */
```

### Accent Colors
```css
--accent-emerald: #10b981;     /* Primary accent */
--accent-blue: #3b82f6;        /* Secondary accent */
--accent-purple: #8b5cf6;      /* Tertiary accent */
--accent-orange: #f59e0b;      /* Warning accent */
--accent-red: #ef4444;         /* Error accent */
```

## 🔧 Typography System

### Fluid Typography Scale
```css
--text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
--text-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
--text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
--text-lg: clamp(1.125rem, 1.05rem + 0.375vw, 1.25rem);
--text-xl: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);
--text-2xl: clamp(1.5rem, 1.4rem + 0.5vw, 1.875rem);
--text-3xl: clamp(1.875rem, 1.7rem + 0.875vw, 2.25rem);
--text-4xl: clamp(2.25rem, 2rem + 1.25vw, 3rem);
--text-5xl: clamp(3rem, 2.5rem + 2.5vw, 4.5rem);
--text-6xl: clamp(3.75rem, 3rem + 3.75vw, 6rem);
```

### Font Families
```css
--font-sans: 'Geist Sans', 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
--font-display: 'Geist Sans', -apple-system, BlinkMacSystemFont, sans-serif;
```

## 📏 8-Point Grid System

Consistent spacing with 8-point increments:
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-4: 1rem;      /* 16px */
--space-8: 2rem;      /* 32px */
--space-16: 4rem;     /* 64px */
```

## 🧩 Component System

### Buttons
```html
<button class="btn btn-primary">Primary Button</button>
<button class="btn btn-secondary">Secondary Button</button>
<button class="btn btn-ghost">Ghost Button</button>
<button class="btn btn-outline">Outline Button</button>
<button class="btn btn-gradient">Gradient Button</button>

<!-- Sizes -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-lg">Large</button>
<button class="btn btn-primary btn-xl">Extra Large</button>
```

### Cards
```html
<div class="card">Standard Card</div>
<div class="card card--elevated">Elevated Card</div>
<div class="card card--glass">Glass Card</div>
<div class="card card--mesh">Mesh Card</div>
<div class="card card--brutalist">Brutalist Card</div>
<div class="card card--minimal">Minimal Card</div>
<div class="card card--gradient">Gradient Card</div>
```

### Inputs
```html
<input class="input" type="text" placeholder="Standard input">
<input class="input input--large" type="text" placeholder="Large input">
<input class="input input--small" type="text" placeholder="Small input">
<input class="input input--minimal" type="text" placeholder="Minimal input">
```

### Navigation
```html
<nav class="nav">
  <a href="#" class="nav__link">Home</a>
  <a href="#" class="nav__link nav__link--active">About</a>
  <a href="#" class="nav__link">Contact</a>
</nav>
```

### Badges
```html
<span class="badge badge--success">Success</span>
<span class="badge badge--info">Info</span>
<span class="badge badge--warning">Warning</span>
<span class="badge badge--error">Error</span>
<span class="badge badge--neutral">Neutral</span>
```

## 🎭 Advanced Surface Variants

### Glass Surfaces
```html
<div class="glass-card">Glass Card Content</div>
```

### Gradient Surfaces
```html
<div class="gradient-text">Gradient Text</div>
<div class="gradient-text--primary">Primary Gradient Text</div>
<div class="gradient-text--secondary">Secondary Gradient Text</div>
```

### Mesh Backgrounds
```html
<div class="mesh-background">Mesh Background</div>
<div class="mesh-background--2">Alternative Mesh</div>
<div class="mesh-background--3">Third Mesh Variant</div>
```

### Aesthetic Surfaces
```html
<div class="elegant-surface">Elegant Surface</div>
<div class="brutalist-surface">Brutalist Surface</div>
<div class="minimal-surface">Minimal Surface</div>
<div class="corporate-surface">Corporate Surface</div>
```

## 🎨 Gradients & Effects

### Gradient System
```css
--gradient-primary: linear-gradient(135deg, var(--accent-emerald) 0%, var(--accent-emerald-light) 50%, var(--accent-blue) 100%);
--gradient-secondary: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 50%, var(--accent-emerald) 100%);
--gradient-warm: linear-gradient(135deg, var(--accent-orange) 0%, var(--accent-yellow) 50%, var(--accent-emerald) 100%);
--gradient-cool: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-emerald) 50%, var(--accent-purple) 100%);
```

### Mesh Gradients
```css
--mesh-1: radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
         radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
         radial-gradient(circle at 40% 40%, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
```

## 🎯 Animation System

### Keyframe Animations
- `fadeIn` - Smooth opacity transition
- `fadeInUp` - Fade with upward movement
- `slideInLeft` - Slide from left
- `pulse` - Opacity pulsing
- `pulseGlow` - Glowing pulse effect
- `shimmer` - Loading shimmer
- `float` - Floating animation
- `slideUp` - Slide up animation

### Utility Classes
```html
<div class="animate-fade-in">Fade In</div>
<div class="animate-fade-in-up">Fade In Up</div>
<div class="animate-pulse">Pulse</div>
<div class="animate-pulse-glow">Pulse Glow</div>
<div class="animate-float">Float</div>
<div class="animate-slide-up">Slide Up</div>
```

## 🌙 Dark Mode Optimization

### Automatic Dark Mode
```css
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
  }
}
```

### High Contrast Support
```css
@media (prefers-contrast: high) {
  :root {
    --border-primary: rgba(255, 255, 255, 0.2);
    --text-muted: #aaaaaa;
  }
}
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 🏗️ Container System

### Standard Containers
```html
<div class="container">Standard Container</div>
<div class="container container--narrow">Narrow Container</div>
<div class="container container--wide">Wide Container</div>
```

### Section Spacing
```html
<section class="section">Standard Section</section>
<section class="section section--compact">Compact Section</section>
<section class="section section--minimal">Minimal Section</section>
```

## 📊 Status Indicators

### Status Dots
```html
<span class="status-dot status-dot--online"></span>
<span class="status-dot status-dot--warning"></span>
<span class="status-dot status-dot--error"></span>
<span class="status-dot status-dot--offline"></span>
```

### Loading States
```html
<div class="loading-shimmer">Loading...</div>
<div class="loading-skeleton"></div>
```

## 🎪 Utility Classes

### Text Utilities
```html
<div class="text-center">Centered Text</div>
<div class="text-left">Left Aligned</div>
<div class="text-right">Right Aligned</div>

<span class="font-mono">Monospace Font</span>
<span class="font-sans">Sans Serif</span>
<span class="font-display">Display Font</span>
```

### Color Utilities
```html
<span class="text-emerald">Emerald Text</span>
<span class="text-blue">Blue Text</span>
<span class="text-purple">Purple Text</span>
<span class="text-orange">Orange Text</span>
<span class="text-red">Red Text</span>

<div class="bg-emerald">Emerald Background</div>
<div class="bg-blue">Blue Background</div>

<div class="border-emerald">Emerald Border</div>
<div class="border-blue">Blue Border</div>
```

## 🔧 Integration with pnpm

### Package.json Configuration
```json
{
  "name": "your-project",
  "packageManager": "pnpm@10.27.0",
  "dependencies": {
    "@pixelated/unified-dark-theme": "^4.0.0"
  }
}
```

### Build Process Integration
```bash
# Development
pnpm dev

# Build with theme
pnpm build

# Production build
pnpm run build:prod
```

### CSS Import Options
```css
/* Option 1: Import in main CSS */
@import '@pixelated/unified-dark-theme/unified-dark-theme-comprehensive.css';

/* Option 2: Import in JavaScript */
import '@pixelated/unified-dark-theme/unified-dark-theme-comprehensive.css';

/* Option 3: Link in HTML */
<link rel="stylesheet" href="path/to/unified-dark-theme-comprehensive.css">
```

## 🎨 Customization

### Override Variables
```css
:root {
  /* Override accent colors */
  --accent-emerald: #00ff88;
  --accent-blue: #0088ff;

  /* Override spacing */
  --space-4: 1.25rem;

  /* Override typography */
  --font-sans: 'Your Font', sans-serif;
}
```

### Component Customization
```css
/* Custom button variant */
.btn-custom {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
  border: none;
  color: white;
  font-weight: 700;
}

/* Custom card variant */
.card-custom {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}
```

## 📱 Responsive Design

### Mobile Optimizations
```css
@media (max-width: 768px) {
  .grid--2,
  .grid--3,
  .grid--4 {
    grid-template-columns: 1fr;
  }

  .nav {
    gap: var(--space-4);
  }

  .card {
    padding: var(--space-4);
  }
}
```

## 🎯 Best Practices

### 1. Semantic HTML
```html
<article class="card">
  <header class="card-header">
    <h2 class="card-title">Article Title</h2>
    <p class="card-subtitle">Article subtitle</p>
  </header>
  <div class="card-body">
    <p>Article content...</p>
  </div>
  <footer class="card-footer">
    <button class="btn btn-primary">Read More</button>
  </footer>
</article>
```

### 2. Accessibility First
```html
<button class="btn btn-primary" aria-label="Primary action">
  <span aria-hidden="true">→</span>
  Primary Action
</button>
```

### 3. Performance Optimization
```html
<!-- Use utility classes for quick styling -->
<div class="text-center font-mono text-emerald">
  Optimized content
</div>
```

## 🚀 Advanced Features

### Glass Morphism
```html
<div class="glass-card">
  <h3>Glass Card Title</h3>
  <p>Glass card content with blur effect</p>
</div>
```

### Gradient Text Effects
```html
<h1 class="gradient-text--primary">Hero Heading</h1>
<h2 class="gradient-text--secondary">Subheading</h2>
```

### Mesh Backgrounds
```html
<section class="mesh-background">
  <div class="container">
    <h2>Section with Mesh Background</h2>
  </div>
</section>
```

## 🔍 Browser Support

- ✅ Chrome 88+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Edge 88+
- ✅ Mobile browsers with CSS custom properties support

## 📚 Reference Sites Analyzed

1. **astromaxx.com** - Brutalist precision with bold typography
2. **litos.com** - Minimalist purity with clean layouts
3. **dato-multilaunch.vercel.app** - Corporate sleekness with professional polish
4. **one.ie** - Enterprise brevity with efficient design
5. **antfu.me** - Elegant refinement with sophisticated details

## 🤝 Contributing

### Development Setup with pnpm
```bash
# Clone the repository
git clone https://github.com/pixelated/unified-dark-theme.git

# Install dependencies
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build
```

### Code Standards
- Use CSS custom properties for all values
- Follow BEM methodology for class naming
- Maintain accessibility standards
- Test across all supported browsers
- Document all new features

## 📄 License

MIT License - Feel free to use in personal and commercial projects.

## 🙏 Acknowledgments

- Design inspiration from the reference sites
- Typography powered by Geist Sans and Inter Variable
- Color palette optimized for dark mode readability
- Community feedback and contributions

---

**Built with ❤️ for the dark mode community**