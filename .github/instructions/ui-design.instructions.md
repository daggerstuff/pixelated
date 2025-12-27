---
applyTo: '**/*.tsx,**/*.jsx,**/*.astro,**/components/**/*,**/ui/**/*'
description: 'UI/UX design guidelines for Pixelated Empathy'
---

# UI/UX Design Guidelines for Pixelated Empathy

## Design System Tokens

Use consistent design tokens throughout the application:

```tsx
// src/lib/design-tokens.ts
export const tokens = {
  colors: {
    primary: "hsl(var(--primary))",
    secondary: "hsl(var(--secondary))",
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    muted: "hsl(var(--muted))",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))"
  },
  spacing: {
    xs: "0.25rem", sm: "0.5rem", md: "1rem", 
    lg: "1.5rem", xl: "2rem", "2xl": "3rem"
  }
};
```

## Component Architecture

Follow atomic design principles with clear prop interfaces:

```tsx
// ✅ Proper component structure
interface ButtonProps {
  variant?: "primary" | "secondary" | "destructive";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({ 
  variant = "primary", 
  size = "md", 
  children, 
  leftIcon, 
  rightIcon, 
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variants[variant],
        sizes[size]
      )}
      {...props}
    >
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
}
```

## Accessibility Requirements (WCAG AA)

All UI components must meet WCAG AA standards for healthcare applications:

```tsx
// ✅ Accessible form components
export function FormField({ label, error, required, ...props }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2",
          error ? "border-destructive" : "border-input"
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ✅ Modal with focus management
export function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;
    
    firstElement?.focus();
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };
    
    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]"
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

## Responsive Design Patterns

Use mobile-first approach with Tailwind CSS breakpoints:

```tsx
// ✅ Responsive dashboard layout
<div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:gap-6 md:p-6 lg:grid-cols-3 xl:grid-cols-4">
  {/* Cards adapt to screen size */}
</div>

// ✅ Responsive navigation
<nav className="flex flex-col space-y-2 md:flex-row md:space-x-4 md:space-y-0">
  {/* Navigation items */}
</nav>

// ✅ Chat interface responsive layout
<div className="flex h-screen flex-col lg:flex-row">
  <aside className="w-full border-b lg:w-64 lg:border-b-0 lg:border-r">
    {/* Sidebar */}
  </aside>
  <main className="flex-1 flex flex-col">
    {/* Chat area */}
  </main>
</div>
```

## Performance Optimization

Optimize components for the real-time chat interface:

```tsx
// ✅ Lazy load heavy AI components
const AIChat = React.lazy(() => import('~/components/ai/AIChat'));
const BiasDetection = React.lazy(() => import('~/components/ai/BiasDetection'));

// ✅ Optimized chat message rendering
const ChatMessage = memo(({ message, isTyping }) => {
  return (
    <div className={cn("flex gap-3 p-4", message.role === 'user' ? 'justify-end' : 'justify-start')}>
      {message.role === 'assistant' && <Avatar />}
      <div className={cn("max-w-[80%] rounded-lg p-3", 
        message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        {isTyping ? <TypingIndicator /> : message.content}
      </div>
    </div>
  );
});

// ✅ Virtualized chat history for performance
import { FixedSizeList as List } from 'react-window';

function ChatHistory({ messages }) {
  const renderMessage = useCallback(({ index, style }) => (
    <div style={style}>
      <ChatMessage message={messages[index]} />
    </div>
  ), [messages]);

  return (
    <List
      height={600}
      itemCount={messages.length}
      itemSize={80}
      itemData={messages}
    >
      {renderMessage}
    </List>
  );
}
```

## User Feedback & Loading States

Provide clear feedback for AI interactions and secure operations:

```tsx
// ✅ AI processing states
function AIResponseButton({ isProcessing, onSubmit }) {
  return (
    <Button 
      onClick={onSubmit}
      disabled={isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          AI Processing...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Send Message
        </>
      )}
    </Button>
  );
}

// ✅ Security status indicators
function SecurityStatus({ encryptionStatus, biasScore }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Shield className={cn("h-4 w-4", 
        encryptionStatus === 'encrypted' ? 'text-green-500' : 'text-yellow-500'
      )} />
      <span>FHE Encrypted</span>
      {biasScore !== null && (
        <Badge variant={biasScore < 0.3 ? 'default' : 'destructive'}>
          Bias: {(biasScore * 100).toFixed(1)}%
        </Badge>
      )}
    </div>
  );
}

// ✅ Error boundaries for AI components
class AIErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>AI Service Error</AlertTitle>
          <AlertDescription>
            The AI service is temporarily unavailable. Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
```

## Theme & Styling Conventions

Use shadcn/ui components with consistent theming:

```tsx
// ✅ Use cn() utility for class merging
import { cn } from "~/lib/utils";

// ✅ Component variant patterns
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary"
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

// ✅ Dark mode support
function ThemeProvider({ children, defaultTheme = "system" }) {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark" : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

## Component Testing Standards

Test UI components for accessibility and functionality:

```tsx
// ✅ Accessibility testing
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('ChatMessage is accessible', async () => {
  const { container } = render(
    <ChatMessage 
      message={{ role: 'assistant', content: 'Hello' }} 
      isTyping={false} 
    />
  );
  
  const results = await axe(container);
  expect(results).toHaveNoViolations();
  
  // Test keyboard navigation
  const message = screen.getByRole('article');
  expect(message).toBeInTheDocument();
});

// ✅ Responsive testing with Playwright
test('dashboard layout adapts to screen size', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Mobile view
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.locator('[data-testid="sidebar"]')).toHaveClass(/hidden/);
  
  // Desktop view
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
});
```

## Healthcare UI Considerations

- Use calming color palettes appropriate for mental health contexts
- Ensure high contrast for users with visual impairments
- Provide clear visual hierarchy for complex therapeutic interfaces
- Include progress indicators for multi-step processes
- Design for stress-free interactions during crisis scenarios

## Anti-Patterns to Avoid

- Don't use red colors for non-error states (can trigger anxiety)
- Avoid complex animations during sensitive conversations
- Never hide critical safety information behind interactions
- Don't use medical terminology without clear explanations
- Avoid overwhelming interfaces during crisis interventions