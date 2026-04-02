#!/usr/bin/env python3
"""
PIX-30 Phase A.4: ClinicalTrials.gov Results.

Pulls trial protocols, outcome measures, and therapeutic intervention
data from ClinicalTrials.gov.

Target: 1K+ trial records related to mental health/psychiatry.

Usage:
    uv run python scripts/data/pull_clinical_trials.py --limit 1000
    uv run python scripts/data/pull_clinical_trials.py --output data/raw/clinical_trials/
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).parent))
from pix30_utils import build_record, write_record

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("clinical_trials")

CLINICALTRIALS_API = "https://clinicaltrials.gov/api/v2/studies"
SEARCH_PARAMS = {
    "query.cond": "mental health OR psychotherapy OR psychiatry OR depression OR anxiety",
    "countTotal": "true",
    "pageSize": "1000",
    "format": "json",
}


def _fetch_studies(params: dict) -> dict:
    """Fetch studies from ClinicalTrials.gov API."""
    url = f"{CLINICALTRIALS_API}?{urlencode(params)}"
    try:
        with urlopen(url, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except (HTTPError, Exception) as e:
        logger.warning("ClinicalTrials.gov API error: %s", e)
        return {}


def pull_trials(output_dir: Path, limit: int) -> int:
    """Pull trial records from ClinicalTrials.gov."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "trials.jsonl"
    count = 0

    logger.info("Pulling up to %d trial records from ClinicalTrials.gov...", limit)

    data = _fetch_studies(SEARCH_PARAMS)
    studies = data.get("studies", [])
    total = data.get("totalCount", 0)

    logger.info("Found %d total trials, pulling up to %d...", total, limit)

    for study in studies:
        if count >= limit:
            break

        protocol = study.get("protocolSection", {})
        identification = protocol.get("identificationModule", {})
        conditions = protocol.get("conditionsModule", {})
        interventions = protocol.get("armsInterventionsModule", {}).get("interventions", [])
        outcomes = protocol.get("outcomesModule", {}).get("primaryOutcomes", [])

        nct_id = identification.get("nctId", "")
        if not nct_id:
            continue

        record = build_record(
            source="clinicaltrials.gov",
            doc_id=nct_id,
            content_type="academic",
            text=json.dumps(
                {
                    "brief_summary": protocol.get("descriptionModule", {}).get("briefSummary", ""),
                    "detailed_description": protocol.get("descriptionModule", {}).get(
                        "detailedDescription", ""
                    ),
                }
            ),
            metadata={
                "title": identification.get("briefTitle", ""),
                "abstract": protocol.get("descriptionModule", {}).get("briefSummary", ""),
                "authors": [],
                "doi": "",
                "publication_date": identification.get("startDateStruct", {}).get("date", ""),
                "journal": "ClinicalTrials.gov",
                "mesh_terms": conditions.get("conditions", []),
                "topic_tags": ["clinical_trial", "mental_health", "psychiatry"],
                "therapeutic_modality": "N/A",
                "quality_score": 0.9,
                "nct_id": nct_id,
                "conditions": conditions.get("conditions", []),
                "interventions": [
                    {
                        "type": i.get("type", ""),
                        "name": i.get("name", ""),
                        "description": i.get("description", ""),
                    }
                    for i in interventions
                ],
                "primary_outcomes": [o.get("measure", "") for o in outcomes],
                "status": protocol.get("statusModule", {}).get("overallStatus", ""),
                "phase": protocol.get("designModule", {}).get("phases", []),
                "enrollment": protocol.get("designModule", {})
                .get("enrollmentInfo", {})
                .get("count", 0),
            },
            license="public_domain",
            license_verified=True,
        )

        write_record(output_file, record)
        count += 1

    logger.info("Done: %d trials written to %s", count, output_file)
    return count


def main():
    parser = argparse.ArgumentParser(description="PIX-30: ClinicalTrials.gov Results")
    parser.add_argument("--limit", type=int, default=1000, help="Max trials to pull")
    parser.add_argument("--output", type=Path, default=Path("data/raw/clinical_trials/"))
    args = parser.parse_args()

    logger.info("PIX-30 Phase A.4: ClinicalTrials.gov Results")
    logger.info("  Limit: %d", args.limit)
    logger.info("  Output: %s", args.output)

    count = pull_trials(args.output, args.limit)
    logger.info("Summary: %d trial records", count)
    return 0 if count > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
