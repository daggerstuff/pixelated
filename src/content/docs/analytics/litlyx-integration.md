---
title: "Litlyx Analytics Integration"
description: "Litlyx Analytics Integration documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Litlyx Analytics Integration

This project uses [Litlyx](https://docs.litlyx.com/) for analytics, a privacy-focused, open-source analytics solution.

## Setup

### 1. Environment Configuration

Add your Litlyx project ID to the `.env` or `.env.local` file:

```
VITE_LITLYX_PROJECT_ID=your_project_id
```

### 2. Integration Options

#### Option 1: npm Package (Default)

The integration is already set up in the following files:

- `src/analytics/index.ts` - Core analytics service with Litlyx integration
- `src/components/LitlyxAnalytics.tsx` - Component for initializing Litlyx
- `src/App.tsx` - Includes the LitlyxAnalytics component
- `src/hooks/useAnalytics.tsx` - Hook for tracking events

To use this approach, ensure the `LitlyxAnalytics` component is included in your App:

```jsx
<LitlyxAnalytics projectId={LITLYX_PROJECT_ID} />
```

#### Option 2: Script Tag

As an alternative, you can use the script tag approach by including the `LitlyxScript` component in your App:

```jsx
import { LitlyxScript } from '@/components/LitlyxScript'

// In your component
<LitlyxScript projectId={LITLYX_PROJECT_ID} />
```

For self-hosted Litlyx instances, you can provide additional parameters:

```jsx
<LitlyxScript
  projectId={LITLYX_PROJECT_ID}
  host="your-host-name"
  port="your-port"
  secure={true}
/>
```

## Usage

### Tracking Page Views

Page views are automatically tracked when using the `Layout` component with React Router.

### Tracking Custom Events

Use the `useAnalytics` hook to track custom events:

```jsx
import { useAnalytics } from '@/hooks/useAnalytics'

function MyComponent() {
  const { trackEvent, trackButtonClick, trackFormSubmit } = useAnalytics()

  const handleButtonClick = () => {
    // Track a button click
    trackButtonClick('submit-button', {
      location: 'homepage',
      action: 'submit-form'
    })

    // Do something...
  }

  const handleFormSubmit = (data) => {
    // Track a form submission
    trackFormSubmit('contact-form', {
      formType: 'contact',
      fields: Object.keys(data).length
    })

    // Process form...
  }

  const handleCustomAction = () => {
    // Track a custom event
    trackEvent('feature_used', {
      featureName: 'image-upload',
      fileSize: 1024,
      fileType: 'image/png'
    })

    // Do something...
  }

  return (
    <div>
      {/* Your component JSX */}
    </div>
  )
}
```

### Direct API Usage (Script Tag Approach)

If you're using the script tag approach, you can also use the Litlyx API directly in your code:

```javascript
// Track a custom event
window.Lit.event('click_on_buy_item', {
  metadata: {
    'product-name': 'Product Name',
    'price': 19.99,
    'currency': 'USD'
  }
})
```

## Available Event Tracking Functions

- `trackEvent(type, data, userId, sessionId)` - Track any type of event
- `trackPageView(path, data)` - Track a page view
- `trackButtonClick(buttonId, data)` - Track a button click
- `trackFormSubmit(formId, data)` - Track a form submission

## Predefined Event Types

The following event types are predefined for consistency:

- `page_view` - Page views
- `button_click` - Button clicks
- `form_submit` - Form submissions
- `user_register` - User registrations
- `user_login` - User logins
- `user_logout` - User logouts
- `feature_used` - Feature usage
- `error_occurred` - Errors

You can also use custom event types by passing a string to the `trackEvent` function.

## Dashboard Access

Access your Litlyx dashboard at [https://app.litlyx.com/](https://app.litlyx.com/) to view analytics data.

## Self-Hosting (Optional)

If you prefer to self-host Litlyx, follow the instructions in the [Litlyx documentation](https://docs.litlyx.com/self-hosting).

To connect to your self-hosted instance:

1. With the npm package approach:
   ```typescript
   // Add this code to configure the Litlyx instance
   import { Lit } from 'litlyx-js'

   Lit.setHost('your-host-name')
   Lit.setPort('your-port')
   Lit.setSecure(true) // For HTTPS
   Lit.init('your-project-id')
   ```

2. With the script tag approach, use the additional props:
   ```jsx
   <LitlyxScript
     projectId="your-project-id"
     host="your-host-name"
     port="your-port"
     secure={true}
   />
   ```

## Advanced Configuration

For advanced configuration options, see the [Litlyx documentation](https://docs.litlyx.com/).
