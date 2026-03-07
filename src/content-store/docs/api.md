---
title: "API Documentation"
description: "Complete API documentation for Pixelated Empathy backend endpoints"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["api", "documentation"]
draft: false
toc: true
---

# API Documentation

This document provides an overview of the API endpoints available in the application.

## API Structure

Our API is organized into several functional areas:

- **Auth**: User authentication and authorization
- **Messages**: Message sending and retrieval
- **Security**: Security event logging and monitoring
- **Users**: User management
- **Admin**: Admin-specific functionality

## Authentication

Authentication is handled through JWT tokens. Most endpoints require authentication.

### User Authentication Flow

1. User signs in with email/password or OAuth provider
2. JWT token is returned and stored in the client
3. Subsequent requests include the JWT token in the Authorization header
4. Token is validated on each request

## Endpoints

### Auth API

```typescript
// POST /api/auth/login
// Get authentication token
POST /api/auth/login
Body: { email: string, password: string }
Response: { token: string, user: User }

// POST /api/auth/logout
// Sign out the current user
POST /api/auth/logout
Headers: { Authorization: "Bearer <token>" }
Response: { success: boolean }
```

### Messages API

```typescript
// POST /api/messages
// Send a message
POST /api/messages
Headers: { Authorization: "Bearer <token>" }
Body: { content: string, recipientId: string }
Response: { messageId: string }

// GET /api/messages
// Get messages for a conversation
GET /api/messages?conversationId=<id>&page=<number>&limit=<number>
Headers: { Authorization: "Bearer <token>" }
Response: { messages: Message[], pagination: PaginationInfo }

// PUT /api/messages/read
// Mark messages as read
PUT /api/messages/read
Headers: { Authorization: "Bearer <token>" }
Body: { messageIds: string[] }
Response: { success: boolean }
```

### Security API

```typescript
// GET /api/security/events
// Get security events with optional filtering
GET /api/security/events?type=<type>&severity=<severity>
Headers: { Authorization: "Bearer <token>" }
Response: { events: SecurityEvent[] }

// GET /api/security/stats
// Get security event statistics
GET /api/security/stats
Headers: { Authorization: "Bearer <token>" }
Response: { stats: SecurityStats }
```

### Users API

```typescript
// GET /api/users/:id
// Get user profile
GET /api/users/:id
Headers: { Authorization: "Bearer <token>" }
Response: { user: UserProfile }

// PUT /api/users/profile
// Update user profile
PUT /api/users/profile
Headers: { Authorization: "Bearer <token>" }
Body: { name?: string, bio?: string, avatarUrl?: string }
Response: { user: UserProfile }

// GET /api/users/search
// Search for users
GET /api/users/search?q=<query>
Headers: { Authorization: "Bearer <token>" }
Response: { users: UserProfile[] }
```

### Admin API

```typescript
// GET /api/admin/metrics
// Get system metrics
GET /api/admin/metrics
Headers: { Authorization: "Bearer <token>" }
Response: { metrics: SystemMetrics }

// GET /api/admin/analytics
// Get user analytics
GET /api/admin/analytics?timeframe=<day|week|month>
Headers: { Authorization: "Bearer <token>" }
Response: { analytics: UserAnalytics }

// DELETE /api/admin/users/:id
// Remove user account (admin only)
DELETE /api/admin/users/:id
Headers: { Authorization: "Bearer <token>" }
Response: { success: boolean }
```

## Data Models

### User

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  createdAt: string;
}
```

### Message

```typescript
interface Message {
  id: string;
  content: string;
  senderId: string;
  recipientId: string;
  conversationId: string;
  read: boolean;
  createdAt: string;
}
```

### SecurityEvent

```typescript
interface SecurityEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  userId?: string;
  ip?: string;
  metadata?: {
    details: string;
    source?: string;
    context?: string;
  };
}
```

### SystemMetrics

```typescript
interface SystemMetrics {
  activeUsers: number;
  activeSessions: number;
  sessionsToday: number;
  totalTherapists: number;
  totalClients: number;
  messagesSent: number;
  avgResponseTime: number;
  systemLoad: number;
  storageUsed: string;
  activeSecurityLevel: string;
}
```

## Working with Pagination

Many endpoints that return lists support pagination through query parameters:

```typescript
interface PaginationInfo {
  page: number;  // Current page number
  limit: number;  // Items per page
  total: number;  // Total number of items
  hasNext: boolean;  // Whether there are more pages
  hasPrev: boolean;  // Whether there are previous pages
}

interface PaginatedResponse<T> {
  data: T[];  // Current page of results
  pagination: PaginationInfo;  // Pagination metadata
}
```

Example usage:

```typescript
// First page
const response = await fetch('/api/messages?conversationId=123&page=1&limit=20', {
  headers: { Authorization: `Bearer ${token}` }
});
const firstPage = await response.json();

// Next page
if (firstPage.pagination.hasNext) {
  const nextResponse = await fetch('/api/messages?conversationId=123&page=2&limit=20', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const secondPage = await nextResponse.json();
}
```

## Error Handling

API errors follow a standard format:

```typescript
interface ApiError {
  code: string;  // Error code (e.g., "not_found", "unauthorized")
  message: string;  // Human-readable error message
  details?: any;  // Additional error details
}
```

Common error codes:

- `unauthorized`: User is not authenticated
- `forbidden`: User does not have permission to perform the action
- `not_found`: Requested resource was not found
- `validation_error`: Request data failed validation
- `internal_error`: Server encountered an unexpected error

## Client Usage

### React Components

React components can use fetch or custom hooks to interact with the API:

```jsx
import { useState, useEffect } from 'react';

function MessagesComponent({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/messages?conversationId=${conversationId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        setMessages(data.messages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [conversationId]);

  const handleSend = async (content) => {
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content, recipientId: 'user123' })
      });
      // Refresh messages
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>{message.content}</div>
      ))}
      <button onClick={() => handleSend('Hello!')}>Send</button>
    </div>
  );
}
```

### Astro Components

Astro components can fetch data during server-side rendering:

```astro
---
const token = Astro.cookies.get('auth-token')?.value;

let messages = [];
if (token) {
  try {
    const response = await fetch(`${Astro.url.origin}/api/messages?conversationId=123`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    messages = data.messages;
  } catch (error) {
    console.error('Failed to fetch messages:', error);
  }
}
---

<div>
  {messages.map(message => (
    <div>{message.content}</div>
  ))}
</div>
```

## Development

When developing new API endpoints:

1. Create your endpoint handler in the appropriate file under `src/pages/api/`
2. Use proper TypeScript types for request and response validation
3. Add proper error handling and validation
4. Implement authentication middleware where needed
5. Document the endpoint in this API documentation

For more details, see the [API Development Guide](./api-development.md).
