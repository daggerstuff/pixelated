#!/usr/bin/env python3
"""
PIX-30 Phase A.3: CORE Open Access Text Mining.

Pulls full-text open access psychology/psychiatry papers from CORE.
Requires API key (set via CORE_API_KEY env var or --api-key flag).

Target: 25K+ full-text papers.

Usage:
    uv run python scripts/data/pull_core.py --limit 25000
    uv run python scripts/data/pull_core.py --api-key YOUR_KEY --output data/raw/core/
"""

import argparse
import json
import logging
import os
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from pix30_utils import build_record, write_record

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("core")

CORE_API = "https://api.core.ac.uk/v3"
SEARCH_QUERY = (
    'q=subject:"psychology" OR subject:"psychiatry" OR subject:"mental health"'
    "&hasFullText=true"
    "&limit=100"
    "&orderBy=relevance"
)


def _search(api_key: str, offset: int = 0) -> dict:
    """Search CORE for psychology/psychiatry papers."""
    url = f"{CORE_API}/search/works?{SEARCH_QUERY}&offset={offset}"
    req = Request(url, headers={"Authorization": f"Bearer {api_key}"})
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except (HTTPError, Exception) as e:
        logger.warning("CORE search error: %s", e)
        return {}


def _get_fulltext(api_key: str, work_id: str, max_retries: int = 3) -> str:
    """Get full text for a CORE work with exponential backoff retry."""
    url = f"{CORE_API}/works/{work_id}/fullText"
    req = Request(url, headers={"Authorization": f"Bearer {api_key}"})
    for attempt in range(max_retries):
        try:
            with urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                return data.get("fullText", "")
        except (HTTPError, Exception) as e:
            if attempt < max_retries - 1:
                delay = 2**attempt
                logger.warning(
                    "CORE fulltext retry %d/%d for %s: %s", attempt + 1, max_retries, work_id, e
                )
                time.sleep(delay)
            else:
                logger.warning(
                    "CORE fulltext failed for %s after %d retries: %s", work_id, max_retries, e
                )
    return ""


def pull_papers(output_dir: Path, api_key: str, limit: int) -> int:
    """Pull full-text papers from CORE."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "papers.jsonl"
    count = 0
    offset = 0

    logger.info("Pulling up to %d full-text papers from CORE...", limit)

    while count < limit:
        data = _search(api_key, offset=offset)
        results = data.get("results", [])
        if not results:
            break

        logger.info("Offset %d: %d results", offset, len(results))

        for work in results:
            if count >= limit:
                break

            work_id = work.get("id", "")
            full_text = _get_fulltext(api_key, work_id)
            if not full_text:
                continue

            record = build_record(
                source="core",
                doc_id=work_id,
                content_type="academic",
                text=full_text[:50000],
                metadata={
                    "title": work.get("title", ""),
                    "abstract": work.get("abstract", ""),
                    "authors": [a.get("name", "") for a in work.get("authors", [])],
                    "doi": work.get("doi", ""),
                    "publication_date": work.get("publishedDate", ""),
                    "journal": work.get("publishedIn", ""),
                    "mesh_terms": work.get("subjects", []),
                    "topic_tags": ["psychology", "psychiatry", "mental_health"],
                    "therapeutic_modality": "N/A",
                    "quality_score": 0.8,
                    "core_id": work_id,
                    "source_repository": work.get("source", ""),
                    "license": work.get("license", ""),
                },
                license=work.get("license", "unknown"),
                license_verified=bool(work.get("license")),
            )

            write_record(output_file, record)
            count += 1
            time.sleep(0.5)

        offset += len(results)
        if offset >= data.get("totalHits", 0):
            break

    logger.info("Done: %d papers written to %s", count, output_file)
    return count


def main():
    parser = argparse.ArgumentParser(description="PIX-30: CORE Open Access Text Mining")
    parser.add_argument("--api-key", default=os.environ.get("CORE_API_KEY", ""))
    parser.add_argument("--limit", type=int, default=25000, help="Max papers to pull")
    parser.add_argument("--output", type=Path, default=Path("data/raw/core/"))
    args = parser.parse_args()

    if not args.api_key:
        logger.error("CORE API key required. Set CORE_API_KEY env var or use --api-key")
        return 1

    logger.info("PIX-30 Phase A.3: CORE Open Access Text Mining")
    logger.info("  Limit: %d", args.limit)
    logger.info("  Output: %s", args.output)

    count = pull_papers(args.output, args.api_key, args.limit)
    logger.info("Summary: %d full-text papers", count)
    return 0 if count > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
