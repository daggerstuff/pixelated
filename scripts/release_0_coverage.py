"""Produce a Release 0 coverage matrix by inspecting the canonical S3 bucket."""

from __future__ import annotations

import os
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError


@dataclass
class CoverageFamily:
    """Represents a family of S3 prefixes for coverage analysis.

    Attributes:
        stage: The maturity stage of the dataset (e.g., "Stage 1 — Foundation").
        name: The human-readable name of the dataset family.
        prefixes: List of S3 key prefixes to scan for coverage.
        description: Detailed description of the dataset family's purpose and content.
    """

    stage: str
    name: str
    prefixes: Sequence[str]
    description: str


FAMILIES: Sequence[CoverageFamily] = [
    CoverageFamily(
        stage="Stage 1 — Foundation",
        name="Therapeutic dialogues (canonical or consolidated)",
        prefixes=(
            "gdrive/processed/professional_therapeutic/",
            "datasets/consolidated/conversations/",
        ),
        description="High-quality therapeutic conversations and consolidated conversation exports.",
    ),
    CoverageFamily(
        stage="Stage 1 — Foundation",
        name="Priority datasets",
        prefixes=(
            "gdrive/processed/priority/",
            "datasets/training_v2/priority/",
            "datasets/training_v3/priority/",
        ),
        description="Priority JSONL exports referenced by curriculum routing.",
    ),
    CoverageFamily(
        stage="Stage 2 — Therapeutic expertise",
        name="Chain-of-thought reasoning",
        prefixes=(
            "gdrive/processed/cot_reasoning/",
            "datasets/training_v2/cot_reasoning/",
            "datasets/training_v3/cot_reasoning/",
        ),
        description="Clinical reasoning examples (CoT) used for expertise stage.",
    ),
    CoverageFamily(
        stage="Stage 3 — Edge stress test",
        name="Edge/case datasets",
        prefixes=(
            "gdrive/processed/edge_cases/",
            "edge_cases/",
            "datasets/consolidated/conversations/",
        ),
        description="Processed crisis and edge-case scenarios (including consolidated edge_case_dialogues).",
    ),
    CoverageFamily(
        stage="Stage 4 — Voice/persona",
        name="Voice persona assets",
        prefixes=(
            "voice/",
            "datasets/training_v3/voice/",
        ),
        description="Tim Fletcher + synthetic voice persona files.",
    ),
]


def load_env(env_path: Path | str = Path(".env")) -> Mapping[str, str]:
    """Load environment variables from a .env file.

    Args:
        env_path: Path to the .env file. Defaults to ".env".

    Returns:
        Dictionary of environment variables with keys and values as strings.
        If the .env file does not exist, returns a copy of os.environ.
    """
    path = Path(env_path)
    if not path.exists():
        return os.environ.copy()

    env_data = {}
    with path.open() as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            env_data[key.strip()] = value.strip().strip('"')
    return env_data


def create_s3_client(env: Mapping[str, str]) -> Any:
    """Create an S3 client using credentials from environment or .env file.

    Args:
        env: Dictionary of environment variables loaded from .env file.

    Returns:
        boto3 S3 client configured with OVH credentials.

    Raises:
        ValueError: If any of the required S3 credentials are missing.
    """
    endpoint = env.get("OVH_S3_ENDPOINT")
    access_key = env.get("OVH_S3_ACCESS_KEY")
    secret = env.get("OVH_S3_SECRET_KEY")

    # Prefer environment variables over .env file for CI/CD compatibility
    if not endpoint:
        endpoint = os.environ.get("OVH_S3_ENDPOINT")
    if not access_key:
        access_key = os.environ.get("OVH_S3_ACCESS_KEY")
    if not secret:
        secret = os.environ.get("OVH_S3_SECRET_KEY")

    if not all((endpoint, access_key, secret)):
        raise ValueError(
            "OVH_S3_ENDPOINT, OVH_S3_ACCESS_KEY, and OVH_S3_SECRET_KEY must be provided as environment variables or in .env"
        )

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret,
    )


def list_objects(client: Any, bucket: str, prefix: str, max_keys: int = 25) -> Sequence[str]:
    """List objects under prefix, returning up to max_keys sample keys."""
    try:
        paginator = client.get_paginator("list_objects_v2")
        keys: list[str] = []
        for page in paginator.paginate(
            Bucket=bucket, Prefix=prefix, PaginationConfig={"MaxItems": max_keys}
        ):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])
                if len(keys) >= max_keys:
                    return keys
        return keys
    except ClientError as exc:
        raise RuntimeError(f"Failed to list {prefix}: {exc}") from exc


def classify_status(count: int) -> str:
    """Classify coverage status based on number of objects found.

    Args:
        count: Number of S3 objects found under a prefix.

    Returns:
        One of: "missing" (0 objects), "partial" (1-2 objects), or "present" (3+ objects).
    """
    if count == 0:
        return "missing"
    return "partial" if count < 3 else "present"


def build_coverage_report(bucket: str, client: Any) -> Sequence[dict]:
    """Build a coverage report by scanning S3 prefixes for dataset families.

    Args:
        bucket: Name of the S3 bucket to scan.
        client: boto3 S3 client configured with credentials.

    Returns:
        List of dictionaries, each representing a dataset family with:
            - stage: maturity stage
            - name: family name
            - prefixes: list of S3 prefixes scanned
            - status: "missing", "partial", "present", "error", or "partial_with_errors"
            - sample_keys: up to 10 sample S3 keys found
            - description: original description with appended errors if any
    """
    report: list[dict] = []
    for family in FAMILIES:
        all_keys: list[str] = []
        errors: list[str] = []

        for prefix in family.prefixes:
            try:
                keys = list_objects(client, bucket, prefix, max_keys=25)
                all_keys.extend(keys)
            except RuntimeError as exc:
                errors.append(f"{prefix}: {exc}")

        # If there are errors and no keys, status is "error"
        # If there are errors and some keys, status is "partial_with_errors"
        # Otherwise use normal classification
        if errors:
            status = "partial_with_errors" if all_keys else "error"
        else:
            status = classify_status(len(all_keys))

        # Always show sample keys from actual keys, not errors
        # Show errors in the description field
        samples = all_keys[:10] if all_keys else []
        description = family.description
        if errors:
            description += f" (Errors: {', '.join(errors)})"

        report.append(
            {
                "stage": family.stage,
                "name": family.name,
                "prefixes": list(family.prefixes),
                "status": status,
                "sample_keys": samples,
                "description": description,
            }
        )
    return report


def escape_markdown_cell(value: str) -> str:
    """Escape pipe characters and newlines for markdown table cells."""
    return value.replace("|", "\\|").replace("\n", " ").replace("\r", " ")


def dump_markdown(report: Sequence[dict], destination: Path) -> None:
    lines = [
        "# Release 0 Coverage Matrix",
        "",
        "Generated coverage summary for the canonical Release 0 dataset families.",
        "",
        "| Stage | Dataset Family | Prefixes | Status | Sample keys | Notes |",
        "| --- | --- | --- | --- | --- | --- |",
    ]

    for entry in report:
        sample_display = ", ".join(entry["sample_keys"]) if entry["sample_keys"] else "(none)"
        notes = entry.get("description", "")
        prefixes_display = ", ".join(entry.get("prefixes", []))
        # Escape all fields to prevent markdown injection
        lines.append(
            f"| {escape_markdown_cell(str(entry['stage']))} | {escape_markdown_cell(entry['name'])} | {escape_markdown_cell(prefixes_display)} | {escape_markdown_cell(entry['status'])} | {escape_markdown_cell(sample_display)} | {escape_markdown_cell(notes)} |"
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n".join(lines) + "\n")


def main() -> None:
    """Script entry point for generating S3 coverage reports.

    Loads environment variables from .env file or OS environment,
    creates an S3 client using OVH credentials, builds a coverage
    report by scanning dataset families in the S3 bucket, and writes
    the results as a markdown file to docs/tracking.

    Args:
        None

    Returns:
        None

    Side Effects:
        Reads .env file from current directory
        Writes coverage report markdown file to docs/tracking/

    Raises:
        ValueError: If required S3 credentials are missing
        RuntimeError: If S3 operations fail
        OSError: If file operations fail
    """
    try:
        env = load_env(Path(".env"))
    except OSError:
        # Fallback to environment variables from OS when .env file is absent
        # or inaccessible in CI/CD environments
        env = os.environ.copy()
    bucket = env.get("OVH_S3_BUCKET", "pixel-data")
    client = create_s3_client(env)
    report = build_coverage_report(bucket, client)
    destination = Path("docs/tracking/mental-health-datasets-expansion-release-0.coverage.md")
    dump_markdown(report, destination)


if __name__ == "__main__":
    main()
