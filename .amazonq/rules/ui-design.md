# Optimized UI/UX Design Guidelines for Code Implementation

## Core Design Principles

### Visual Hierarchy & Design System

```tsx
// Design token implementation
const tokens = {
	colors: {
		primary: "#0070f3",
		secondary: "#ff4081",
		neutral: {
			100: "#f5f5f5",
			500: "#737373",
			900: "#171717"
		}
	},
	spacing: {
		xs: "0.25rem",
		sm: "0.5rem",
		md: "1rem",
		lg: "1.5rem",
		xl: "2rem"
	},
	typography: {
		fontSizes: {
			xs: "0.75rem",
			sm: "0.875rem",
			md: "1rem",
			lg: "1.25rem",
			xl: "1.5rem"
		}
	}
};
```

### Component Architecture

- Build atomic design system (atoms → molecules → organisms → templates → pages)
- Extract reusable components with clear interfaces
- Use composition over inheritance

```tsx
// ❌ Poor component design
function Button({ primary, size, text, onClick, disabled, icon }) {
	// Too many props, mixed concerns
}

// ✅ Better component design
function Button({
									variant = "primary",
									size = "md",
									children,
									leftIcon,
									rightIcon,
									...props
								}) {
	return (
		<button
			className={`btn btn-${variant} btn-${size}`}
			{...props}
		>
			{leftIcon && <span className="mr-2">{leftIcon}</span>}
			{children}
			{rightIcon && <span className="ml-2">{rightIcon}</span>}
		</button>
	);
}
```

## Accessibility Implementation (WCAG AA)

### Semantic HTML

```tsx
// ❌ Non-semantic markup
<div onClick={handleClick} tabIndex={0}>Click me</div>

// ✅ Semantic and accessible
<button
	onClick={handleClick}
	aria-label="Save document"
>
	<svg aria-hidden="true">...</svg>
	Save
</button>
```

### Focus Management

```tsx
// Trap focus in modal dialogs
useEffect(() => {
	const focusableElements = modalRef.current.querySelectorAll(
		'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
	);
	const firstElement = focusableElements[0];
	const lastElement = focusableElements[focusableElements.length - 1];

	// Implement focus trap
	function handleTabKey(e) {
		if (e.key === 'Tab') {
			if (e.shiftKey) { /* handle shift+tab */
			} else { /* handle tab */
			}
		}
	}

	document.addEventListener('keydown', handleTabKey);
	return () => document.removeEventListener('keydown', handleTabKey);
}, [isOpen]);
```

### Color & Contrast

- Maintain minimum contrast ratios: 4.5:1 for normal text, 3:1 for large text
- Never rely solely on color to convey information
- Provide visible focus indicators

## Responsive Implementation

### Responsive Layout Patterns

```tsx
// Mobile-first with CSS-in-JS
const Container = styled.div`
  padding: 1rem;

  @media (min-width: 640px) {
    padding: 1.5rem;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
`;

// Mobile-first with Tailwind
<div className="p-4 sm:p-6 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-6">
	{/* Content */}
</div>
```

### Responsive Images

```tsx
<picture>
	<source
		srcSet="/images/hero-mobile.webp"
		media="(max-width: 640px)"
		type="image/webp"
	/>
	<source
		srcSet="/images/hero-desktop.webp"
		media="(min-width: 641px)"
		type="image/webp"
	/>
	<img
		src="/images/hero-fallback.jpg"
		alt="Hero description"
		loading="lazy"
		width="1200"
		height="600"
		className="w-full h-auto object-cover"
	/>
</picture>
```

## Performance-Optimized Components

### Code Splitting & Lazy Loading

```tsx
// Lazy load components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
	return (
		<Suspense fallback={<Loader />}>
			<HeavyComponent />
		</Suspense>
	);
}

// Image loading optimization
function LazyImage({ src, alt, ...props }) {
	return (
		<img
			src={src}
			alt={alt}
			loading="lazy"
			decoding="async"
			onLoad={(e) => e.target.classList.add('loaded')}
			className="transition-opacity opacity-0 duration-300"
			{...props}
		/>
	);
}
```

### Animation Performance

```tsx
// Optimize animations for 60fps
const optimizedAnimation = {
	// Use transform and opacity (GPU-accelerated)
	exit: { opacity: 0, transform: 'translateY(20px)' },
	enter: { opacity: 1, transform: 'translateY(0px)' },

	// Avoid animating layout properties
	// ❌ Bad: { width: '100%', height: '200px' }
};
```

## State Management & User Feedback

### Loading States

```tsx
function SubmitButton({ isLoading, children }) {
	return (
		<button
			disabled={isLoading}
			className={`btn ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
		>
			{isLoading ? (
				<>
					<Spinner size="sm" className="mr-2" />
					Processing...
				</>
			) : children}
		</button>
	);
}
```

### Error Handling

```tsx
function FormField({ label, error, ...props }) {
	const id = useId();
	const errorId = `${id}-error`;

	return (
		<div className="form-field">
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				aria-invalid={!!error}
				aria-describedby={error ? errorId : undefined}
				className={error ? 'border-red-500' : 'border-gray-300'}
				{...props}
			/>
			{error && (
				<p id={errorId} className="text-red-500 text-sm mt-1">
					{error}
				</p>
			)}
		</div>
	);
}
```

## Design System Implementation

### Theme Provider

```tsx
function ThemeProvider({ children, theme = 'dark' }) {
	// Apply theme CSS variables at the root
	useEffect(() => {
		const root = document.documentElement;
		const tokens = themes[theme];

		Object.entries(tokens).forEach(([key, value]) => {
			root.style.setProperty(`--${key}`, value);
		});
	}, [theme]);

	return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
}
```

### Component Variants Pattern

```tsx
const variants = {
	primary: 'bg-blue-600 hover:bg-blue-700 text-white',
	secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
	danger: 'bg-red-600 hover:bg-red-700 text-white',
};

const sizes = {
	sm: 'text-sm px-2 py-1',
	md: 'text-base px-4 py-2',
	lg: 'text-lg px-6 py-3',
};

function Button({ variant = 'primary', size = 'md', ...props }) {
	const variantClasses = variants[variant];
	const sizeClasses = sizes[size];

	return (
		<button
			className={`rounded font-medium transition-colors ${variantClasses} ${sizeClasses}`}
			{...props}
		/>
	);
}
```

## Testing & Validation

### Accessibility Testing

```tsx
// Jest + Testing Library example
test('button is accessible', async () => {
	const { getByRole } = render(<Button>Click me</Button>);
	const button = getByRole('button', { name: /click me/i });

	// Verify it's focusable
	userEvent.tab();
	expect(button).toHaveFocus();

	// Verify keyboard activation
	userEvent.keyboard('{enter}');
	expect(mockHandler).toHaveBeenCalled();
});
```

### Responsive Testing

```tsx
// Playwright example for responsive testing
test('layout is responsive', async ({ page }) => {
	// Test mobile viewport
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/dashboard');
	await expect(page.locator('nav')).toHaveClass(/mobile-menu/);

	// Test desktop viewport
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect(page.locator('nav')).toHaveClass(/desktop-menu/);
});
```

## Framework-Specific Patterns

### React Best Practices

- Use functional components with hooks
- Optimize rerenders with useMemo, useCallback, and memo
- Implement compound components for complex UIs

### Next.js Patterns

- Leverage Image and Link components for performance
- Use server components for static content
- Implement ISR for dynamic but cacheable content

### Vue Composition API

- Use defineProps and defineEmits for component interfaces
- Leverage computed properties for derived state
- Implement provide/inject for deep component trees

## Anti-Patterns to Avoid

- Avoid prop drilling beyond 2-3 levels (use context or state management)
- Don't mix controlled and uncontrolled component patterns
- Avoid browser layout thrashing with batched DOM operations
- Don't reinvent complex UI components (accessibility is hard)
- Never use !important in CSS without strong justification