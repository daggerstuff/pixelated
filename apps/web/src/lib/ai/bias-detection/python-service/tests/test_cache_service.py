#!/usr/bin/env python3
"""Tests for cache service credential-safe logging helpers."""

from bias_detection.services.cache_service import _redis_url_without_credentials


def test_redis_url_without_credentials_strips_userinfo_path_and_query() -> None:
    url = "redis://:secret@example.com:6380/0?password=hunter2"

    assert _redis_url_without_credentials(url) == "redis://example.com:6380"


def test_redis_url_without_credentials_handles_missing_port() -> None:
    assert _redis_url_without_credentials("redis://cache.internal/2") == "redis://cache.internal"
    assert _redis_url_without_credentials("rediss://cache.internal:6380") == "rediss://cache.internal:6380"


def test_redis_url_without_credentials_rejects_invalid_url() -> None:
    assert _redis_url_without_credentials("redis://host:not-a-port") == "<invalid redis url>"
    assert _redis_url_without_credentials("redis://") == "<invalid redis url>"
