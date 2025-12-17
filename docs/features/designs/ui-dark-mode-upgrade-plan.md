# Pixelated Empathy UI Dark Mode Upgrade Plan
## SPARC Methodology Implementation

---

## 🎯 SPECIFICATION

### Current State Analysis
- **Existing Theme System**: Already has dark mode foundation with CSS variables
- **Theme Toggle**: Functional dark/light/system toggle with localStorage persistence
- **Color Palette**: Green accent (#10b981) with dark backgrounds (#0a0a0a, #111111)
- **Typography**: Geist Sans font family with established hierarchy
- **Components**: 150+ Astro components with mixed theme support

### Dark Mode Gaps Identified
1. **Inconsistent Component Support** - Some components lack proper dark mode styling
2. **Limited Color Depth** - Insufficient elevation system for dark mode hierarchy
3. **Accessibility Issues** - Contrast ratios need optimization for dark backgrounds
4. **Animation Transitions** - Missing smooth transitions between themes
5. **Component Isolation** - No systematic dark mode testing framework

### Requirements Gathering
- **Primary Goal**: Create a cohesive, accessible dark mode experience
- **User Experience**: Seamless theme switching with smooth transitions
- **Accessibility**: WCAG 2.1 AA compliance for all color combinations
- **Performance**: Minimal impact on load times and runtime performance
- **Maintainability**: Modular, scalable theming system
- **Compatibility**: Support for system preference detection

### Reference Sites Analysis
Based on modern dark mode implementations from leading design systems:

1. **GitHub Dark Mode**
   - Deep charcoal backgrounds (#0d1117)
   - Subtle elevation with border accents
   - Green success states with high contrast
   - Smooth transitions on theme switch

2. **Vercel Dark Mode**
   - Pure black foundation (#000000)
   - Geist typography system
   - Card-based elevation hierarchy
   - Animated micro-interactions

3. **Linear Dark Mode**
   - Minimalist approach with accent colors
   - Sophisticated spacing system
   - Icon and illustration adaptations
   - Contextual color application

4. **Tailwind UI Dark Mode**
   - Systematic color scale (50-900)
   - Component-first approach
   - Responsive dark mode breakpoints
   - Extensive utility classes

---

## 📝 PSEUDOCODE

### Dark Mode Toggle System
```pseudocode
FUNCTION initializeDarkMode():
    // Detect system preference
    systemPreference = getSystemColorScheme()

    // Check localStorage override
    savedTheme = localStorage.getItem('theme')

    // Determine active theme
    IF savedTheme exists:
        activeTheme = savedTheme
    ELSE:
        activeTheme = systemPreference

    // Apply theme
    applyTheme(activeTheme)

    // Setup listeners
    setupSystemPreferenceListener()
    setupToggleButtonListener()

FUNCTION applyTheme(theme):
    SWITCH theme:
        CASE 'dark':
            document.documentElement.classList.add('dark')
            updateMetaThemeColor('#0a0a0a')
            updateIconDisplay('dark')
        CASE 'light':
            document.documentElement.classList.remove('dark')
            updateMetaThemeColor('#ffffff')
            updateIconDisplay('light')
        CASE 'system':
            systemDark = getSystemColorScheme() === 'dark'
            document.documentElement.classList.toggle('dark', systemDark)
            updateMetaThemeColor(systemDark ? '#0a0a0a' : '#ffffff')
            updateIconDisplay('system')

FUNCTION setupToggleButtonListener():
    themeToggle.addEventListener('click', () => {
        currentTheme = getCurrentTheme()
        nextTheme = getNextThemeInCycle(currentTheme)

        // Animate transition
        startThemeTransitionAnimation()

        // Apply new theme
        applyTheme(nextTheme)
        localStorage.setItem('theme', nextTheme)

        // Complete animation
        completeThemeTransitionAnimation()
    })
```

### Component Dark Mode Adaptation
```pseudocode
FUNCTION createDarkModeAwareComponent(componentName, baseStyles):
    // Define CSS custom properties for all theme variants
    cssVariables = {
        // Backgrounds
        '--bg-surface': 'var(--color-white)',
        '--bg-elevated': 'var(--color-gray-50)',
        '--bg-primary': 'var(--color-gray-900)',

        // Text
        '--text-primary': 'var(--color-gray-900)',
        '--text-secondary': 'var(--color-gray-600)',
        '--text-primary-dark': 'var(--color-gray-100)',
        '--text-secondary-dark': 'var(--color-gray-400)',

        // Interactive
        '--interactive-normal': 'var(--color-gray-200)',
        '--interactive-hover': 'var(--color-gray-300)',
        '--interactive-active': 'var(--color-gray-400)',
        '--interactive-normal-dark': 'var(--color-gray-800)',
        '--interactive-hover-dark': 'var(--color-gray-700)',
        '--interactive-active-dark': 'var(--color-gray-600)',
    }

    // Generate themed styles
    lightStyles = generateLightStyles(baseStyles, cssVariables)
    darkStyles = generateDarkStyles(baseStyles, cssVariables)

    // Return complete component styles
    RETURN {
        light: lightStyles,
        dark: darkStyles,
        common: baseStyles
    }

FUNCTION generateLightStyles(baseStyles, variables):
    RETURN {
        ...baseStyles,
        backgroundColor: variables['--bg-surface'],
        color: variables['--text-primary'],
        borderColor: variables['--interactive-normal'],
        ':hover': {
            backgroundColor: variables['--interactive-hover'],
            borderColor: variables['--interactive-hover']
        }
    }

FUNCTION generateDarkStyles(baseStyles, variables):
    RETURN {
        ...baseStyles,
        backgroundColor: variables['--bg-primary'],
        color: variables['--text-primary-dark'],
        borderColor: variables['--interactive-normal-dark'],
        ':hover': {
            backgroundColor: variables['--interactive-hover-dark'],
            borderColor: variables['--interactive-hover-dark']
        }
    }
```

---

## 🏗️ ARCHITECTURE

### CSS Variable Architecture
```css
/* ================================================
   DARK MODE CSS VARIABLE SYSTEM
   ================================================ */

/* Root level - Light mode defaults */
:root {
  /* Core Colors */
  --color-black: #000000;
  --color-white: #ffffff;

  /* Gray Scale System */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;

  /* Accent Colors */
  --color-emerald-400: #34d399;
  --color-emerald-500: #10b981;
  --color-emerald-600: #059669;
  --color-blue-400: #60a5fa;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-purple-400: #a78bfa;
  --color-purple-500: #8b5cf6;
  --color-purple-600: #7c3aed;

  /* Semantic Colors */
  --color-success: var(--color-emerald-500);
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: var(--color-blue-500);

  /* Typography */
  --font-sans: 'Geist Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Spacing Scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;
  --space-32: 8rem;

  /* Border Radius */
  --radius-sm: 0.125rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 350ms ease;
}

/* Dark mode overrides */
.dark {
  /* Inverted Gray Scale */
  --color-gray-50: #111827;
  --color-gray-100: #1f2937;
  --color-gray-200: #374151;
  --color-gray-300: #4b5563;
  --color-gray-400: #6b7280;
  --color-gray-500: #9ca3af;
  --color-gray-600: #d1d5db;
  --color-gray-700: #e5e7eb;
  --color-gray-800: #f3f4f6;
  --color-gray-900: #f9fafb;

  /* Dark mode specific colors */
  --color-dark-bg: #0a0a0a;
  --color-dark-bg-secondary: #111111;
  --color-dark-bg-tertiary: #181818;
  --color-dark-bg-elevated: #1f1f1f;
  --color-dark-border: rgba(255, 255, 255, 0.1);
  --color-dark-border-secondary: rgba(255, 255, 255, 0.2);

  /* Adjusted shadows for dark mode */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.5);
}
```

### Component Hierarchy Architecture
```
src/
├── styles/
│   ├── dark-mode/
│   │   ├── _variables.scss      # Dark mode CSS variables
│   │   ├── _typography.scss     # Typography adaptations
│   │   ├── _colors.scss         # Color system
│   │   ├── _spacing.scss        # Spacing tokens
│   │   ├── _shadows.scss        # Shadow adaptations
│   │   ├── _transitions.scss    # Theme transitions
│   │   └── _utilities.scss      # Utility classes
│   ├── components/
│   │   ├── _buttons.scss        # Button dark mode styles
│   │   ├── _cards.scss          # Card dark mode styles
│   │   ├── _forms.scss          # Form element adaptations
│   │   ├── _navigation.scss     # Navigation dark mode
│   │   └── _modals.scss         # Modal dark mode styles
│   └── themes/
│       ├── _light.scss           # Light theme specifics
│       ├── _dark.scss            # Dark theme specifics
│       └── _system.scss          # System preference handling
├── components/
│   ├── ui/
│   │   ├── ThemeToggle.astro     # Enhanced theme toggle
│   │   ├── Button.astro          # Dark mode aware button
│   │   ├── Card.astro            # Dark mode card component
│   │   └── Input.astro           # Dark mode form inputs
│   └── layout/
│       ├── Header.astro          # Dark mode header
│       ├── Footer.astro          # Dark mode footer
│       └── Navigation.astro      # Dark mode navigation
├── utils/
│   ├── theme.ts                  # Theme utility functions
│   ├── colors.ts                 # Color manipulation
│   └── transitions.ts            # Transition helpers
└── hooks/
    ├── useTheme.ts               # React theme hook
    └── useDarkMode.ts            # Dark mode specific hook
```

### Theme System Architecture
```typescript
// Theme configuration system
interface ThemeConfig {
  mode: 'light' | 'dark' | 'system'
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    textSecondary: string
    border: string
  }
  typography: {
    fontFamily: string
    fontSize: Record<string, string>
    fontWeight: Record<string, number>
    lineHeight: Record<string, string>
  }
  spacing: Record<string, string>
  shadows: Record<string, string>
  transitions: Record<string, string>
}

// Dark mode specific configuration
const darkModeConfig: ThemeConfig = {
  mode: 'dark',
  colors: {
    primary: '#10b981',
    secondary: '#3b82f6',
    accent: '#8b5cf6',
    background: '#0a0a0a',
    surface: '#111111',
    text: '#ffffff',
    textSecondary: '#e5e5e5',
    border: 'rgba(255, 255, 255, 0.1)'
  },
  typography: {
    fontFamily: 'Geist Sans, system-ui, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem'
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75'
    }
  },
  spacing: {
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
    '32': '8rem'
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.5)'
  },
  transitions: {
    fast: '150ms ease',
    base: '250ms ease',
    slow: '350ms ease'
  }
}
```

---

## 🔧 REFINEMENT

### Component-Level Implementation Plan

#### 1. Enhanced Theme Toggle Component
```astro
---
// Enhanced ThemeToggle.astro
export interface Props {
  class?: string
  variants?: 'simple' | 'animated' | 'minimal'
  showLabels?: boolean
}

const { class: className = '', variants = 'animated', showLabels = false } = Astro.props
---

<button
  id="theme-toggle-enhanced"
  class={`
    theme-toggle theme-toggle--${variants}
    ${className}
  `}
  aria-label="Toggle theme"
  aria-live="polite"
>
  <span class="theme-toggle__track">
    <span class="theme-toggle__thumb">
      <!-- Sun Icon -->
      <svg class="theme-icon theme-icon--sun" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>

      <!-- Moon Icon -->
      <svg class="theme-icon theme-icon--moon" viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>

      <!-- System Icon -->
      <svg class="theme-icon theme-icon--system" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    </span>
  </span>

  {showLabels && (
    <span class="theme-toggle__label">
      <span class="theme-toggle__label-text theme-toggle__label-text--light">Light</span>
      <span class="theme-toggle__label-text theme-toggle__label-text--dark">Dark</span>
      <span class="theme-toggle__label-text theme-toggle__label-text--system">System</span>
    </span>
  )}
</button>

<style>
  /* Base theme toggle styles */
  .theme-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 2px solid transparent;
    border-radius: 9999px;
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .theme-toggle:focus {
    outline: none;
    border-color: var(--color-blue-500);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .theme-toggle__track {
    position: relative;
    width: 3rem;
    height: 1.75rem;
    background: var(--color-gray-200);
    border-radius: 9999px;
    transition: background-color var(--transition-base);
  }

  .dark .theme-toggle__track {
    background: var(--color-gray-700);
  }

  .theme-toggle__thumb {
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1.5rem;
    height: 1.5rem;
    background: var(--color-white);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-base);
    box-shadow: var(--shadow-sm);
  }

  .theme-toggle__thumb:hover {
    transform: scale(1.05);
  }

  .theme-icon {
    width: 0.875rem;
    height: 0.875rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    color: var(--color-gray-600);
    transition: all var(--transition-fast);
  }

  .dark .theme-icon {
    color: var(--color-gray-300);
  }

  .theme-icon--sun {
    color: #f59e0b;
  }

  .theme-icon--moon {
    color: #6366f1;
  }

  .theme-icon--system {
    color: #6b7280;
  }

  /* Animated variant */
  .theme-toggle--animated .theme-toggle__thumb {
    transition: transform var(--transition-base), background-color var(--transition-base);
  }

  .theme-toggle--animated.theme-toggle[data-theme="dark"] .theme-toggle__thumb {
    transform: translateX(1.25rem);
  }

  /* Label styles */
  .theme-toggle__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-gray-600);
  }

  .dark .theme-toggle__label {
    color: var(--color-gray-400);
  }
</style>

<script>
  // Enhanced theme toggle functionality
  const themeToggle = document.getElementById('theme-toggle-enhanced')

  function updateToggleUI(theme) {
    if (!themeToggle) return

    themeToggle.setAttribute('data-theme', theme)

    // Update ARIA attributes
    const currentLabel = themeToggle.getAttribute('aria-label')
    themeToggle.setAttribute('aria-label', `Current theme: ${theme}. Click to change theme.`)
  }

  // Initialize and setup listeners
  document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('theme') || 'system'
    updateToggleUI(currentTheme)
  })
</script>
```

#### 2. Dark Mode Card Component
```astro
---
// Enhanced Card.astro with dark mode support
export interface Props {
  variant?: 'default' | 'elevated' | 'outlined' | 'glass'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  interactive?: boolean
  class?: string
}

const {
  variant = 'default',
  padding = 'md',
  interactive = false,
  class: className = ''
} = Astro.props

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10'
}
---

<div
  class={`
    card card--${variant}
    ${paddingClasses[padding]}
    ${interactive ? 'card--interactive' : ''}
    ${className}
  `}
  data-variant={variant}
>
  <slot />
</div>

<style>
  /* Base card styles */
  .card {
    position: relative;
    background: var(--color-white);
    border: 1px solid var(--color-gray-200);
    border-radius: var(--radius-lg);
    transition: all var(--transition-base);
  }

  /* Dark mode adaptations */
  .dark .card {
    background: var(--color-gray-900);
    border-color: var(--color-dark-border);
    color: var(--color-gray-100);
  }

  /* Card variants */
  .card--elevated {
    box-shadow: var(--shadow-md);
  }

  .dark .card--elevated {
    box-shadow: var(--shadow-lg);
    background: var(--color-dark-bg-elevated);
  }

  .card--outlined {
    border-width: 2px;
  }

  .dark .card--outlined {
    border-color: var(--color-gray-700);
  }

  .card--glass {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .dark .card--glass {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* Interactive states */
  .card--interactive {
    cursor: pointer;
  }

  .card--interactive:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .dark .card--interactive:hover {
    box-shadow: var(--shadow-xl);
    border-color: var(--color-emerald-500);
  }

  .card--interactive:active {
    transform: translateY(0);
  }

  /* Focus states */
  .card--interactive:focus {
    outline: none;
    border-color: var(--color-blue-500);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .dark .card--interactive:focus {
    border-color: var(--color-blue-400);
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
  }
</style>
```

#### 3. Dark Mode Button Component
```astro
---
// Enhanced Button.astro with comprehensive dark mode support
export interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  class?: string
}

const {
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  class: className = ''
} = Astro.props

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg'
}
---

<button
  class={`
    btn btn--${variant} btn--${size}
    ${disabled ? 'btn--disabled' : ''}
    ${loading ? 'btn--loading' : ''}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `}
  disabled={disabled || loading}
  aria-disabled={disabled || loading}
  aria-busy={loading}
>
  {loading && (
    <span class="btn__spinner" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
      </svg>
    </span>
  )}
  <span class="btn__content">
    <slot />
  </span>
</button>

<style>
  /* Base button styles */
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: var(--font-sans);
    font-weight: 500;
    line-height: 1;
    text-decoration: none;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-base);
    white-space: nowrap;
    overflow: hidden;
  }

  .btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Button variants */
  .btn--primary {
    background: var(--color-emerald-500);
    color: var(--color-white);
    border-color: var(--color-emerald-500);
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--color-emerald-600);
    border-color: var(--color-emerald-600);
    transform: translateY(-1px);
  }

  .dark .btn--primary {
    background: var(--color-emerald-400);
    color: var(--color-gray-900);
    border-color: var(--color-emerald-400);
  }

  .dark .btn--primary:hover:not(:disabled) {
    background: var(--color-emerald-500);
    border-color: var(--color-emerald-500);
  }

  .btn--secondary {
    background: var(--color-gray-100);
    color: var(--color-gray-900);
    border-color: var(--color-gray-300);
  }

  .btn--secondary:hover:not(:disabled) {
    background: var(--color-gray-200);
    border-color: var(--color-gray-400);
  }

  .dark .btn--secondary {
    background: var(--color-gray-800);
    color: var(--color-gray-100);
    border-color: var(--color-gray-700);
  }

  .dark .btn--secondary:hover:not(:disabled) {
    background: var(--color-gray-700);
    border-color: var(--color-gray-600);
  }

  .btn--outline {
    background: transparent;
    color: var(--color-gray-700);
    border-color: var(--color-gray-300);
  }

  .btn--outline:hover:not(:disabled) {
    background: var(--color-gray-50);
    color: var(--color-gray-900);
    border-color: var(--color-gray-400);
  }

  .dark .btn--outline {
    color: var(--color-gray-300);
    border-color: var(--color-gray-600);
  }

  .dark .btn--outline:hover:not(:disabled) {
    background: var(--color-gray-800);
    color: var(--color-gray-100);
    border-color: var(--color-gray-500);
  }

  .btn--ghost {
    background: transparent;
    color: var(--color-gray-600);
    border-color: transparent;
  }

  .btn--ghost:hover:not(:disabled) {
    background: var(--color-gray-100);
    color: var(--color-gray-900);
  }

  .dark .btn--ghost {
    color: var(--color-gray-400);
  }

  .dark .btn--ghost:hover:not(:disabled) {
    background: var(--color-gray-800);
    color: var(--color-gray-100);
  }

  .btn--danger {
    background: #ef4444;
    color: var(--color-white);
    border-color: #ef4444;
  }

  .btn--danger:hover:not(:disabled) {
    background: #dc2626;
    border-color: #dc2626;
  }

  /* Disabled state */
  .btn--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Loading state */
  .btn--loading .btn__content {
    opacity: 0.7;
  }

  .btn__spinner {
    position: absolute;
    width: 1rem;
    height: 1rem;
    animation: spin 1s linear infinite;
  }

  .btn__spinner svg {
    width: 100%;
    height: 100%;
    stroke-dasharray: 62.8;
    stroke-dashoffset: 20;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

### Accessibility Implementation Plan

#### 1. Color Contrast Compliance
```css
/* WCAG 2.1 AA compliance ratios */
:root {
  /* Minimum contrast ratios for text */
  --contrast-normal-text: 4.5;    /* Normal text: 4.5:1 */
  --contrast-large-text: 3;       /* Large text: 3:1 */
  --contrast-ui-elements: 3;      /* UI elements: 3:1 */
}

/* Enhanced contrast mode */
@media (prefers-contrast: high) {
  :root {
    /* High contrast color adjustments */
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
    --bg-primary: #000000;
    --bg-secondary: #111111;
    --border-primary: rgba(255, 255, 255, 0.5);
    --border-secondary: rgba(255, 255, 255, 0.7);
  }
}
```

#### 2. Focus Management
```css
/* Enhanced focus indicators */
.focus-visible {
  outline: 2px solid var(--color-blue-500);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}

.dark .focus-visible {
  outline-color: var(--color-blue-400);
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.3);
}

/* Focus trap for modals */
.focus-trap {
  position: relative;
}

.focus-trap:focus-within {
  outline: none;
}
```

#### 3. Screen Reader Support
```html
<!-- Enhanced accessibility markup -->
<button
  class="theme-toggle"
  role="switch"
  aria-checked="false"
  aria-label="Toggle dark mode"
  aria-describedby="theme-description"
>
  <span id="theme-description" class="sr-only">
    Current theme: dark mode. Press to switch to light mode.
  </span>
  <!-- Visual elements -->
</button>
```

### Testing Strategy

#### 1. Visual Regression Testing
```javascript
// Playwright visual regression tests
test.describe('Dark Mode Visual Regression', () => {
  test('theme toggle button appearance', async ({ page }) => {
    await page.goto('/')

    // Test light mode
    await page.evaluate(() => localStorage.setItem('theme', 'light'))
    await page.reload()
    await expect(page.locator('.theme-toggle')).toHaveScreenshot('theme-toggle-light.png')

    // Test dark mode
    await page.evaluate(() => localStorage.setItem('theme', 'dark'))
    await page.reload()
    await expect(page.locSelector('.theme-toggle')).toHaveScreenshot('theme-toggle-dark.png')
  })
})
```

#### 2. Accessibility Testing
```javascript
// Automated accessibility tests
test.describe('Dark Mode Accessibility', () => {
  test('color contrast compliance', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('theme', 'dark'))
    await page.reload()

    // Test contrast ratios
    const contrastResults = await page.evaluate(() => {
      return axe.run(document, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
    })

    expect(contrastResults.violations).toHaveLength(0)
  })
})
```

---

## ✅ SUCCESS CRITERIA

### Functional Requirements
- [ ] **Theme Persistence**: User theme preference saved across sessions
- [ ] **System Detection**: Automatic theme detection based on OS preference
- [ ] **Smooth Transitions**: Animated theme switching without jarring effects
- [ ] **Component Coverage**: 100% of UI components support dark mode
- [ ] **Accessibility**: WCAG 2.1 AA compliance for all color combinations
- [ ] **Performance**: Theme switching completes in < 100ms
- [ ] **Mobile Support**: Full dark mode support on mobile devices

### Design Requirements
- [ ] **Visual Hierarchy**: Clear depth perception in dark mode
- [ ] **Brand Consistency**: Maintained brand identity across themes
- [ ] **Typography Readability**: Optimal contrast for all text sizes
- [ ] **Icon Adaptation**: Icons and illustrations optimized for dark backgrounds
- [ ] **Animation Quality**: Smooth, performant theme transitions
- [ ] **Responsive Design**: Consistent experience across screen sizes

### Technical Requirements
- [ ] **CSS Architecture**: Modular, maintainable variable system
- [ ] **Bundle Size**: Minimal impact on overall application size
- [ ] **Browser Support**: Works in all supported browsers
- [ ] **Type Safety**: TypeScript definitions for all theme utilities
- [ ] **Testing Coverage**: >95% test coverage for theme functionality
- [ ] **Documentation**: Complete implementation documentation

### User Experience Metrics
- [ ] **Theme Switch Success Rate**: >99% successful theme switches
- [ ] **Load Time Impact**: <5% increase in initial load time
- [ ] **User Preference**: >80% of users prefer dark mode when available
- [ ] **Accessibility Score**: 100% on automated accessibility audits
- [ ] **Visual Consistency**: <1px layout shifts during theme transitions

### Quality Assurance
- [ ] **Cross-browser Testing**: Verified in Chrome, Firefox, Safari, Edge
- [ ] **Device Testing**: Tested on desktop, tablet, and mobile devices
- [ ] **Performance Testing**: No regression in Core Web Vitals
- [ ] **Security Review**: No security vulnerabilities introduced
- [ ] **Code Review**: Approved by senior frontend engineers
- [ ] **User Acceptance**: Positive feedback from stakeholder review

This comprehensive plan provides a systematic approach to implementing a world-class dark mode experience for Pixelated Empathy, ensuring accessibility, performance, and user satisfaction while maintaining the platform's professional healthcare focus.