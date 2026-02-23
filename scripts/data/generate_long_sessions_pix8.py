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

from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.common.llm_client import LLMClient  # noqa: E402
from ai.pipelines.design.service import NeMoDataDesignerService  # noqa: E402

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class PIX8LongSessionGenerator:
    """Generate long-running therapy sessions for PIX-8 dataset enhancement."""

    def __init__(self, output_dir: Path | None = None, min_turns: int = 20, max_turns: int = 50):
        """
        Initialize the long session generator.

        Args:
            output_dir: Local output directory for generated sessions
            min_turns: Minimum number of turns to qualify as long-running
            max_turns: Maximum number of turns to specify for LLM generation
        """
        self.output_dir = output_dir or Path("ai/training_ready/data/generated/pix8_long_sessions")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.min_turns = min_turns
        self.max_turns = max_turns
        # Use correct path relative to project root
        project_root = Path(__file__).resolve().parent.parent.parent
        self.extractor_script = (
            project_root / "ai/training/ready_packages/scripts/extract_long_running_therapy.py"
        )

        logger.info("Initialized PIX-8 long session generator")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Turns: {self.min_turns} - {self.max_turns}")

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
            return self._run_extraction_process(cmd, output_file)
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

    def _run_extraction_process(self, cmd, output_file):
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)

        logger.info("Extraction complete!")
        logger.info(result.stdout)

        extracted_count = self._count_lines(output_file)

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

    def _count_lines(self, file_path: Path) -> int:
        """Count the number of lines in a file."""
        if not file_path.exists():
            return 0
        with open(file_path) as f:
            return sum(1 for _ in f)

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
                    logger.error(
                        "All NeMo generation attempts failed. Using LLM global fallback for profiles."
                    )
                    return self._generate_llm_fallback_profiles(target_count)

        return patient_profiles

    PATIENT_PERSONAS = [
        {
            "name": "The Anxious Over-Explainer",
            "traits": "High-income, highly educated, uses intellectualization to avoid feelings. Speaks rapidly, uses long complex sentences, constantly justifies actions, fears failure.",
        },
        {
            "name": "The Stoic Blue-Collar",
            "traits": "Working class, values toughness. Very brief, practical answers. Resists psychological jargon. Reluctant to admit emotional pain, often describes physical stress instead.",
        },
        {
            "name": "The Apathetic Teen/Young Adult",
            "traits": "Low-income to middle class, feels hopeless about the future. Uses heavy slang, sarcasm, and frequent 'I don't care' or 'whatever'. Deflects with humor.",
        },
        {
            "name": "The Distressed Caregiver",
            "traits": "Middle-income, exhausted. Extremely empathetic but self-neglecting. Apologizes constantly, speaks in circles about others but freezes when asked about their own needs.",
        },
        {
            "name": "The Combative Skeptic",
            "traits": "Any income. Fundamentally distrusts therapy. Confrontational, tests the therapist's competence, uses 'you people' when referring to mental health professionals. Needs to feel in control.",
        },
    ]

    def _generate_llm_fallback_profiles(self, count: int) -> list[dict[str, Any]]:
        """Generate patient profiles via LLM if NeMo is down."""
        logger.info(f"Generating {count} fallback patient profiles via LLM...")
        llm = LLMClient(driver="openai")

        prompt = (
            f"Generate {count} diverse therapeutic patient profiles.\n"
            "Include fields: age, gender, ethnicity, primary_diagnosis, symptom_severity (1-10), "
            "treatment_type, symptom_duration_months, and 'patient_persona' (a short description of their "
            "speaking style, income level, vocabulary, and defense mechanisms).\n"
            "Return a JSON LIST of objects. Return ONLY the JSON."
        )

        profiles = []
        try:
            # Chunking for token limits
            chunk_size = 10
            for i in range(0, count, chunk_size):
                current_chunk = min(chunk_size, count - i)
                chunk_prompt = prompt.replace(f"Generate {count}", f"Generate {current_chunk}")
                res_text = llm.generate(
                    chunk_prompt, system_prompt="You are a clinical data architect."
                )

                # Extract JSON
                start = res_text.find("[")
                end = res_text.rfind("]") + 1
                if start != -1 and end != -1:
                    chunk_data = json.loads(res_text[start:end])
                    profiles.extend(chunk_data)
                else:
                    logger.error("Failed to parse JSON from LLM profile fallback.")
        except Exception as e:
            logger.error(f"LLM Profile fallback failed: {e}")

        # Inject strict personas into fallback profiles if they lack good ones
        for p in profiles:
            persona = random.choice(self.PATIENT_PERSONAS)
            if "patient_persona" not in p or len(str(p.get("patient_persona", ""))) < 10:
                p["patient_persona"] = persona["traits"]

        return profiles

    # Therapeutic phase definitions for raw, realistic multi-segment generation
    THERAPEUTIC_PHASES = [
        {
            "name": "rapport_building",
            "label": "Tense Opening & Defensive Assessment",
            "instruction": (
                "This is the OPENING phase of a therapy session. "
                "The therapist should warm up but use minimal encouragers ('Mhm', 'Right', 'Okay'). "
                "The patient should be guarded, slightly defensive, and perhaps annoyed or distracted. "
                "CRITICAL: Do NOT write perfectly formed paragraphs. Use fragmented sentences, "
                "filler words ('um', 'uh', 'you know'), hesitations, and false starts. "
                "The language must be raw, slightly awkward, and distinctly human. "
                "Do NOT wrap up or say goodbye."
            ),
        },
        {
            "name": "deep_exploration",
            "label": "Messy Exploration & Resistance",
            "instruction": (
                "This is the EXPLORATION phase. The therapist should probe deeper into the core issues, "
                "but the patient should exhibit clinical resistance (deflection, minimizing, brief silences, "
                "or mild frustration). "
                "CRITICAL: Absolutely NO instant breakthroughs. People take time to process. "
                "Keep responses relatively short. Patients do not monologue beautifully about their trauma; "
                "they stumble through it. The therapist should occasionally interrupt gently or redirect. "
                "Do NOT wrap up or say goodbye."
            ),
        },
        {
            "name": "insight_and_reframing",
            "label": "Reluctant Insight & Friction",
            "instruction": (
                "This is the INSIGHT phase. The therapist introduces a new perspective or points out a pattern. "
                "CRITICAL: The patient should push back. They should express doubt ('I don't know if I buy that', "
                "'That sounds good in theory but...'). "
                "If an 'aha' moment occurs, it should be understated and hesitant, not a miraculous cure. "
                "Maintain natural conversational flow: use interruptions, colloquialisms, and imperfect grammar. "
                "Do NOT use terms like 'I think I need to practice self-compassion'. "
                "Do NOT wrap up or say goodbye."
            ),
        },
        {
            "name": "integration_and_planning",
            "label": "Exhausted Integration & Realistic Closing",
            "instruction": (
                "This is the FINAL phase. The patient is emotionally drained. "
                "The therapist attempts to set a small, realistic behavioral goal or 'homework', "
                "which the patient might be skeptical about actually completing. "
                "CRITICAL: No dramatic summaries of how 'valuable' the session was. "
                "The closing should be briefly awkward as sessions end. "
                "End with a natural, quick 2-3 exchange goodbye (e.g., 'Alright, see you next week', 'Yeah, bye')."
            ),
        },
    ]

    # Goodbye/farewell patterns for repetition detection
    GOODBYE_PATTERNS = [
        "bye",
        "goodbye",
        "take care",
        "see you",
        "have a good",
        "have a great",
        "next week",
        "next session",
        "you too",
        "thanks for",
        "thank you for coming",
        "until next",
    ]

    def _filter_repetitive_turns(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Detect and truncate repetitive content and goodbye loops.

        Uses two strategies:
        1. Goodbye pattern detection — truncate after 3+ consecutive farewell turns
        2. Near-duplicate sliding window — truncate if 4+ of 6 turns repeat earlier content
        """
        if not messages:
            return messages

        filtered = []
        consecutive_goodbyes = 0

        for i, msg in enumerate(messages):
            content_lower = msg.get("content", "").lower().strip()

            # Strategy 1: Goodbye pattern detection
            is_goodbye = any(pattern in content_lower for pattern in self.GOODBYE_PATTERNS)
            if is_goodbye:
                consecutive_goodbyes += 1
            else:
                consecutive_goodbyes = 0

            if consecutive_goodbyes >= 4:
                logger.info(f"🔪 Truncated at turn {i}: detected goodbye loop")
                break

            # Strategy 2: Near-duplicate detection (check last 10 turns for repeats)
            if i >= 10 and len(content_lower) < 40:
                recent_contents = [m.get("content", "").lower().strip() for m in filtered[-10:]]
                duplicate_count = sum(
                    1
                    for rc in recent_contents
                    if rc == content_lower
                    or (
                        len(rc) > 5
                        and len(content_lower) > 5
                        and (rc in content_lower or content_lower in rc)
                    )
                )
                if duplicate_count >= 3:
                    logger.info(f"🔪 Truncated at turn {i}: detected repetitive content")
                    break

            filtered.append(msg)

        return filtered

    def _parse_dialogue_text(self, dialogue_text: str) -> list[dict[str, Any]]:
        """Parse raw dialogue text into structured messages."""
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
        return messages

    def _generate_segment(
        self,
        llm_client: LLMClient,
        profile_desc: str,
        phase: dict[str, str],
        segment_turns: int,
        prior_context: list[dict[str, Any]],
        diagnosis: str,
        treatment: str,
        severity: str | int,
    ) -> list[dict[str, Any]]:
        """Generate a single segment of the therapy session."""
        # Build continuity context from prior segment
        context_block = ""
        if prior_context:
            context_lines = []
            for msg in prior_context[-3:]:
                role_label = "Therapist" if msg["role"] == "therapist" else "Patient"
                context_lines.append(f"{role_label}: {msg['content']}")
            context_block = (
                "\n\nThe session has been ongoing. Here are the last few exchanges "
                "for continuity — pick up RIGHT where this left off:\n"
                + "\n".join(context_lines)
                + "\n\nContinue the session naturally from this point."
            )

        system_prompt = (
            f"You are writing a realistic {treatment} therapy session transcript.\n"
            f"{profile_desc}\n\n"
            f"CURRENT PHASE: {phase['label']}\n"
            f"{phase['instruction']}\n\n"
            f"Generate EXACTLY {segment_turns} exchanges (alternating Therapist: and Patient: lines).\n"
            f"The patient shows realistic symptoms of {diagnosis} at severity {severity}/10.\n"
            f"Each response should be substantive (2-4 sentences minimum).\n"
            f"Do NOT use filler phrases like 'I understand' repeatedly.\n"
            f"Do NOT include session numbers, timestamps, or meta-commentary.\n"
            f"Output ONLY the dialogue lines.{context_block}"
        )

        dialogue_text = llm_client.generate(
            f"Generate the {phase['label']} segment ({segment_turns} exchanges) now.",
            system_prompt=system_prompt,
            max_tokens=4096,
        )

        return self._parse_dialogue_text(dialogue_text)

    def _create_session_from_profile(
        self, idx: int, profile: dict[str, Any], llm_client: LLMClient
    ) -> dict[str, Any] | None:
        """
        Generate a single long session using multi-segment chained generation.

        Splits the target turn count into 4 therapeutic phases, generates each
        segment with continuity context, filters repetition, and enforces
        turn count boundaries.
        """
        try:
            # Extract profile features
            age = profile.get("age", "Unknown")
            gender = profile.get("gender", "Unknown")
            ethnicity = profile.get("ethnicity", "Unknown")
            diagnosis = profile.get("primary_diagnosis", "General Issues")
            severity = profile.get("symptom_severity", "Moderate")
            treatment = profile.get("treatment_type", "Talk Therapy")
            duration = profile.get("symptom_duration_months", 0)

            # Ensure a persona is attached, if not from LLM fallback, randomly assign one
            persona = profile.get("patient_persona")
            if not persona or len(str(persona)) < 10:
                persona_dict = random.choice(self.PATIENT_PERSONAS)
                persona = f"Persona: {persona_dict['name']}. {persona_dict['traits']}"
                profile["patient_persona"] = persona

            total_turns = random.randint(self.min_turns, self.max_turns)

            profile_desc = (
                f"Patient: {age} year old {ethnicity} {gender}.\n"
                f"Diagnosis: {diagnosis} (Severity: {severity}/10).\n"
                f"History: Symptoms for {duration} months.\n"
                f"Treatment Context: Currently receiving {treatment}.\n"
                f"Communication Style & Demographics: {persona}"
            )

            # Distribute turns across 4 phases
            base_per_segment = total_turns // 4
            remainder = total_turns % 4
            segment_sizes = [base_per_segment] * 4
            for i in range(remainder):
                segment_sizes[i] += 1

            logger.info(f"  Session {idx}: {total_turns} turns across 4 phases ({segment_sizes})")

            # Generate each segment with continuity chaining
            all_messages: list[dict[str, Any]] = []
            all_raw_text: list[str] = []

            for phase_idx, phase in enumerate(self.THERAPEUTIC_PHASES):
                segment_msgs = self._generate_segment(
                    llm_client=llm_client,
                    profile_desc=profile_desc,
                    phase=phase,
                    segment_turns=segment_sizes[phase_idx],
                    prior_context=all_messages,
                    diagnosis=diagnosis,
                    treatment=treatment,
                    severity=severity,
                )

                if not segment_msgs:
                    logger.warning(
                        f"  Phase {phase_idx + 1} ({phase['name']}) returned empty — skipping"
                    )
                    continue

                all_messages.extend(segment_msgs)
                all_raw_text.append(
                    "\n".join(
                        f"{'Therapist' if m['role'] == 'therapist' else 'Patient'}: {m['content']}"
                        for m in segment_msgs
                    )
                )

                logger.info(
                    f"  Phase {phase_idx + 1}/4 ({phase['name']}): "
                    f"+{len(segment_msgs)} turns → {len(all_messages)} total"
                )

            # Apply repetition filter
            filtered_messages = self._filter_repetitive_turns(all_messages)

            # Enforce hard ceiling
            if len(filtered_messages) > self.max_turns:
                filtered_messages = filtered_messages[: self.max_turns]
                logger.info(f"  Hard-capped at {self.max_turns} turns")

            # Enforce minimum
            if len(filtered_messages) < self.min_turns:
                logger.warning(
                    f"  Session {idx} only has {len(filtered_messages)} turns "
                    f"after filtering (need {self.min_turns}) — discarding"
                )
                return None

            logger.info(
                f"  ✅ Session {idx}: {len(filtered_messages)} turns (target was {total_turns})"
            )

            return {
                "id": f"syn_pix8_{idx}_{int(time.time())}",
                "source": "synthetic_nim_nemo_hybrid_v2",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "modality": treatment,
                    "topic": diagnosis,
                    "patient_profile": profile,
                    "intended_turns": total_turns,
                    "actual_turns": len(filtered_messages),
                    "generation_method": "multi_segment_chained",
                    "phases": [p["name"] for p in self.THERAPEUTIC_PHASES],
                },
                "messages": filtered_messages,
                "text": "\n\n---\n\n".join(all_raw_text),
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
            # Raise temperature for more varied output
            if hasattr(llm_client, "driver") and hasattr(llm_client.driver, "client"):
                llm_client._default_temperature = 0.85
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
                if session := self._create_session_from_profile(i, profile, llm_client):
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
        "--max-turns",
        type=int,
        default=50,
        help="Maximum number of turns mapped for LLM generation (default: 50)",
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

    generator = PIX8LongSessionGenerator(
        output_dir=args.output_dir, min_turns=args.min_turns, max_turns=args.max_turns
    )

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
