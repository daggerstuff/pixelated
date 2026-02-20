#!/usr/bin/env python3
"""
Generate Edge Cases for PIX-8 Dataset Enhancement

Generates 75K edge cases including 25K 'Nightmare Fuel' extreme scenarios
using NeMo Data Designer's EdgeCaseGenerator.

Target breakdown:
- 25K Nightmare Fuel (extreme scenarios)
- 50K Standard edge cases (crisis, cultural complexity, comorbidity, etc.)

Output: s3://pixel-data/edge_cases/pix8/
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Load .env before any imports that need it
from dotenv import load_dotenv

# Add ai module to path - must be done before importing ai modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.edge_case_generator import EdgeCaseGenerator, EdgeCaseType

load_dotenv()

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class PIX8EdgeCaseGenerator:
    """Generate edge cases for PIX-8 dataset enhancement."""

    def __init__(self, output_dir: Path | None = None):
        """
        Initialize the edge case generator.

        Args:
            output_dir: Local output directory for generated edge cases
        """
        self.output_dir = output_dir or Path("ai/training_ready/data/generated/pix8_edge_cases")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.generator = EdgeCaseGenerator()

        logger.info("Initialized PIX-8 edge case generator")
        logger.info(f"Output directory: {self.output_dir}")

    def _get_nightmare_distribution(self, num_samples: int) -> list[tuple[EdgeCaseType, int]]:
        """Determine the distribution of edge cases."""
        if num_samples < 100:
            return [
                (EdgeCaseType.CRISIS, num_samples),
                (EdgeCaseType.TRAUMA_DISCLOSURE, num_samples),
                (EdgeCaseType.ETHICAL_DILEMMA, num_samples),
                (EdgeCaseType.BOUNDARY_VIOLATION, num_samples),
            ]

        return [
            (EdgeCaseType.CRISIS, 8000),
            (EdgeCaseType.TRAUMA_DISCLOSURE, 7000),
            (EdgeCaseType.ETHICAL_DILEMMA, 5000),
            (EdgeCaseType.BOUNDARY_VIOLATION, 5000),
        ]

    def _generate_categorical_batch(
        self,
        edge_type: EdgeCaseType,
        target_count: int,
        difficulty: str,
        category_tag: str,
        is_nightmare: bool = False,
    ) -> list[dict[str, Any]]:
        """Generate a batch of scenarios for a specific category."""
        results = []
        generated_so_far = 0
        retries = 0
        max_retries = 5

        while generated_so_far < target_count and retries < max_retries:
            needed = target_count - generated_so_far
            request_count = min(needed + 50, 2000)

            try:
                result = self.generator.generate_edge_case_dataset(
                    edge_case_type=edge_type,
                    num_samples=request_count,
                    difficulty_level=difficulty,
                )

                if result and "data" in result:
                    records = result["data"]
                    for record in records:
                        if "metadata" not in record:
                            record["metadata"] = {}
                        record["metadata"]["difficulty"] = difficulty
                        record["metadata"]["pix8_category"] = category_tag
                        if is_nightmare:
                            record["metadata"]["nightmare_fuel"] = True

                    to_take = min(len(records), needed)
                    records = records[:to_take]
                    results.extend(records)
                    generated_so_far += len(records)

                    logger.info(
                        f"    ✅ Batch {retries + 1}: +{len(records)} {edge_type.value} scenarios. ({generated_so_far}/{target_count})"
                    )
                else:
                    logger.warning(f"    ⚠️ Empty result for {edge_type.value}.")
            except Exception as e:
                logger.error(f"    ❌ Error generating {edge_type.value}: {e}")

            retries += 1

        return results

    def generate_nightmare_fuel(self, num_samples: int = 25000) -> dict[str, Any]:
        """Generate 'Nightmare Fuel' extreme edge cases."""
        logger.info(f"Generating {num_samples:,} Nightmare Fuel scenarios...")
        nightmare_types = self._get_nightmare_distribution(num_samples)

        all_records = []
        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "nightmare_fuel",
            "total_generated": 0,
            "by_type": {},
        }

        use_default_dist = num_samples == 25000 or num_samples < 100

        for edge_type, dist_target in nightmare_types:
            target = dist_target if use_default_dist else num_samples // len(nightmare_types)

            records = self._generate_categorical_batch(
                edge_type=edge_type,
                target_count=target,
                difficulty="extreme",
                category_tag="nightmare_fuel",
                is_nightmare=True,
            )
            self._add_generated_records(all_records, records, stats, edge_type)
        return self._save_records(
            filename="nightmare_fuel.jsonl",
            all_records=all_records,
            log_message=" Nightmare Fuel scenarios to ",
            stats=stats,
        )

    def generate_standard_edge_cases(self, num_samples: int = 50000) -> dict[str, Any]:
        """Generate standard edge cases across various categories."""
        logger.info(f"Generating {num_samples:,} Standard (Mid-Darkness) Edge Cases...")
        count_per_type = num_samples if num_samples < 100 else num_samples // 5

        standard_types = [
            EdgeCaseType.CULTURAL_COMPLEXITY,
            EdgeCaseType.COMORBIDITY,
            EdgeCaseType.SUBSTANCE_ABUSE,
            EdgeCaseType.RARE_DIAGNOSIS,
            EdgeCaseType.SYSTEMIC_OPPRESSION,
        ]

        all_records = []
        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "standard_edge_cases",
            "total_generated": 0,
            "by_type": {},
        }

        for edge_type in standard_types:
            records = self._generate_categorical_batch(
                edge_type=edge_type,
                target_count=count_per_type,
                difficulty="advanced",
                category_tag="standard_mid_darkness",
            )
            self._add_generated_records(all_records, records, stats, edge_type)
        return self._save_records(
            filename="standard_edge_cases.jsonl",
            all_records=all_records,
            log_message=" Standard Edge Cases to ",
            stats=stats,
        )

    def _add_generated_records(self, all_records, records, stats, edge_type):
        all_records.extend(records)
        stats["by_type"][edge_type.value] = len(records)
        stats["total_generated"] += len(records)

    def _save_records(
        self,
        filename: str,
        all_records: list[dict[str, Any]],
        log_message: str,
        stats: dict[str, Any],
    ) -> dict[str, Any]:
        """Save generated edge cases to file and return stats."""
        output_file = self.output_dir / filename
        with open(output_file, "w") as f:
            for record in all_records:
                f.write(json.dumps(record) + "\n")
        logger.info(f"✅ Saved {len(all_records):,}{log_message}{output_file}")
        return stats

    def generate_all(self) -> dict[str, Any]:
        """
        Generate all edge cases for PIX-8.

        Total: 75K edge cases
        - 25K Nightmare Fuel
        - 50K Standard edge cases

        Returns:
            Aggregate statistics
        """
        logger.info("=" * 80)
        logger.info("PIX-8 EDGE CASE GENERATION")
        logger.info("=" * 80)
        logger.info("Target: 75K total edge cases")
        logger.info("  - 25K Nightmare Fuel (extreme scenarios)")
        logger.info("  - 50K Standard edge cases")
        logger.info("=" * 80)

        # Generate nightmare fuel
        nightmare_stats = self.generate_nightmare_fuel(num_samples=25000)

        # Generate standard edge cases
        standard_stats = self.generate_standard_edge_cases(num_samples=50000)

        # Aggregate statistics
        total_actual = nightmare_stats["total_generated"] + standard_stats["total_generated"]
        aggregate_stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pix8_task": "edge_case_generation",
            "target_total": 75000,
            "actual_total": total_actual,
            "nightmare_fuel": nightmare_stats,
            "standard_edge_cases": standard_stats,
        }

        # Save aggregate statistics
        stats_file = self.output_dir / "pix8_edge_cases_stats.json"
        with open(stats_file, "w") as f:
            json.dump(aggregate_stats, f, indent=2)

        logger.info("\n" + "=" * 80)
        logger.info("📊 PIX-8 EDGE CASE GENERATION SUMMARY")
        logger.info("=" * 80)
        logger.info(
            f"Total generated: {aggregate_stats['actual_total']:,} / {aggregate_stats['target_total']:,}"
        )
        logger.info(f"Nightmare Fuel: {nightmare_stats['total_generated']:,}")
        logger.info(f"Standard Edge Cases: {standard_stats['total_generated']:,}")
        logger.info(f"\n💾 Statistics saved: {stats_file}")
        logger.info("=" * 80)

        return aggregate_stats


def main():
    """Run PIX-8 edge case generation."""
    parser = argparse.ArgumentParser(
        description="Generate edge cases for PIX-8 dataset enhancement"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ai/training_ready/data/generated/pix8_edge_cases"),
        help="Output directory for generated edge cases",
    )
    parser.add_argument(
        "--nightmare-only", action="store_true", help="Generate only Nightmare Fuel scenarios"
    )
    parser.add_argument(
        "--standard-only", action="store_true", help="Generate only standard edge cases"
    )

    parser.add_argument(
        "--limit", type=int, help="Limit number of samples per category (for testing)"
    )

    args = parser.parse_args()

    generator = PIX8EdgeCaseGenerator(output_dir=args.output_dir)

    limit_count = args.limit or 25000
    standard_limit = args.limit or 50000

    if args.nightmare_only:
        generator.generate_nightmare_fuel(num_samples=limit_count)
    elif args.standard_only:
        generator.generate_standard_edge_cases(num_samples=standard_limit)
    elif args.limit:
        generator.generate_nightmare_fuel(num_samples=args.limit)
        generator.generate_standard_edge_cases(num_samples=args.limit)
    else:
        generator.generate_all()

    logger.info("\n✅ PIX-8 edge case generation complete!")

    return 0


if __name__ == "__main__":
    sys.exit(main())
