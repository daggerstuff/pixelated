---
title: "Astro API Integration"
description: "Astro API Integration documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Astro API Integration

This guide explains how to integrate our APIs within Astro components, providing server-side data fetching and client-side interactivity.

## Server-Side API Access

In Astro components, you can fetch data during server-side rendering using the frontmatter section:

```astro
---
// Import API utilities
import { getUser, getProfile } from '../lib/api/auth';

// Get data during server-side rendering
const user = await getUser();
const profile = user ? await getProfile(user.id) : null;

// Optional: pass data as props to client components
const userData = {
  name: user?.name || 'Guest',
  email: user?.email,
  avatar: profile?.avatar_url
};
---

<div>
  <h1>Welcome, {userData.name}</h1>

  {user ? (
    <p>You are logged in as {userData.email}</p>
  ) : (
    <p>Please log in to view your profile</p>
  )}

  <!-- Pass data to client component -->
  <UserProfileClient client:load userData={userData} />
</div>
```

## Client-Side API Access

For client-side API access in framework components (React, Vue, etc.), use the API client libraries:

```tsx
import { useState, useEffect } from 'react';
import { api } from '../../lib/api/client';

export default function UserProfileClient({ userData }) {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const data = await api.getUserMetrics(userData.id);
        setMetrics(data);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userData.id) {
      fetchMetrics();
    }
  }, [userData.id]);

  return (
    <div>
      <h2>User Metrics</h2>
      {loading ? (
        <p>Loading metrics...</p>
      ) : metrics ? (
        <ul>
          <li>Sessions: {metrics.sessionCount}</li>
          <li>Average duration: {metrics.avgDuration}min</li>
        </ul>
      ) : (
        <p>No metrics available</p>
      )}
    </div>
  );
}
```

## Mixed Rendering Patterns

### Progressive Enhancement

Use progressive enhancement by providing server-rendered content with enhanced client-side functionality:

```astro
---
import { getPopularContent } from '../lib/api/content';

// Fetch initial data server-side
const initialContent = await getPopularContent({ limit: 5 });
---

<!-- Server-rendered initial content -->
<ContentList items={initialContent} />

<!-- Client-side enhancement with filtering, search, etc. -->
<ContentFilters client:visible initialContent={initialContent} />
```

### Partial Hydration

Leverage Astro's partial hydration directives to only send JavaScript for interactive components:

```astro
---
import StaticHeader from '../components/StaticHeader.astro';
import InteractiveSearch from '../components/InteractiveSearch';
import LazyLoadedDashboard from '../components/Dashboard';
---

<!-- Static component - no JS sent to client -->
<StaticHeader />

<!-- Hydrate immediately when page loads -->
<InteractiveSearch client:load />

<!-- Hydrate only when component is visible -->
<LazyLoadedDashboard client:visible />
```

## Best Practices

### Error Handling

Implement proper error handling for both server and client-side API calls:

```astro
---
import { getUser } from '../lib/api/auth';
import ErrorMessage from '../components/ErrorMessage.astro';

let user;
let error;

try {
  user = await getUser();
} catch (e) {
  error = e.message || 'An error occurred fetching user data';
}
---

{error ? (
  <ErrorMessage message={error} />
) : (
  <UserProfile user={user} />
)}
```

### Security Considerations

1. **Never expose API keys in client-side code**
2. **Use server-side fetching for sensitive operations**
3. **Implement proper CSRF protection**
4. **Validate and sanitize all user inputs**

### Performance Optimization

1. **Cache frequently accessed data with `fetch()` caching**
   ```astro
   ---
   // Uses built-in caching
   const response = await fetch('https://api.example.com/data', {
     headers: { 'Authorization': `Bearer ${import.meta.env.API_KEY}` }
   });
   const data = await response.json();
   ---
   ```

2. **Use `client:idle` or `client:visible` for non-critical components**
3. **Minimize client JavaScript with server-side rendering where possible**
4. **Implement stale-while-revalidate patterns for data freshness**

## Advanced Integration

For more advanced integration patterns, refer to:
- [API Client Library Documentation](../clients/javascript.md)
- [Authentication Integration](../auth/integration.md)
- [Real-time Data Updates](../streaming/websockets.md)