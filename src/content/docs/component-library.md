---
title: "Astro Component Library"
description: "Astro Component Library documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation", "components"]
draft: false
toc: true
---

# Astro Component Library

This documentation provides an overview of our Astro component library, including usage examples, available props, and best practices.

## Table of Contents

- [Layout Components](#layout-components)
  - [BaseLayout](#baselayout)
  - [DashboardLayout](#dashboardlayout)
  - [BlogLayout](#bloglayout)
  - [AdminLayout](#adminlayout)
- [UI Components](#ui-components)
  - [Card](#card)
  - [Alert](#alert)
  - [Button](#button)
  - [ThemeToggle](#themetoggle)
  - [Link](#link)
- [Dashboard Components](#dashboard-components)
  - [AdminDashboard](#admindashboard)
  - [SecurityDashboard](#securitydashboard)
- [Utility Components](#utility-components)
  - [ErrorBoundary](#errorboundary)
- [Authentication Components](#authentication-components)
  - [LoginForm](#loginform)
  - [ResetPasswordForm](#resetpasswordform)
  - [PasswordResetRequestForm](#passwordresetrequestform)
  - [RegisterForm](#registerform)
  - [AuthCard](#authcard)
- [Transition Components](#transition-components)
  - [PageTransitions](#pagetransitions)

## Layout Components

Layout components provide the structure for pages and handle common elements like headers, footers, and navigation.

### BaseLayout

The standard layout for all pages in the application.

**File:** `src/layouts/BaseLayout.astro`

**Props:**

```typescript
interface Props {
  title: string;
  description?: string;
}
```

**Usage:**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---

<BaseLayout
  title="Page Title"
  description="A brief description of the page."
>
  <!-- Page content goes here -->
  <h1>Hello, world!</h1>
</BaseLayout>
```

**Features:**

- Provides a consistent HTML document structure (`<html>`, `<head>`, `<body>`).
- Sets up the dark theme by default.
- Includes the site-wide `Header` component.
- Defines global styles, including the `Geist Sans` font.
- Handles essential meta tags for SEO (`title`, `description`, `viewport`, etc.).
- Contains a `<slot />` for page-specific content.

### DashboardLayout

Layout for authenticated user dashboard pages.

**File:** `src/layouts/DashboardLayout.astro`

**Props:**

```typescript
interface Props {
  title: string;
  description?: string;
  requiresAuth?: boolean;
  showSidebar?: boolean;
}
```

**Usage:**

```astro
---
import DashboardLayout from '@/layouts/DashboardLayout.astro';
---

<DashboardLayout
  title="User Dashboard"
  requiresAuth={true}
  showSidebar={true}
>
  <div>
    <h1>Dashboard</h1>
    <p>Your dashboard content goes here.</p>
  </div>
</DashboardLayout>
```

**Features:**

- Includes ClientRouter for navigation without full page reloads
- Contains ErrorBoundary for graceful error handling
- Responsive design adapting to different screen sizes
- Proper meta tags for SEO and sharing
- Theme handling with CSS variables
- Smooth transitions between pages
- Enhanced accessibility features

### BlogLayout

Layout for blog posts and article pages.

**File:** `src/layouts/BlogLayout.astro`

**Props:**

```typescript
interface Props {
  title: string;
  description?: string;
  publishDate?: Date;
  author?: string;
  heroImage?: string;
  tags?: string[];
}
```

**Usage:**

```astro
---
import BlogLayout from '@/layouts/BlogLayout.astro';
---

<BlogLayout
  title="Understanding Mental Health"
  description="A comprehensive guide to mental health awareness"
  publishDate={new Date("2025-03-15")}
  author="Dr. Jane Smith"
  tags={["mental health", "wellness", "therapy"]}
>
  <article>
    <p>Blog content goes here...</p>
  </article>
</BlogLayout>
```

**Features:**

- Structured data for SEO and social sharing
- Tag display and filtering
- Author information
- Reading time estimation
- Related posts suggestions
- Integrates with content collections

### AdminLayout

Layout for admin dashboard and management pages.

**File:** `src/layouts/AdminLayout.astro`

**Props:**

```typescript
interface Props {
  title: string;
  description?: string;
  requiredPermission?: string;
}
```

**Usage:**

```astro
---
import AdminLayout from '@/layouts/AdminLayout.astro';
---

<AdminLayout
  title="User Management"
  requiredPermission="manage_users"
>
  <div>
    <h1>User Management</h1>
    <p>Admin content goes here...</p>
  </div>
</AdminLayout>
```

**Features:**

- Role-based access control
- Admin-specific navigation
- System status indicators
- Quick action buttons
- Enhanced security features

## UI Components

Reusable UI components for building interfaces.

### Card

Container component with a clean, bordered appearance.

**File:** `src/components/ui/Card.astro`

**Props:**

```typescript
interface Props extends HTMLAttributes<'div'> {
  class?: string;
}
```

**Usage:**

```astro
---
import Card from '@/components/ui/Card.astro';
import CardHeader from '@/components/ui/CardHeader.astro';
import CardTitle from '@/components/ui/CardTitle.astro';
import CardDescription from '@/components/ui/CardDescription.astro';
import CardContent from '@/components/ui/CardContent.astro';
import CardFooter from '@/components/ui/CardFooter.astro';
---

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Main content area</p>
  </CardContent>
  <CardFooter>
    <p>Footer content</p>
  </CardFooter>
</Card>
```

**Subcomponents:**

- `CardHeader`: Container for the card's header area
- `CardTitle`: Title element for the card
- `CardDescription`: Description text below the title
- `CardContent`: Main content area of the card
- `CardFooter`: Footer area, typically for actions or additional info
- `CardAction`: Action element positioned in the top-right corner

### Alert

Feedback component for displaying notifications.

**File:** `src/components/ui/Alert.astro`

**Props:**

```typescript
interface Props {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  description?: string;
  icon?: string;
  actions?: string;
  dismissible?: boolean;
  class?: string;
}
```

**Usage:**

```astro
---
import Alert from '@/components/ui/Alert.astro';
---

<Alert
  variant="warning"
  title="Connection Issue"
  description="Your internet connection appears to be unstable."
  dismissible={true}
/>
```

**Features:**

- Four variants: info (default), success, warning, error
- Optional icon
- Dismissible option
- Action buttons support
- Accessible design with proper ARIA attributes

### Button

A versatile button component that supports different variants and sizes.

**File:** `src/components/ui/Button.astro`

**Props:**

```typescript
interface Props extends HTMLAttributes<'button'> {
  href?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  loadingText?: string;
}
```

**Usage:**

```astro
---
import Button from '@/components/ui/Button.astro';
---

<!-- As a button -->
<Button>Click Me</Button>

<!-- As a link -->
<Button href="/dashboard">Go to Dashboard</Button>

<!-- With variants -->
<Button variant="outline" size="lg">Large Outline Button</Button>

<!-- Loading state -->
<Button loading loadingText="Saving...">Save</Button>

<!-- Icon button with accessibility -->
<Button size="icon" aria-label="Close dialog">
  <svg><!-- Icon SVG --></svg>
</Button>
```

**Features:**

- Multiple variants for different use cases
- Size options including icon-only buttons
- Loading state with spinner animation
- Automatic rendering as button or anchor based on href prop
- Accessibility checks for icon-only buttons
- CSS customization through class props
- Consistent styling with design system

### ThemeToggle

Button for switching between light, dark, and system themes.

**File:** `src/components/ui/ThemeToggle.astro`

**Props:**

```typescript
interface Props {
  class?: string;
}
```

**Usage:**

```astro
---
import ThemeToggle from '@/components/ui/ThemeToggle.astro';
---

<ThemeToggle />
```

**Features:**

- Cycles between light, dark, and system theme preferences
- Persists preference in localStorage
- Automatically applies theme on page load
- ARIA-labelled for accessibility
- Smooth transition between themes

### Link

Enhanced anchor component with external link handling.

**File:** `src/components/base/Link.astro`

**Props:**

```typescript
interface Props {
  href?: string;
  title?: string;
  rel?: string;
  external?: boolean;
  enableNewTabWarning?: boolean;
  class?: string;
}
```

**Usage:**

```astro
---
import Link from '@/components/base/Link.astro';
---

<Link href="/about">About Us</Link>

<Link
  href="https://example.com"
  external={true}
  enableNewTabWarning={true}
>
  External Link
</Link>
```

**Features:**

- Automatic external link detection
- Optional warning icon for links opening in new tabs
- Title and accessibility attributes for better UX
- Support for named slots (title and end)
- Proper security attributes for external links

## Dashboard Components

Components specifically designed for dashboard and admin views.

### AdminDashboard

Main component for the admin dashboard.

**File:** `src/components/admin/AdminDashboard.astro`

**Props:**

None. This component fetches and displays system metrics automatically.

**Usage:**

```astro
---
import AdminDashboard from '@/components/admin/AdminDashboard.astro';
---

<AdminDashboard />
```

**Features:**

- Displays system metrics (active users, sessions, response time, etc.)
- Error handling for API failures
- Visual indicators for status
- Auto-updates metrics periodically
- Progress bars for capacity indicators

### SecurityDashboard

Dashboard for monitoring security events.

**File:** `src/components/security/SecurityDashboard.astro`

**Props:**

None. This component fetches and displays security events automatically.

**Usage:**

```astro
---
import SecurityDashboard from '@/components/security/SecurityDashboard.astro';
---

<SecurityDashboard />
```

**Features:**

- Real-time security event monitoring
- Filtering by event type and severity
- Statistical overview of events
- Color-coded severity indicators
- Auto-refreshes every 30 seconds
- Cleans up event listeners when component unmounts

## Utility Components

Helper components that provide additional functionality.

### ErrorBoundary

Catches and displays errors in a user-friendly way.

**File:** `src/components/base/ErrorBoundary.astro`

**Props:**

```typescript
interface Props {
  fallback?: string;
}
```

**Usage:**

```astro
---
import ErrorBoundary from '@/components/base/ErrorBoundary.astro';
---

<ErrorBoundary fallback="Something went wrong. Please try again later.">
  <ComponentThatMightError />
</ErrorBoundary>
```

**Features:**

- Catches JavaScript errors in child components
- Displays a friendly fallback message
- Prevents the entire page from crashing
- Logs errors to the console
- Support for custom fallback content

## Authentication Components

Authentication components handle user login, registration, and password management.

### LoginForm

A React component for user authentication.

**File:** `src/components/auth/LoginForm.tsx`

**Props:**

```typescript
interface LoginFormProps {
  redirectTo?: string;
  showSignup?: boolean;
  showResetPassword?: boolean;
}
```

**Usage:**

```tsx
import { LoginForm } from '@/components/auth/LoginForm';

<LoginForm
  redirectTo="/dashboard"
  showSignup={true}
  showResetPassword={true}
/>
```

**Features:**

- Email and password validation
- "Remember me" functionality using localStorage
- CSRF protection with token generation
- Password reset functionality
- Error handling with toast notifications
- Loading states with visual feedback
- OAuth provider integration (Google)
- Responsive design optimized for mobile
- Cross-browser compatibility including iOS fixes

### ResetPasswordForm

A React component for changing passwords after reset.

**File:** `src/components/auth/ResetPasswordForm.tsx`

**Props:**

```typescript
interface ResetPasswordFormProps {
  redirectTo?: string;
}
```

**Usage:**

```tsx
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

<ResetPasswordForm redirectTo="/login" />
```

**Features:**

- Password validation with strength checks
- Matching password confirmation
- Toast notifications for feedback
- Loading indicators during submission
- Error handling with user-friendly messages
- Responsive layout optimized for mobile

### PasswordResetRequestForm

A React component for requesting password reset emails.

**File:** `src/components/auth/PasswordResetRequestForm.tsx`

**Props:**

```typescript
interface PasswordResetRequestFormProps {
  redirectTo?: string;
  onSuccess?: () => void;
}
```

**Usage:**

```tsx
import { PasswordResetRequestForm } from '@/components/auth/PasswordResetRequestForm';

<PasswordResetRequestForm
  redirectTo="/login"
  onSuccess={() => console.log('Reset email sent')}
/>
```

**Features:**

- Email validation
- Success state tracking
- Toast notifications for feedback
- Loading indicators during submission
- Error handling with user-friendly messages

### RegisterForm

A React component for new user registration.

**File:** `src/components/auth/RegisterForm.tsx`

**Props:**

```typescript
interface RegisterFormProps {
  redirectTo?: string;
}
```

**Usage:**

```tsx
import { RegisterForm } from '@/components/auth/RegisterForm';

<RegisterForm redirectTo="/dashboard" />
```

**Features:**

- Comprehensive form validation
- Password strength requirements
- Terms and conditions agreement
- Toast notifications for feedback
- Loading indicators during registration
- Error handling with specific messages
- OAuth registration options

### AuthCard

An Astro component that provides a styled card container for authentication forms.

**File:** `src/components/auth/AuthCard.astro`

**Props:**

```typescript
interface Props {
  title?: string;
  subtitle?: string;
  class?: string;
}
```

**Usage:**

```astro
---
import AuthCard from '@/components/auth/AuthCard.astro';
---

<AuthCard
  title="Welcome Back"
  subtitle="Enter your credentials to access your account"
>
  <div>Form content goes here</div>
</AuthCard>
```

**Features:**

- Consistent styling across authentication forms
- Proper spacing and layout
- Responsive design that fits on screen without scrolling
- Dark theme styling with black background
- Subtle animations on appearance

## Transition Components

Components that handle page transitions and animations.

### PageTransitions

An Astro component that creates smooth transitions between pages using Astro's View Transitions API.

**File:** `src/components/transitions/PageTransitions.astro`

**Props:**

```typescript
interface Props {
  mode?: 'default' | 'fade' | 'slide' | 'slide-up' | 'slide-down' | 'zoom';
  duration?: number;
}
```

**Usage:**

```astro
---
import PageTransitions from '@/components/transitions/PageTransitions.astro';
import BaseLayout from '@/layouts/BaseLayout.astro';
---

<BaseLayout title="My Page">
  <PageTransitions mode="slide" duration={400}>
    <div>Page content here</div>
  </PageTransitions>
</BaseLayout>
```

**Features:**

- Multiple transition animations (fade, slide, zoom)
- Customizable duration
- Dark mode support
- Individual element transitions with named view transitions
- Browser compatibility handling
- Smooth animations with proper timing functions
- Event handling for transition completion

## Best Practices

### Component Composition

Combine components to create more complex interfaces:

```astro
<Card>
  <CardHeader>
    <CardTitle>User Statistics</CardTitle>
    <CardDescription>Overview of user activity</CardDescription>
    <CardAction>
      <ThemeToggle />
    </CardAction>
  </CardHeader>
  <CardContent>
    <Alert variant="info" title="Note">
      Data is updated every 5 minutes.
    </Alert>
    <!-- Content goes here -->
  </CardContent>
  <CardFooter>
    <Button variant="outline">Refresh</Button>
  </CardFooter>
</Card>
```

### Conditional Rendering

Use Astro's template syntax for conditional rendering:

```astro
---
const { showHeader = true, user } = Astro.props;
---

{showHeader && <header>Site Header</header>}

{user ? (
  <p>Welcome back, {user.name}!</p>
) : (
  <p>Please <Link href="/login">log in</Link></p>
)}
```

### Using Slots

Leverage Astro's slot system for flexible content placement:

```astro
---
// Component definition
---

<div class="container">
  <header>
    <slot name="header">Default Header</slot>
  </header>
  <main>
    <slot />
  </main>
  <footer>
    <slot name="footer">Default Footer</slot>
  </footer>
</div>
```

Usage:

```astro
<MyComponent>
  <h1 slot="header">Custom Header</h1>
  <p>Main content goes in the default slot</p>
  <div slot="footer">Custom Footer</div>
</MyComponent>
```

### Client Directives

When integrating React components, use the appropriate client directive:

```astro
---
import ReactComponent from './ReactComponent.jsx';
---

<ReactComponent client:load /> <!-- Load immediately -->
<ReactComponent client:visible /> <!-- Load when visible -->
<ReactComponent client:idle /> <!-- Load during browser idle time -->
```

## Testing Components

All components in the library should have corresponding tests. See the [Component Testing Guide](./component-testing.md) for details on how to test these components.

## Contributing New Components

When creating new components:

1. Follow the established folder structure
2. Include proper TypeScript types for props
3. Document props and usage
4. Create tests using Vitest
5. Follow the [React to Astro Conversion Guide](./react-to-astro-conversion.md) if converting from React

## See Also

- [Component Testing Guide](./component-testing.md)
- [React to Astro Conversion Guide](./react-to-astro-conversion.md)
- [API Documentation](./api.md)
- [Deployment Guide](./deployment.md)
