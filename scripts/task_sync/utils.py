"""Utility helpers for task sync providers."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from urllib import request
from urllib.error import HTTPError


class _ObjectView:
    def __init__(self, payload: Mapping[str, Any]):
        self._payload = payload

    def __getattr__(self, name: str) -> Any:
        return self._payload.get(name)

def _object_view(payload: Mapping[str, Any]) -> _ObjectView:
    return _ObjectView(payload)

def _json_request(
    method: str,
    url: str,
    *,
    headers: Mapping[str, str],
    payload: Mapping[str, Any] | None = None,
) -> Any:
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers=dict(headers), method=method)
    try:
        with request.urlopen(req) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        with exc:
            error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed with HTTP {exc.code}: {error_body}") from exc
    except Exception as exc:
        raise RuntimeError(f"{method} {url} failed: {exc}") from exc
    if not body:
        return {}
    return json.loads(body)
