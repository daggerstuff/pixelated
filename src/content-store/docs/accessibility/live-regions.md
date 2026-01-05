---
title: 'Live Region System'
description: 'Live Region System documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation']
draft: false
toc: true
---

# Live Region System

The Live Region System provides a standardized way to announce dynamic content changes to users of assistive technologies like screen readers. This ensures users are informed about important updates that may not be visually apparent.

## Overview

The system includes:

1. **Four specialized live regions:**
   - **Status:** For general status updates (polite announcements)
   - **Alert:** For important notifications that need immediate attention (assertive announcements)
   - **Log:** For sequential information updates (polite announcements, not atomic)
   - **Progress:** For progress updates (polite announcements)

2. **Three implementation approaches:**
   - **Astro component:** A global component that can be included in layouts
   - **React context provider:** For React components
   - **Utility functions:** For direct use in JavaScript/TypeScript

## Implementation

The Live Region System is automatically included in the BaseLayout, so it's available on all pages that use this layout.

### Using Live Regions in Astro Components

```astro
---
// In your Astro component
---

<button
  onclick="window.LiveRegionSystem.announceStatus('Operation completed successfully')"
>
  Complete Operation

  // Access the system in client-side scripts
  document.addEventListener('DOMContentLoaded', () => {
    const progressButton = document.getElementById('progress-button')
    if (progressButton) {
      progressButton.addEventListener('click', () => {
        let progress = 0
        const interval = setInterval(() => {
          progress += 10
          window.LiveRegionSystem.announceProgress(progress, 100, 'Loading')
          if (progress >= 100) {
            clearInterval(interval)
            window.LiveRegionSystem.announceStatus('Loading complete')
          }
        }, 500)
      })
    }
  })
```

### Using Live Regions in React Components

```tsx
  useLiveRegion,
  useStatusAnnouncer,
} from '@/components/accessibility/LiveRegionContext'

// Option 1: Use the combined hook
function MyComponent() {
  const { announceStatus, announceAlert } = useLiveRegion()

  const handleSuccess = () => {
    announceStatus('Operation completed successfully')
  }

  const handleError = () => {
    announceAlert('Error: Operation failed')
  }

  return (
  )
}

// Option 2: Use individual hooks
function AnotherComponent() {
  const announceStatus = useStatusAnnouncer()

  const handleAction = () => {
    announceStatus('Action performed')
  }

  return <button onClick={handleAction}>Perform Action</button>
}
```

### Using Utility Functions

```ts
  announceStatus,
  announceAlert,
  log,
  announceProgress,
} from '@/utils/liveRegion'

// In any JavaScript/TypeScript file
function handleFormSubmission() {
  // Show loading status
  announceStatus('Submitting form...')

  // Simulate form submission
  setTimeout(() => {
    // Success case
    announceStatus('Form submitted successfully')

    // Or error case
    // announceAlert('Error: Form submission failed');
  }, 2000)
}
```

## API Reference

### Astro Component API

The global `window.LiveRegionSystem` object provides these methods:

```ts
window.LiveRegionSystem.announceStatus(message, (clearDelay = 5000))
window.LiveRegionSystem.announceAlert(message, (clearDelay = 7000))
window.LiveRegionSystem.log(message, (clear = false))
window.LiveRegionSystem.announceProgress(value, max, label)
```

### React Context API

```tsx
// Provider (already included in BaseLayout)
;<LiveRegionProvider>

// Hooks
const { announceStatus, announceAlert, log, announceProgress } = useLiveRegion()
const announceStatus = useStatusAnnouncer()
const announceAlert = useAlertAnnouncer()
const log = useLogAnnouncer()
const announceProgress = useProgressAnnouncer()
```

### Utility Functions API

```ts
announceStatus(message, clearDelay?)
announceAlert(message, clearDelay?)
log(message, clear?)
announceProgress(value, max, label)
```

## Best Practices

1. **Choose the right region type:**
   - Use `status` for non-critical updates
   - Use `alert` only for critical information that requires immediate attention
   - Use `log` for sequential messages where history matters
   - Use `progress` for tracking progress of operations

2. **Write clear messages:**
   - Be concise but descriptive
   - Include action context
   - Use present tense (e.g., "Form submitted" rather than "Form has been submitted")

3. **Control verbosity:**
   - Don't announce every minor change
   - Group related announcements
   - Consider user context and screen reader behavior

4. **Test with actual screen readers:**
   - Test with multiple screen readers (NVDA, JAWS, VoiceOver)
   - Verify that announcements work as expected
   - Check timing of announcements

## Examples

### Form validation

```tsx
function handleSubmit(e) {
  e.preventDefault()

  if (!isValid) {
    announceAlert('Form has 3 errors. Please correct the highlighted fields.')
  } else {
    announceStatus('Submitting form...')

    // After submission completes
    announceStatus('Form submitted successfully')
  }
}
```

### Data updates

```tsx
function refreshData() {
  announceStatus('Refreshing data...')

  // After data loads
  announceStatus('Data updated. 5 new items available.')
}
```

### Progress indication

```tsx
function startDownload() {
  let progress = 0

  const interval = setInterval(() => {
    progress += 10
    announceProgress(progress, 100, 'Downloading file')

    if (progress >= 100) {
      clearInterval(interval)
      announceStatus('Download complete')
    }
  }, 500)
}
```
