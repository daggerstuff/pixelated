# Unified Dark Theme - Examples & Integration

This directory contains comprehensive examples demonstrating the unified dark theme system with pnpm package management.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Navigate to examples directory
cd examples

# Install dependencies with pnpm
pnpm install
```

### 2. Serve Demo
```bash
# Start local development server
pnpm dev

# Or directly serve files
pnpm serve
```

### 3. View Demo
Open your browser to `http://localhost:8080/unified-dark-theme-demo.html`

## 📁 File Structure

```
examples/
├── unified-dark-theme-demo.html    # Comprehensive demo showcase
├── package.json                    # pnpm configuration
├── README.md                       # This documentation
└── assets/                         # Optional assets directory
```

## 🎨 Theme Integration

### Option 1: Direct CSS Link
```html
<link rel="stylesheet" href="../src/styles/unified-dark-theme-comprehensive.css">
```

### Option 2: CSS Import
```css
@import '../src/styles/unified-dark-theme-comprehensive.css';
```

### Option 3: Build Tool Integration
```javascript
// Import in your main CSS/JS file
import '../src/styles/unified-dark-theme-comprehensive.css';
```

## 🔧 pnpm Configuration

The `package.json` includes optimized pnpm settings:

```json
{
  "packageManager": "pnpm@10.20.0",
  "pnpm": {
    "overrides": {
      "caniuse-lite": "latest"
    },
    "peerDependencyRules": {
      "ignoreMissing": ["typescript"]
    },
    "onlyBuiltDependencies": ["sharp"]
  }
}
```

## 🎯 Key Features Demonstrated

### 1. **Color System**
- Semantic color hierarchy
- Accessible contrast ratios
- Dark mode optimizations

### 2. **Typography System**
- Fluid responsive scaling
- Multiple font families
- Comprehensive text utilities

### 3. **Component System**
- Buttons with variants and sizes
- Cards with multiple styles
- Forms and inputs
- Navigation components
- Badge system

### 4. **Advanced Surfaces**
- Glass morphism effects
- Gradient surfaces
- Mesh backgrounds
- Elegant overlays

### 5. **Animation System**
- Smooth transitions
- Performance optimized
- Reduced motion support

### 6. **Accessibility**
- Focus management
- Screen reader support
- High contrast mode
- Reduced motion preferences

## 📱 Responsive Design

The theme includes comprehensive responsive utilities:

- Mobile-first approach
- Fluid typography scaling
- Adaptive grid systems
- Touch-friendly interactions

## 🌙 Dark Mode Features

### Automatic Dark Mode Detection
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

## 🎪 Demo Sections

The demo showcases:

1. **Hero Section** - Gradient text and glass cards
2. **Color Palette** - Complete color system
3. **Typography** - All text sizes and styles
4. **Button System** - Variants and sizes
5. **Card System** - Multiple card styles
6. **Input System** - Form controls
7. **Navigation** - Link styles and states
8. **Badge System** - Status indicators
9. **Advanced Surfaces** - Glass, gradient, mesh
10. **Animations** - Utility classes
11. **Status Indicators** - Visual feedback
12. **Utility Classes** - Quick styling
13. **Grid System** - Layout utilities
14. **Complete Integration** - All systems together

## 🚀 Advanced Usage

### Custom Component Creation
```css
.my-custom-component {
  background: var(--color-surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  transition: all var(--transition-normal);
}

.my-custom-component:hover {
  background: var(--color-secondary);
  border-color: var(--accent-emerald);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

### Theme Customization
```css
:root {
  /* Override accent colors */
  --accent-emerald: #00ff88;
  --accent-blue: #0088ff;

  /* Override spacing */
  --space-4: 1.25rem;

  /* Override fonts */
  --font-sans: 'Your Font', sans-serif;
}
```

## 🔍 Browser Testing

Test the demo in:
- Chrome/Chromium
- Firefox
- Safari
- Edge
- Mobile browsers

## 📊 Performance

The theme is optimized for:
- Fast loading with CSS custom properties
- Efficient rendering with GPU-accelerated effects
- Minimal bundle size
- Tree-shaking friendly architecture

## 🛠️ Development Workflow

### Local Development
```bash
# Install dependencies
pnpm install

# Serve files locally
pnpm dev

# Validate theme integration
pnpm test
```

### Production Build
```bash
# Optimize for production
pnpm build

# Preview production build
pnpm preview
```

## 📚 Documentation

For complete documentation, see:
- `../docs/unified-dark-theme-guide.md` - Comprehensive guide
- `../src/styles/unified-dark-theme-comprehensive.css` - Full CSS file
- Demo source code for implementation examples

## 🤝 Contributing

To contribute to the theme or examples:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with pnpm
5. Submit a pull request

## 📄 License

MIT License - Free for personal and commercial use.

## 🙏 Acknowledgments

- Design inspiration from reference sites
- Community feedback and contributions
- Open source font families
- Modern CSS techniques

---

**Happy theming! 🎨✨**