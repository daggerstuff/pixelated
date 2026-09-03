---
name: api-testing
description: ""
---

# API Testing

## Rules

- Write integration tests with **pytest** and **httpx** for async APIs.
- Mock external services at the HTTP boundary, not inside business logic.
- Assert status code, response schema, and at least one business invariant per endpoint.
- Use `pytest.mark.parametrize` for matrix cases (auth, validation errors, happy path).
- Name tests: `test_<endpoint>_<scenario>`.

## Workflow

1. Read OpenAPI spec or route list from the repo.
2. Identify auth mechanism (Bearer, API key, cookie).
3. Add fixtures for client, auth headers, and test database state.
4. Run `pytest tests/api -v` before marking work complete.

## Examples

```python
import httpx
import pytest

@pytest.mark.asyncio
async def test_health_returns_200(api_client: httpx.AsyncClient):
    response = await api_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

## Background

Contract tests catch regressions when handlers change. Prefer testing through the
public HTTP interface rather than calling FastAPI route functions directly.
