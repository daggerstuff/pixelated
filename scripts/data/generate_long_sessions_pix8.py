#!/usr/bin/env python3
"""
Generate Long-Running Therapy Sessions for PIX-8 Dataset Enhancement

Generates 200K long-running therapy sessions with minimum 20+ turns using:
1. Extraction from existing multi-turn datasets
2. NeMo Data Designer for synthetic session generation

Output: s3://pixel-data/long_sessions/pix8/
"""

import argparse
import json
import logging
import random
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.common.llm_client import LLMClient
from ai.pipelines.design.service import NeMoDataDesignerService

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class PIX8LongSessionGenerator:
    """Generate long-running therapy sessions for PIX-8 dataset enhancement."""

    def __init__(self, output_dir: Path | None = None, min_turns: int = 20):
        """
        Initialize the long session generator.

        Args:
            output_dir: Local output directory for generated sessions
            min_turns: Minimum number of turns to qualify as long-running
        """
        self.output_dir = output_dir or Path("ai/training_ready/data/generated/pix8_long_sessions")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.min_turns = min_turns
        # Use correct path relative to project root
        project_root = Path(__file__).resolve().parent.parent.parent
        self.extractor_script = (
            project_root / "ai/training/ready_packages/scripts/extract_long_running_therapy.py"
        )

        logger.info("Initialized PIX-8 long session generator")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Minimum turns: {self.min_turns}")

    def extract_from_existing_datasets(self, target_count: int = 100000) -> dict[str, Any]:
        """
        Extract long-running sessions from existing multi-turn datasets.

        Uses extract_long_running_therapy.py to scan S3 datasets for sessions
        with 20+ turns.

        Args:
            target_count: Target number of sessions to extract

        Returns:
            Statistics and metadata
        """
        logger.info("Extracting long-running sessions from existing datasets...")
        logger.info(f"Target: {target_count:,} sessions with ≥{self.min_turns} turns")

        output_file = self.output_dir / "extracted_long_sessions.jsonl"

        # Run extraction script with uv
        cmd = [
            "uv",
            "run",
            str(self.extractor_script),
            f"--min-turns={self.min_turns}",
            f"--output={output_file}",
            "--input-dir=s3://pixel-data/processed_ready/",
        ]

        logger.info(f"Running: {' '.join(cmd)}")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            logger.info("Extraction complete!")
            logger.info(result.stdout)

            # Count extracted sessions
            extracted_count = 0
            if output_file.exists():
                with open(output_file) as f:
                    extracted_count = sum(1 for _ in f)

            stats = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "method": "extraction",
                "source": "existing_datasets",
                "min_turns": self.min_turns,
                "extracted_count": extracted_count,
                "output_file": str(output_file),
            }

            logger.info(f"✅ Extracted {extracted_count:,} long-running sessions")

            return stats

        except subprocess.CalledProcessError as e:
            logger.error(f"Extraction failed: {e}")
            logger.error(f"stdout: {e.stdout}")
            logger.error(f"stderr: {e.stderr}")

            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "method": "extraction",
                "error": str(e),
                "extracted_count": 0,
            }

    def _generate_patient_profiles(
        self, target_count: int, designer: NeMoDataDesignerService
    ) -> list[dict[str, Any]]:
        """Internal method to generate patient profiles with retry logic."""
        max_retries = 5
        base_delay = 5
        patient_profiles = []

        for attempt in range(max_retries):
            try:
                # We generate slightly more than needed to handle potential generation failures
                profile_count = max(int(target_count * 1.1), 1)

                logger.info(
                    f"Attempt {attempt + 1}/{max_retries}: Requesting {profile_count} profiles..."
                )

                dataset_result = designer.generate_therapeutic_dataset(
                    num_samples=profile_count,
                    include_demographics=True,
                    include_symptoms=True,
                    include_treatments=True,
                    include_outcomes=True,
                )

                # Handle different return structures from NeMo service
                if isinstance(dataset_result, dict) and "data" in dataset_result:
                    data = dataset_result.get("data", [])
                elif hasattr(dataset_result, "data"):
                    data = getattr(dataset_result, "data", [])
                else:
                    data = dataset_result

                # Ensure it's a list
                if isinstance(data, list) and len(data) > 0:
                    patient_profiles = data
                    logger.info(f"✅ Generated {len(patient_profiles)} patient profiles.")
                    return patient_profiles

                logger.warning(f"Attempt {attempt + 1}: Received empty or invalid data: {data}")

            except Exception as e:
                logger.warning(f"NeMo Data Designer attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    sleep_time = base_delay * (2**attempt) + random.uniform(0, 1)
                    logger.info(f"Retrying in {sleep_time:.2f}s...")
                    time.sleep(sleep_time)
                else:
                    logger.error("All NeMo generation attempts failed.")
                    raise

        return patient_profiles

    def _create_session_from_profile(
        self, idx: int, profile: dict[str, Any], llm_client: LLMClient
    ) -> dict[str, Any] | None:
        """Generate a single session based on a patient profile."""
        try:
            # Extract profile features
            age = profile.get("age", "Unknown")
            gender = profile.get("gender", "Unknown")
            ethnicity = profile.get("ethnicity", "Unknown")
            diagnosis = profile.get("primary_diagnosis", "General Issues")
            severity = profile.get("symptom_severity", "Moderate")
            treatment = profile.get("treatment_type", "Talk Therapy")
            duration = profile.get("symptom_duration_months", 0)

            turns = random.randint(self.min_turns, 50)

            # Construct Rich Context Prompt
            profile_desc = (
                f"Patient: {age} year old {ethnicity} {gender}.\n"
                f"Diagnosis: {diagnosis} (Severity: {severity}/10).\n"
                f"History: Symptoms for {duration} months.\n"
                f"Treatment Context: Currently receiving {treatment}."
            )

            system_prompt = (
                f"Simulate a {treatment} therapy session between a Therapist and a Patient.\n"
                f"{profile_desc}\n"
                f"The conversation must last exactly {turns} turns (total exchanges).\n"
                f"Format: Alternating 'Therapist:' and 'Patient:' lines.\n"
                f"Ensure the therapist uses {treatment} techniques effectively.\n"
                f"The patient should show realistic symptoms of {diagnosis} and resistance/progress consistent with severity {severity}.\n"
                f"Do not output anything else, just the dialogue."
            )

            dialogue_text = llm_client.generate(
                f"Generate the full {turns}-turn session transcript now.",
                system_prompt=system_prompt,
            )

            # Parse dialogue
            messages = []
            for raw_line in dialogue_text.split("\n"):
                clean_line = raw_line.strip()
                if clean_line.startswith("Therapist:"):
                    messages.append(
                        {
                            "role": "therapist",
                            "content": clean_line.replace("Therapist:", "").strip(),
                        }
                    )
                elif clean_line.startswith("Patient:"):
                    messages.append(
                        {
                            "role": "patient",
                            "content": clean_line.replace("Patient:", "").strip(),
                        }
                    )

            if len(messages) < self.min_turns:
                return None

            return {
                "id": f"syn_pix8_{idx}_{int(time.time())}",
                "source": "synthetic_nim_nemo_hybrid",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "modality": treatment,
                    "topic": diagnosis,
                    "patient_profile": profile,
                    "intended_turns": turns,
                    "actual_turns": len(messages),
                },
                "messages": messages,
                "text": dialogue_text,
            }
        except Exception as exc:
            logger.warning(f"Failed to generate session {idx}: {exc}")
            return None

    def generate_synthetic_sessions(self, target_count: int = 100000) -> dict[str, Any]:
        """
        Generate synthetic sessions using a hybrid approach:
        1. NeMo Data Designer: Generates statistically balanced patient profiles.
        2. LLMClient (NIM): Generates the dialogue based on those profiles.
        """
        logger.info(f"Generating {target_count:,} synthetic long-running sessions...")

        # 1. Initialize Services
        try:
            # NeMo Data Designer for Profiles
            designer = NeMoDataDesignerService()
            # LLM Client for Text
            llm_client = LLMClient(driver="openai")
            # Test connection
            llm_client.generate("Test", system_prompt="Ping")
        except Exception as e:
            logger.error(f"Failed to initialize services: {e}")
            return {
                "error": "Service initialization failed",
                "details": str(e),
                "generated_count": 0,
            }

        output_file = self.output_dir / "synthetic_long_sessions.jsonl"

        # 2. Generate Patient Profiles using NeMo Data Designer
        logger.info("🎨 Generating patient profiles via NeMo Data Designer...")

        try:
            patient_profiles = self._generate_patient_profiles(target_count, designer)
        except Exception as e:
            return {
                "error": "NeMo profile generation failed after retries",
                "details": str(e),
            }

        generated_count = 0
        failed_count = 0

        # 3. Generate Dialogues
        logger.info("🧠 Generating dialogues via LLM...")

        # Use a subset of profiles matching target_count
        selected_profiles = patient_profiles[:target_count]

        # Handle case where we have fewer profiles than target
        if len(selected_profiles) < target_count:
            logger.warning(
                f"Only have {len(selected_profiles)} profiles for {target_count} targets. Recycling profiles."
            )
            while len(selected_profiles) < target_count:
                selected_profiles.extend(patient_profiles[: target_count - len(selected_profiles)])

        with open(output_file, "a") as f:
            for i, profile in enumerate(selected_profiles):
                session = self._create_session_from_profile(i, profile, llm_client)
                if session:
                    f.write(json.dumps(session) + "\n")
                    f.flush()
                    generated_count += 1
                    if generated_count % 10 == 0:
                        logger.info(f"Generated {generated_count}/{target_count} sessions...")
                else:
                    failed_count += 1

        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "method": "synthetic_generation_nim_hybrid",
            "target_count": target_count,
            "generated_count": generated_count,
            "failed_count": failed_count,
            "output_file": str(output_file),
            "status": "completed",
        }

        logger.info(
            f"✅ Synthetic generation complete: {generated_count} sessions saved to {output_file}"
        )

        return stats

    def generate_all(
        self, extraction_target: int = 100000, synthesis_target: int = 100000
    ) -> dict[str, Any]:
        """
        Generate all long-running sessions for PIX-8.

        Strategy:
        1. Extract 100K sessions from existing datasets
        2. Generate 100K synthetic sessions
        Total: 200K long-running sessions

        Args:
            extraction_target: Target for extraction
            synthesis_target: Target for synthesis

        Returns:
            Aggregate statistics
        """
        logger.info("=" * 80)
        logger.info("PIX-8 LONG-RUNNING SESSION GENERATION")
        logger.info("=" * 80)
        logger.info(f"Target: 200K total sessions (≥{self.min_turns} turns)")
        logger.info(f"  - {extraction_target:,} from extraction")
        logger.info(f"  - {synthesis_target:,} from synthesis")
        logger.info("=" * 80)

        # Extract from existing datasets
        extraction_stats = self.extract_from_existing_datasets(target_count=extraction_target)

        # Generate synthetic sessions
        synthesis_stats = self.generate_synthetic_sessions(target_count=synthesis_target)

        # Aggregate statistics
        total_generated = extraction_stats.get("extracted_count", 0) + synthesis_stats.get(
            "generated_count", 0
        )

        aggregate_stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pix8_task": "long_running_session_generation",
            "min_turns": self.min_turns,
            "target_total": extraction_target + synthesis_target,
            "actual_total": total_generated,
            "extraction": extraction_stats,
            "synthesis": synthesis_stats,
        }

        # Save aggregate statistics
        stats_file = self.output_dir / "pix8_long_sessions_stats.json"
        with open(stats_file, "w") as f:
            json.dump(aggregate_stats, f, indent=2)

        logger.info("\n" + "=" * 80)
        logger.info("📊 PIX-8 LONG SESSION GENERATION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total generated: {total_generated:,} / {aggregate_stats['target_total']:,}")
        logger.info(f"Extracted: {extraction_stats.get('extracted_count', 0):,}")
        logger.info(f"Synthetic: {synthesis_stats.get('generated_count', 0):,}")
        logger.info(f"\n💾 Statistics saved: {stats_file}")

        if total_generated < aggregate_stats["target_total"]:
            logger.warning(
                f"\n⚠️  Generated {total_generated:,} / {aggregate_stats['target_total']:,} sessions"
            )
            logger.warning("    Consider additional data sources or synthetic generation")

        logger.info("=" * 80)

        return aggregate_stats


def main():
    """Run PIX-8 long-running session generation."""
    parser = argparse.ArgumentParser(
        description="Generate long-running therapy sessions for PIX-8 dataset enhancement"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ai/training_ready/data/generated/pix8_long_sessions"),
        help="Output directory for generated sessions",
    )
    parser.add_argument(
        "--min-turns",
        type=int,
        default=20,
        help="Minimum number of turns to qualify as long-running (default: 20)",
    )
    parser.add_argument(
        "--extract-only", action="store_true", help="Only extract from existing datasets"
    )
    parser.add_argument(
        "--synthesis-only", action="store_true", help="Only generate synthetic sessions"
    )
    parser.add_argument(
        "--extraction-target",
        type=int,
        default=100000,
        help="Target number of extracted sessions (default: 100K)",
    )
    parser.add_argument(
        "--synthesis-target",
        type=int,
        default=100000,
        help="Target number of synthetic sessions (default: 100K)",
    )

    args = parser.parse_args()

    generator = PIX8LongSessionGenerator(output_dir=args.output_dir, min_turns=args.min_turns)

    if args.extract_only:
        generator.extract_from_existing_datasets(target_count=args.extraction_target)
    elif args.synthesis_only:
        generator.generate_synthetic_sessions(target_count=args.synthesis_target)
    else:
        generator.generate_all(
            extraction_target=args.extraction_target, synthesis_target=args.synthesis_target
        )

    logger.info("\n✅ PIX-8 long session generation complete!")

    return 0


if __name__ == "__main__":
    sys.exit(main())
