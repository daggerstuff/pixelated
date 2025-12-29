"""Produce a Release 0 coverage matrix by inspecting the canonical S3 bucket."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


@dataclass
class CoverageFamily:
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
    env_data = {}
    path = Path(env_path)
    if not path.exists():
        raise FileNotFoundError(f"Missing environment file at {path}")

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


def create_s3_client(env: Mapping[str, str]) -> boto3.client:
    endpoint = env.get("OVH_S3_ENDPOINT")
    access_key = env.get("OVH_S3_ACCESS_KEY")
    secret = env.get("OVH_S3_SECRET_KEY")

    if not all((endpoint, access_key, secret)):
        raise ValueError(
            "OVH_S3_ENDPOINT, OVH_S3_ACCESS_KEY, and OVH_S3_SECRET_KEY must be provided in .env"
        )

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret,
    )


def list_objects(
    client: boto3.client, bucket: str, prefix: str, max_keys: int = 25
) -> Sequence[str]:
    try:
        response = client.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=max_keys)
    except ClientError as exc:
        raise RuntimeError(f"Failed to list {prefix}: {exc}") from exc

    contents = response.get("Contents", [])
    return [obj["Key"] for obj in contents]


def classify_status(count: int) -> str:
    if count == 0:
        return "missing"
    return "partial" if count < 3 else "present"


def build_coverage_report(bucket: str, client: boto3.client) -> Sequence[dict]:
    report = []
    for family in FAMILIES:
        all_keys: list[str] = []
        errors: list[str] = []

        for prefix in family.prefixes:
            try:
                keys = list_objects(client, bucket, prefix, max_keys=25)
                all_keys.extend(keys)
            except RuntimeError as exc:
                errors.append(f"{prefix}: {exc}")

        status = (
            classify_status(len(all_keys))
            if not errors
            else ("error" if len(all_keys) == 0 else classify_status(len(all_keys)))
        )
        samples = (all_keys or errors)[:10]

        report.append(
            {
                "stage": family.stage,
                "name": family.name,
                "prefixes": list(family.prefixes),
                "status": status,
                "sample_keys": samples,
                "description": family.description,
            }
        )
    return report


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
        lines.append(
            f"| {entry['stage']} | {entry['name']} | {prefixes_display} | {entry['status']} | {sample_display} | {notes} |"
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n".join(lines) + "\n")


def main() -> None:
    env = load_env(Path(".env"))
    bucket = env.get("OVH_S3_BUCKET", "pixel-data")
    client = create_s3_client(env)
    report = build_coverage_report(bucket, client)
    destination = Path("docs/tracking/mental-health-datasets-expansion-release-0.coverage.md")
    dump_markdown(report, destination)


if __name__ == "__main__":
    main()
