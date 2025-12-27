---
applyTo: '**/*.tsx,**/*.ts,**/*.astro,**/tailwind.config.*,**/components.json'
description: 'Shadcn/UI and TailwindCSS usage guidelines'
---

# Shadcn/UI + Tailwind CSS Guidelines

## Component Architecture

### Required Structure
```tsx
// components/ui/ComponentName.tsx
import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { type VariantProps, cva } from "class-variance-authority"

const componentVariants = cva(
  "base-classes", // Always applied
  {
    variants: {
      variant: {
        default: "default-styles",
        secondary: "secondary-styles",
      },
      size: {
        sm: "small-styles",
        md: "medium-styles",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface ComponentProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Additional props
}

const Component = forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        className={cn(componentVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Component.displayName = "Component"

export { Component, componentVariants }
```

### Essential Patterns
- **Always use `cn()` utility** for className merging
- **Use `cva()` for variant management** - provides type safety and consistency
- **Forward refs** for proper DOM access and library compatibility
- **Export both component and variants** for external styling
- **Keep components under 100 lines** - extract complex logic to hooks

## Tailwind Class Organization

### Required Order
```tsx
// Layout → Spacing → Sizing → Typography → Visual → Interactive
className="flex items-center gap-4 w-full h-12 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-2"
```

### Project-Specific Classes
```tsx
// Therapeutic interface styling
"bg-therapeutic-primary text-therapeutic-foreground" // For therapy-related UI
"border-bias-warning" // For bias detection alerts
"text-accessibility-high-contrast" // For WCAG AA compliance
```

## State Management Rules

### Component State
- **Local state**: `useState` for simple values, `useReducer` for complex objects
- **Form state**: Use `react-hook-form` with Zod validation
- **Server state**: Use `@tanstack/react-query` for all API calls

### Global State (Zustand)
```tsx
// stores/useTherapySession.ts
interface TherapySessionState {
  sessionId: string | null
  isActive: boolean
  biasAlerts: BiasAlert[]
  setSession: (id: string) => void
  addBiasAlert: (alert: BiasAlert) => void
}

export const useTherapySession = create<TherapySessionState>((set) => ({
  sessionId: null,
  isActive: false,
  biasAlerts: [],
  setSession: (id) => set({ sessionId: id, isActive: true }),
  addBiasAlert: (alert) => set((state) => ({ 
    biasAlerts: [...state.biasAlerts, alert] 
  })),
}))
```

## Accessibility Requirements

### WCAG AA Compliance
- **Color contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Focus management**: Visible focus indicators on all interactive elements
- **Keyboard navigation**: Full functionality without mouse
- **Screen reader support**: Proper ARIA labels and semantic HTML

### Implementation
```tsx
// Required accessibility patterns
<Button
  aria-label="Start therapy session"
  aria-describedby="session-help-text"
  className="focus:ring-2 focus:ring-offset-2 focus:ring-primary"
>
  Start Session
</Button>

// Form validation with screen reader support
<Input
  aria-invalid={!!error}
  aria-describedby={error ? "error-message" : undefined}
/>
{error && (
  <p id="error-message" className="text-destructive text-sm" role="alert">
    {error.message}
  </p>
)}
```

## Performance Optimization

### Bundle Size
- **Use dynamic imports** for large components: `const Component = lazy(() => import('./Component'))`
- **Tree-shake Tailwind**: Configure `content` paths precisely in `tailwind.config.ts`
- **Optimize re-renders**: Use `memo()` for expensive components, `useMemo()`/`useCallback()` judiciously

### Critical Rendering
```tsx
// Prioritize above-the-fold content
<div className="min-h-screen">
  <Suspense fallback={<TherapySessionSkeleton />}>
    <TherapyInterface />
  </Suspense>
</div>
```

## Animation Guidelines

### Performance-First Animations
```tsx
// ✅ Animate cheap properties only (transform, opacity)
className="transition-transform duration-200 hover:scale-105"

// ❌ Avoid animating expensive properties
className="transition-all duration-300" // Can cause jank

// ✅ Reduced motion support (required for accessibility)
const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return prefersReducedMotion
}
```

### Therapeutic Interface Animations
```tsx
// Bias alert animations (must be attention-grabbing but not jarring)
<motion.div
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  className="border-l-4 border-bias-warning bg-bias-warning/10"
>
  Potential bias detected
</motion.div>

// Session state transitions
const sessionVariants = {
  idle: { opacity: 0.7, scale: 0.98 },
  active: { opacity: 1, scale: 1 },
  processing: { opacity: 0.8, scale: 1.02 }
}
```

## Theme System

### CSS Variables (Required)
```css
/* src/styles/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --therapeutic-primary: 142 76% 36%;
    --therapeutic-foreground: 355 7% 97%;
    --bias-warning: 38 92% 50%;
    --bias-destructive: 0 84% 60%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --therapeutic-primary: 142 70% 45%;
    --therapeutic-foreground: 144 61% 20%;
  }
}
```

### Theme Implementation
```tsx
// Use existing theme provider from shadcn/ui
import { useTheme } from "next-themes"

// Theme-aware components
function TherapyInterface() {
  const { theme } = useTheme()
  
  return (
    <div className={cn(
      "bg-background text-foreground",
      "border border-border",
      theme === "dark" && "shadow-lg shadow-black/20"
    )}>
      {/* Interface content */}
    </div>
  )
}
```

## Responsive Design

### Mobile-First Approach
```tsx
// ✅ Start with mobile, enhance for larger screens
<div className="flex flex-col gap-4 md:flex-row md:gap-6 lg:gap-8">
  <TherapyChat className="flex-1" />
  <BiasMonitor className="w-full md:w-80" />
</div>

// ✅ Container queries for component-based responsive design
<div className="@container">
  <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3">
    {sessionCards}
  </div>
</div>
```

### Breakpoint Strategy
- **sm (640px)**: Tablet portrait adjustments
- **md (768px)**: Tablet landscape, small desktop
- **lg (1024px)**: Desktop primary layout
- **xl (1280px)**: Large desktop enhancements
- **@container queries**: Component-level responsive behavior

## Form Handling

### React Hook Form + Zod Integration
```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const therapySessionSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  sessionType: z.enum(["crisis", "trauma", "personality-disorder"]),
  duration: z.number().min(15).max(120),
})

type TherapySessionForm = z.infer<typeof therapySessionSchema>

function SessionSetupForm() {
  const form = useForm<TherapySessionForm>({
    resolver: zodResolver(therapySessionSchema),
    defaultValues: {
      sessionType: "crisis",
      duration: 60,
    },
  })

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="clientName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Client Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter client name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  )
}
```

## Error Handling

### Error Boundaries
```tsx
// components/ErrorBoundary.tsx
import { ErrorBoundary } from "react-error-boundary"

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground text-center mb-4">
        {error.message}
      </p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  )
}

// Wrap critical components
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <TherapySession />
</ErrorBoundary>
```

## Testing Requirements

### Component Testing
```tsx
// __tests__/BiasAlert.test.tsx
import { render, screen } from "@testing-library/react"
import { BiasAlert } from "@/components/BiasAlert"

describe("BiasAlert", () => {
  it("displays bias warning with correct severity", () => {
    render(
      <BiasAlert 
        severity="high" 
        message="Potential gender bias detected" 
      />
    )
    
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Potential gender bias detected")).toBeInTheDocument()
    expect(screen.getByTestId("bias-alert")).toHaveClass("border-destructive")
  })

  it("meets accessibility requirements", async () => {
    const { container } = render(<BiasAlert severity="medium" message="Test" />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```