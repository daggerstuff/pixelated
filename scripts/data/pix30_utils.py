"""
Shared utilities for PIX-30 data pull scripts.

Provides common patterns: JSONL writing, record construction, pagination,
rate limiting, and output directory management.
"""

import json
import logging
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("pix30_utils")


def ensure_output_dir(output_dir: Path) -> Path:
    """Create output directory if it doesn't exist."""
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def write_record(output_file: Path, record: dict[str, Any]) -> None:
    """Append a single JSONL record to a file."""
    with output_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def build_record(
    source: str,
    doc_id: str,
    content_type: str,
    text: str,
    metadata: dict[str, Any],
    **kwargs: Any,
) -> dict[str, Any]:
    """Build a canonical PIX-30 JSONL record.

    Required args: source, doc_id, content_type, text, metadata
    Optional kwargs: license, license_verified, phi_scan_passed, pull_date, pix_ticket
    """
    return {
        "id": f"{source}_{doc_id}",
        "source": source,
        "content_type": content_type,
        "text": text,
        "metadata": metadata,
        "license": kwargs.get("license", "unknown"),
        "license_verified": kwargs.get("license_verified", False),
        "phi_scan_passed": kwargs.get("phi_scan_passed", True),
        "pull_date": kwargs.get("pull_date", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        "pix_ticket": kwargs.get("pix_ticket", "PIX-30"),
    }


def rate_limited_iter(items, delay: float = 0.34):
    """Yield items with rate limiting."""
    for item in items:
        yield item
        time.sleep(delay)
