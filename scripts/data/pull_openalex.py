#!/usr/bin/env python3
"""
PIX-30 Phase A.6: OpenAlex Metadata Sync.

Pulls metadata for psychology/psychiatry papers from OpenAlex for
literature discovery and source identification.

Target: 10K paper records.

Usage:
    uv run python scripts/data/pull_openalex.py --limit 10000
    uv run python scripts/data/pull_openalex.py --output data/raw/openalex/
"""

import argparse
import json
import logging
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import urlopen

from pix30_utils import build_record, write_record

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("openalex")

OPENALEX_API = "https://api.openalex.org/works"
SEARCH_FILTER = (
    "topics.display_name:Psychology|"
    "topics.display_name:Psychiatry|"
    "topics.display_name:Mental%20health|"
    "topics.display_name:Clinical%20psychology"
)


def _fetch(url: str) -> dict:
    """Fetch data from OpenAlex API."""
    try:
        with urlopen(url, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except (HTTPError, Exception) as e:
        logger.warning("OpenAlex API error: %s", e)
        return {}


def pull_metadata(output_dir: Path, limit: int) -> int:
    """Pull paper metadata from OpenAlex."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "metadata.jsonl"
    count = 0
    cursor = "*"

    logger.info("Pulling up to %d paper records from OpenAlex...", limit)

    while count < limit:
        url = (
            f"{OPENALEX_API}?"
            f"filter={SEARCH_FILTER}"
            f"&per_page=200"
            f"&cursor={quote(cursor)}"
            f"&select=id,title,abstract_inverted_index,authorships,primary_location,"
            f"publication_date,primary_topic,keywords_concepts,type"
        )
        data = _fetch(url)
        results = data.get("results", [])
        if not results:
            break

        meta = data.get("meta", {})
        cursor = meta.get("next_cursor", "")

        logger.info("Cursor %s: %d results", cursor[:20] if cursor else "start", len(results))

        for work in results:
            if count >= limit:
                break

            work_id = work.get("id", "").split("/")[-1]
            if not work_id:
                continue

            authors = [
                a.get("author", {}).get("display_name", "") for a in work.get("authorships", [])
            ]

            primary_topic = work.get("primary_topic", {})
            keywords = [kw.get("display_name", "") for kw in work.get("keywords_concepts", [])[:10]]

            record = build_record(
                source="openalex",
                doc_id=work_id,
                content_type="metadata",
                text="",
                metadata={
                    "title": work.get("title", ""),
                    "abstract": "",
                    "authors": authors,
                    "doi": work.get("doi", "").replace("https://doi.org/", "")
                    if work.get("doi")
                    else "",
                    "publication_date": work.get("publication_date", ""),
                    "journal": work.get("primary_location", {})
                    .get("source", {})
                    .get("display_name", "")
                    if work.get("primary_location")
                    else "",
                    "mesh_terms": keywords,
                    "topic_tags": ["psychology", "psychiatry", "metadata"],
                    "therapeutic_modality": "N/A",
                    "quality_score": 0.7,
                    "openalex_id": work_id,
                    "primary_topic": primary_topic.get("display_name", ""),
                    "keywords": keywords,
                    "work_type": work.get("type", ""),
                },
                license_str="unknown",
                license_verified=False,
            )

            write_record(output_file, record)
            count += 1

        if not cursor:
            break

        time.sleep(0.1)

    logger.info("Done: %d records written to %s", count, output_file)
    return count


def main():
    parser = argparse.ArgumentParser(description="PIX-30: OpenAlex Metadata Sync")
    parser.add_argument("--limit", type=int, default=10000, help="Max records to pull")
    parser.add_argument("--output", type=Path, default=Path("data/raw/openalex/"))
    args = parser.parse_args()

    logger.info("PIX-30 Phase A.6: OpenAlex Metadata Sync")
    logger.info("  Limit: %d", args.limit)
    logger.info("  Output: %s", args.output)

    count = pull_metadata(args.output, args.limit)
    logger.info("Summary: %d metadata records", count)
    return 0 if count > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
