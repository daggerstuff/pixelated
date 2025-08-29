# Optimized Shadcn/Tailwind Development Guide

## Core Principles

- **Type Safety**: Use strict TypeScript typing with explicit interfaces and types
- **Component Architecture**: Create modular, reusable components with clear responsibilities
- **Accessibility**: Ensure all UI elements are fully accessible (WCAG AA compliant)
- **Performance**: Optimize for Core Web Vitals with proper code splitting and rendering strategies

## Component Development

### Structure

```tsx
// components/ui/Example.tsx
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { ExampleProps } from "@/types"

export function Example({
													children,
													variant = "default",
													className,
													...props
												}: ExampleProps) {
	// Component logic here

	return (
		<div
			className={cn(
				"base-styles",
				variant === "default" && "variant-specific-styles",
				variant === "secondary" && "secondary-variant-styles",
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}
```

### Shadcn Integration

- Use `cn()` utility for class name merging
- Follow variant pattern with sensible defaults
- Make components extensible via `className` and spread props
- Keep component files under 150 lines

## Tailwind Best Practices

- Use semantic class ordering: layout → spacing → sizing → typography → visual
- Extract common patterns to Tailwind components
- Use consistent spacing scales (rem-based)
- Leverage CSS variables for theming
- Apply mobile-first responsive design

## State Management

- Use React Query for server state
- Employ useReducer for complex local state
- Apply Context API judiciously for shared state
- Consider Zustand for global app state

## Planning Process

1. **Requirements Analysis**: Document exact functionality needed
2. **Component Hierarchy**: Map out component relationships
3. **Data Flow**: Identify state management needs and data sources
4. **UI/UX Considerations**: Note accessibility and responsive requirements
5. **Implementation Plan**: Break down into atomic implementation steps

## Next.js App Router Conventions

- Leverage server components for static content
- Use client components only when interactivity is needed
- Implement proper data fetching with Suspense boundaries
- Follow the route group pattern for organizing complex routes

## Error Handling & Validation

- Implement comprehensive form validation using Zod
- Use error boundaries to prevent cascading failures
- Provide meaningful error messages and recovery options
- Add proper TypeScript error interfaces

## Testing Approach

- Write component tests with React Testing Library
- Test user flows, not implementation details
- Ensure accessibility testing in component tests
- Implement E2E tests for critical paths

## Code Quality Standards

- Maintain consistent file structure and naming conventions
- Document complex logic with meaningful comments
- Abstract reusable logic into custom hooks
- Keep functions pure and focused on single responsibilities

## Animation & Transitions

### Animation Principles

- **Purpose-Driven**: Use animations to enhance UX, not distract
- **Performance-First**: Optimize for 60fps by animating only cheap properties
- **Accessible**: Respect user preferences with `prefers-reduced-motion`
- **Consistent**: Maintain animation timing and easing across the application

### Implementation Patterns

```tsx
// 1. Tailwind classes with transitions
<button
	className="transform transition-all duration-300 ease-in-out hover:scale-105
  active:scale-95 focus:ring-2 focus:ring-offset-2 focus:ring-primary"
>
	Click Me
</button>

// 2. Framer Motion integration
import { motion } from "framer-motion";

const fadeIn = {
	initial: { opacity: 0, y: 20 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -20 },
	transition: { duration: 0.3 }
};

function AnimatedComponent() {
	return (
		<motion.div
			initial="initial"
			animate="animate"
			exit="exit"
			variants={fadeIn}
		>
			Content
		</motion.div>
	);
}

// 3. Reduced-motion support
const reducedMotionVariants = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: { duration: 0.2 }
};

function AccessibleAnimation() {
	const prefersReducedMotion =
		typeof window !== 'undefined'
			? window.matchMedia('(prefers-reduced-motion: reduce)').matches
			: false;

	const variants = prefersReducedMotion ? reducedMotionVariants : fadeIn;

	return <motion.div variants={variants}>Content</motion.div>;
}
```

### Page Transitions

- Use Framer Motion's `AnimatePresence` for route changes:

```tsx
import { AnimatePresence } from "framer-motion";

function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<AnimatePresence mode="wait">
			{children}
		</AnimatePresence>
	);
}
```

## Dark Mode Implementation

### 1. Setup with Tailwind and CSS Variables

```ts
// tailwind.config.js
module.exports = {
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				background: "var(--background)",
				foreground: "var(--foreground)",
				primary: {
					DEFAULT: "var(--primary)",
					foreground: "var(--primary-foreground)",
				},
				// Additional semantic colors...
			},
		},
	},
};
```

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 222.2 84% 4.9%;
        --primary: 221.2 83.2% 53.3%;
        --primary-foreground: 210 40% 98%;
        /* Additional variables... */
    }

    .dark {
        --background: 222.2 84% 4.9%;
        --foreground: 210 40% 98%;
        --primary: 217.2 91.2% 59.8%;
        --primary-foreground: 222.2 47.4% 11.2%;
        /* Additional variables... */
    }
}
```

### 2. Theme Provider

```tsx
// components/theme-provider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

const ThemeProviderContext = createContext<{
	theme: Theme;
	setTheme: (theme: Theme) => void;
}>({
	theme: "system",
	setTheme: () => null,
});

export function ThemeProvider({
																children,
																defaultTheme = "system",
																storageKey = "theme",
																...props
															}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>(defaultTheme);

	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");

		if (theme === "system") {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
				.matches
				? "dark"
				: "light";
			root.classList.add(systemTheme);
			return;
		}

		root.classList.add(theme);
	}, [theme]);

	const value = {
		theme,
		setTheme: (theme: Theme) => {
			localStorage.setItem(storageKey, theme);
			setTheme(theme);
		},
	};

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
};
```

### 3. Theme Switcher Component

```tsx
// components/theme-toggle.tsx
"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => setTheme(theme === "light" ? "dark" : "light")}
			aria-label="Toggle theme"
		>
			{theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
		</Button>
	);
}
```

## Container Queries & Modern Responsive Techniques

### Container Queries

Container queries allow styling elements based on their parent container's size, not just the viewport:

```tsx
// Container query setup in components
<div className="@container">
	<div className="@md:grid @md:grid-cols-2 @lg:grid-cols-3">
		{/* Content */}
	</div>
</div>
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      // Define container query breakpoints
      containerQueryBreakpoints: {
        sm: '480px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}
```

### Advanced Responsive Patterns

1. **Adaptive Layout Patterns**:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
	{/* Responsive grid that scales with viewport */}
</div>

<div className="@container">
	<div className="flex flex-col @md:flex-row @lg:items-center">
		{/* Flex layout that adapts to container size */}
	</div>
</div>
```

2. **Responsive Typography**:

```css
/* globals.css */
@layer base {
    html {
        font-size: clamp(14px, 0.5vw + 13px, 18px);
    }

    h1 {
        font-size: clamp(1.75rem, 4vw + 1rem, 3.5rem);
    }
}
```

3. **Responsive Spacing**:

```tsx
<section className="space-y-4 sm:space-y-6 md:space-y-8 lg:space-y-12">
	{/* Content with breathing room that scales with viewport */}
</section>
```

4. **Feature Queries**:

```css
/* Use modern features with fallbacks */
.modern-layout {
    display: block; /* Fallback */

    @supports (display: grid) {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    }
}
```

## Tailwind Performance Optimization

### Bundle Size Reduction

1. **Content Configuration**:

```js
// tailwind.config.js
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  // This precise targeting prevents including unused styles
}
```

2. **Just-in-Time Mode** (enabled by default in Tailwind CSS v3):

- Only generates the CSS you're actually using
- Results in much smaller CSS files
- Enables arbitrary values like `mt-[37px]`

3. **PurgeCSS Integration**:

```js
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
        '@fullhuman/postcss-purgecss': {
          content: [
            './src/**/*.{js,jsx,ts,tsx}',
            './public/index.html',
          ],
          defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
          safelist: ['html', 'body']
        }
      }
      : {})
  }
}
```

### Component Design Optimization

1. **Style Composition Over Class Repetition**:

```tsx
// Instead of repeating long class strings
function Button({ variant, size, className, ...props }) {
	return (
		<button
			className={cn(
				buttonBaseStyles,
				variantStyles[variant],
				sizeStyles[size],
				className
			)}
			{...props}
		/>
	);
}

// Define styles centrally
const buttonBaseStyles = "font-medium rounded focus:outline-none focus:ring-2";
const variantStyles = {
	primary: "bg-blue-600 text-white hover:bg-blue-700",
	secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
};
const sizeStyles = {
	sm: "text-sm px-3 py-1",
	md: "text-base px-4 py-2",
	lg: "text-lg px-6 py-3",
};
```

2. **Extracting Component Classes**:

```js
// tailwind.config.js
module.exports = {
  theme: {
    // ...
  },
  plugins: [],
  corePlugins: {
    preflight: true,
  },
  // Add your own component classes
  extend: {
    '.btn': {
      '@apply px-4 py-2 rounded font-medium transition-colors': {},
      '&-primary': {
        '@apply bg-blue-600 text-white hover:bg-blue-700': {},
      },
    },
  },
}
```

### Build-time Optimization

1. **Split CSS by Routes**:

```js
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
  },
}
```

2. **Minimize Tailwind Plugins**:

- Only include plugins you actually use
- Consider impact of each plugin on bundle size

3. **Disable Unused Core Plugins**:

```js
// tailwind.config.js
module.exports = {
  // ...
  corePlugins: {
    float: false, // Disable if you don't use float
    clear: false, // Disable if you don't use clear
    skew: false, // Disable if you don't use skew
    // ... other unused core plugins
  }
}
```