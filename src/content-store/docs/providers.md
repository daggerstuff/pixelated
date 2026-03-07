---
title: 'Provider System'
description: 'Comprehensive guide to Pixelated Healths provider system for managing global state and functionality'
pubDate: 2025-03-24
share: true
toc: true
lastModDate: 2025-03-25
tags: ['providers', 'state-management', 'architecture']
author: 'Pixelated Team'
---

# Provider System

The provider system in Pixelated is designed to manage global state and functionality across the application. It includes several key providers that handle different aspects of the application's functionality.

## SharedProviders

The `SharedProviders` component is the root provider that composes all other providers. It includes:

- Error handling with ErrorBoundary
- Theme management with ThemeProvider
- Security settings with SecurityProvider


### Usage

```tsx

function App() {
  return (
  )
}
```

You can also use the HOC pattern:

```tsx

function YourComponent() {
  return <div>Your component content</div>
}

```

## ThemeProvider

Manages the application's theme state including:

- Color scheme (light/dark/system)
- Contrast mode (standard/high)
- Motion preferences (reduced/full)

### Usage

```tsx

function YourComponent() {
  const { colorScheme, setColorScheme } = useTheme()

  return (
  )
}
```

## SecurityProvider

Handles security-related functionality including:

- Security levels (standard/HIPAA/maximum)
- FHE operations
- Key rotation
- Data encryption/decryption

### Usage

```tsx

function YourComponent() {
  const { securityLevel, setSecurityLevel, encryptData } = useSecurity()

  const handleSubmit = async (data: string) => {
    const encrypted = await encryptData(data)
    // Handle encrypted data
  }

  return (
      <select
        value={securityLevel}
        onChange={(e) => setSecurityLevel(e.target.value)}
      >
  )
}
```

## ErrorBoundary

Provides error handling and fallback UI for runtime errors.

### Usage

```tsx

function YourComponent() {
  const { throwError } = useErrorBoundary()

  return (
      Trigger Error
  )
}
```

You can also use the HOC pattern:

```tsx

function YourComponent() {
  return <div>Your component content</div>
}

  fallback: <CustomErrorUI />,
  onError: (error, errorInfo) => {
    // Custom error handling
  },
})
```

## Best Practices

1. Always use the `SharedProviders` at the root of your application
2. Use the appropriate hooks (`useTheme`, `useSecurity`) to access provider functionality
3. Handle errors appropriately with ErrorBoundary
4. Consider performance implications when updating provider state
5. Use TypeScript for better type safety and developer experience
6. Follow the principle of least privilege when setting security levels
7. Test provider integration thoroughly
8. Document any custom provider implementations

## TypeScript Support

All providers and their hooks are fully typed. Example type definitions:

```tsx
interface ThemeState {
  colorScheme: 'light' | 'dark' | 'system'
  contrastMode: 'standard' | 'high'
  motionPreference: 'reduced' | 'full'
}

interface SecurityState {
  securityLevel: 'standard' | 'hipaa' | 'maximum'
  isKeyRotationNeeded: boolean
  lastKeyRotation: Date
}
```

## Testing

The provider system includes comprehensive tests. Run them with:

```bash
pnpm test src/lib/providers/__tests__
```

See the test file for examples of testing provider functionality.
