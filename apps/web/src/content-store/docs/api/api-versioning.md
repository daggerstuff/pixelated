---
title: API Versioning Policy
description: How Pixelated Empathy versions its public API and manages backward
  compatibility
pubDate: 2026-07-23
author: Platform Team
tags: [api, versioning, policy]
draft: false
toc: true
---

## Overview

The Pixelated Empathy API uses **URL path-based versioning** (`/v1/`, `/v2/`) as
the primary versioning scheme, supplemented by the `X-API-Version` response
header on all API responses.

## Version Identification

### URL Path

Every versioned API endpoint includes the version in the path:

```
GET  /api/v1/health
POST /api/v1/developer/api-keys
GET  /api/v1/admin/cache-stats
```

### Response Header

All `/api/*` responses include the `X-API-Version` header indicating which
version served the request:

```
X-API-Version: 1
```

### Optional Request Header

Clients MAY request a specific version using the `Accept-Version` header. If the
path includes a version (e.g. `/api/v1/`), the path version takes precedence:

```
Accept-Version: 1
```

## Version Lifecycle

| Status       | Meaning                                                        |
| ------------ | -------------------------------------------------------------- |
| `active`     | Current version. Fully supported, receives new features.       |
| `deprecated` | Still functional but no new features. Sunset date announced.   |
| `sunset`     | No longer available. Returns 410 Gone with migration guidance. |
| `retired`    | Removed from the codebase. No response served.                 |

## Deprecation Process

When a new major version is released:

1. **Announcement**: The previous version is marked `deprecated` with a
   `Deprecation` response header (IETF draft format) and a `Sunset` header
   indicating the removal date.
2. **Notice Period**: Minimum **6 months** between deprecation announcement and
   removal.
3. **Migration Guide**: A migration guide is published at
   `/docs/api/migration/v{N}-to-v{N+1}`.
4. **Monitoring**: Usage of deprecated endpoints is tracked. If significant
   traffic remains 30 days before sunset, the sunset date is extended by 3
   months.
5. **Sunset**: After the sunset date, the endpoint returns `410 Gone` with a
   JSON body containing the migration guide URL and replacement version.

### Deprecation Headers

```
Deprecation: true
Sunset: Wed, 31 Jan 2027 00:00:00 GMT
X-API-Replacement-Version: 2
```

## Backward Compatibility

### Compatible Changes (No Version Bump)

- Adding new optional parameters to existing endpoints
- Adding new fields to response objects (clients must ignore unknown fields)
- Adding new endpoints
- Changing error message text (not status codes)
- Performance improvements

### Breaking Changes (Requires Version Bump)

- Removing or renaming existing fields
- Changing field types
- Removing endpoints
- Changing required parameters
- Changing authentication requirements
- Changing error status codes
- Changing default behavior

## Three Backend Surfaces

| Surface         | Technology | Versioning Applied                       |
| --------------- | ---------- | ---------------------------------------- |
| Primary API     | Astro/TS   | URL path + `X-API-Version` header        |
| Backend service | FastAPI    | `X-API-Version` header via middleware    |
| AI services     | Flask      | `X-API-Version` header via after_request |

All three surfaces report the same `X-API-Version` value.

## Current Version

**API Version: 1** (active since July 2026)

## Versioning in OpenAPI Specs

All OpenAPI 3.1 specifications include the `X-API-Version` in the `info`
section:

```yaml
info:
  title: Pixelated Empathy API
  version: 1.0.0
  x-api-version: 1
```
