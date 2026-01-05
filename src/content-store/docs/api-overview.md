---
title: "API Overview"
description: "Overview of the Pixelated Empathy API endpoints and usage"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["api", "documentation"]
draft: false
toc: true
---

# API Overview

This document provides an overview of the Pixelated Empathy API endpoints and usage.

## Authentication

All API requests require authentication via JWT tokens.

## Base URL

```
https://api.pixelatedempathy.com/v1
```

## Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Token refresh

### Sessions
- `GET /sessions` - List user sessions
- `POST /sessions` - Create new session
- `GET /sessions/{id}` - Get session details

### Messages
- `GET /sessions/{id}/messages` - Get session messages
- `POST /sessions/{id}/messages` - Send message

## Rate Limits

All endpoints are rate limited to prevent abuse.
