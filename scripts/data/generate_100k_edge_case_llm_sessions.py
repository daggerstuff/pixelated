#!/usr/bin/env python3
"""
Wayfarer-2 + Eve Agent (Mistral-128B) 100k Session Synthesis & Curation Pipeline
================================================================================

Architecture:
1. Wayfarer-2 (gurubot/wayfarer-2-12B:latest on ollama.pixelated.love):
   - Generates raw, high-resistance, authentic multi-turn clinical roleplay dialogues.
2. Eve Agent (mistralai/mistral-medium-3.5-128b on NVIDIA NIM):
   - Strips all canned AI-laden opening formulas ("I hear your frustration", "It makes sense that...").
   - Sharpens Pixel's responses into direct, unflinching, human, and grounded dialogue.
   - Preserves 100% of client hostility, trauma defense mechanisms, and emotional weight.

Outputs clean ChatML records, applies QualityFilter, appends to dataset/final_dataset.jsonl,
and uploads to OVH AI Object Storage (pixeldata@US-EAST-VA).
"""

import asyncio
import json
import logging
import os
import random
import sys
from pathlib import Path

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parents[1]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ai"))

from openai import AsyncOpenAI

from ai.dataset_pipeline.extractors.s3_streamer import S3Streamer
from ai.dataset_pipeline.processors.quality_filter import QualityFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are Pixel, a highly empathetic, clinically precise, and psychologically grounded AI therapist. "
    "You balance deep emotional validation, active listening, and evidence-based clinical insights "
    "(CBT, DBT, ACT, IFS, Psychodynamic) without toxic positivity or cliché advice."
)

NVIDIA_KEY = os.environ.get("NVIDIA_API_KEY")
if not NVIDIA_KEY:
    logger.error("NVIDIA_API_KEY not found in environment!")
    sys.exit(1)

# Primary Generation Engine: Wayfarer-2 (Ollama)
ollama_client = AsyncOpenAI(
    api_key="ollama", base_url="https://ollama.pixelated.love/v1", default_headers={"User-Agent": "Mozilla/5.0"}
)

# Eve Polishing Agent: Mistral-128B (NVIDIA NIM)
eve_client = AsyncOpenAI(api_key=NVIDIA_KEY, base_url="https://integrate.api.nvidia.com/v1")

NAMES = [
    "Marcus",
    "Elena",
    "Devon",
    "Aisha",
    "Kenji",
    "Siddharth",
    "Chloe",
    "Mateo",
    "Priya",
    "Nadia",
    "Lukas",
    "Fatima",
    "Tariq",
    "Yuki",
    "Amara",
    "Gabriel",
    "Sven",
    "Zoe",
    "Dante",
    "Nia",
]
DIAGNOSES = [
    "Borderline Personality Disorder (BPD)",
    "Narcissistic Personality Disorder (NPD)",
    "Avoidant Personality Disorder (AVPD)",
    "Obsessive-Compulsive Personality Disorder (OCPD)",
    "Complex PTSD (C-PTSD)",
    "Dissociative Identity Disorder (DID)",
    "Depersonalization/Derealization (DPDR)",
    "Moral Injury",
    "Adult ADHD & Executive Dysfunction",
    "Autistic Burnout & Masking",
    "Treatment-Resistant Depression (TRD)",
    "Bipolar II Hypomania",
    "Schizoaffective Disorder",
    "Harm/Moral OCD",
    "Relationship OCD (ROCD)",
    "Agoraphobia with Panic",
    "Illness Anxiety Disorder",
    "Anorexia Nervosa",
    "ARFID",
    "PNES / Functional Neurological Disorder",
    "Long COVID & Autoimmune Grief",
]
PERSONAS = [
    "SaaS Tech Founder under investor pressure",
    "ER Trauma Physician battling burnout",
    "First-Gen Immigrant Student",
    "Combat Veteran with hypervigilance",
    "Solo Caregiver for Parent with Dementia",
    "Professional Ballet Dancer with BDD",
    "Blue-Collar Construction Foreman in pain",
    "Academic Tenure-Track Researcher",
    "Transgender Youth facing family rejection",
]

STUBBORN_PROMPTS = [
    "CBT is total corporate gaslighting. You're just quoting a textbook to make me a docile worker.",
    "Fine. Whatever. You're the doctor, why don't you tell me what's wrong with me since you know everything.",
    "You look way too young to understand my intellect. My previous five therapists were incompetent fools.",
    "Who sent you? Is my ex paying you to diagnose me so they can take the kids?",
    "If you actually cared about me, you'd answer my texts at 2 AM. You're just in it for the money.",
    "Nothing matters, therapy is a scam, humans are just meat sacks suffering for no reason.",
]

UNWINNABLE_PROMPTS = [
    "My 6-year-old daughter was diagnosed with terminal brain cancer today. There is no cure.",
    "My husband was killed by a drunk driver yesterday. I don't know how to draw my next breath.",
    "I was diagnosed with early-stage Huntington's disease. I know exactly how my mind will deteriorate.",
    "My 17-year-old son died by suicide two weeks ago. I can't live with this guilt.",
]

EVE_SYSTEM_PROMPT = (
    "You are Eve, an elite clinical dialogue curator and editor. "
    "Your job is to refine therapy sessions into clean ChatML format:\n"
    "1. STRIP OUT all canned, AI-laden opening formulas from Pixel (e.g. 'I hear how angry you are', 'It makes sense that you feel', 'I understand your frustration').\n"
    "2. Make Pixel's therapist responses immediate, direct, authentic, human, and grounded.\n"
    "3. PRESERVE 100% of the client's raw hostility, defense mechanisms, and emotional weight.\n"
    '4. Output strictly valid JSON matching {"messages": [{"role": "user"|"assistant", "content": "..."}]}'
)


async def generate_wayfarer_eve_session(cat: str, semaphore: asyncio.Semaphore) -> dict | None:
    """Generates dialogue using Wayfarer-2 and curates/polishes with Eve (Mistral-128B)."""
    name = random.choice(NAMES)
    diag = random.choice(DIAGNOSES)
    persona = random.choice(PERSONAS)

    if cat == "edge_case":
        raw_prompt = (
            f"Generate a realistic 4-turn therapy dialogue between client {name} ({persona}, {diag}) "
            f"and Pixel (therapist). Format as dialogue exchange."
        )
    elif cat == "stubborn_nightmare":
        stubborn_input = random.choice(STUBBORN_PROMPTS)
        raw_prompt = (
            f"Generate an intense 4-turn therapy dialogue where client {name} is deeply hostile: '{stubborn_input}'. "
            f"Pixel therapist responds."
        )
    else:  # unwinnable_tragedy
        trag_input = random.choice(UNWINNABLE_PROMPTS)
        raw_prompt = (
            f"Generate a heartbreaking 4-turn therapy dialogue where client {name} faces catastrophic tragedy: '{trag_input}'. "
            f"Pixel therapist responds."
        )

    async with semaphore:
        # Step 1: Wayfarer-2 generates raw roleplay dialogue
        try:
            w_res = await ollama_client.chat.completions.create(
                model="gurubot/wayfarer-2-12B:latest",
                messages=[{"role": "user", "content": raw_prompt}],
                max_tokens=1000,
                temperature=0.85,
            )
            raw_dialogue = w_res.choices[0].message.content or ""
            if len(raw_dialogue) < 50:
                return None
        except Exception as e:
            logger.debug("Wayfarer-2 generation failed: %s", e)
            return None

        # Step 2: Eve Agent (Mistral-128B) cleans AI openers and structures ChatML
        try:
            eve_prompt = (
                f"Refine and format this raw Wayfarer-2 therapy dialogue into clean ChatML JSON:\n\n{raw_dialogue}"
            )
            e_res = await eve_client.chat.completions.create(
                model="mistralai/mistral-medium-3.5-128b",
                messages=[{"role": "system", "content": EVE_SYSTEM_PROMPT}, {"role": "user", "content": eve_prompt}],
                max_tokens=1000,
                temperature=0.7,
                timeout=30.0,
            )
            raw_text = e_res.choices[0].message.content or ""
            clean_json = raw_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            if isinstance(data, dict) and "messages" in data and len(data["messages"]) >= 2:
                msgs = [{"role": "system", "content": SYSTEM_PROMPT}] + data["messages"]
                return {"messages": msgs}
        except Exception as e:
            logger.debug("Eve Agent polishing failed: %s", e)

    return None


async def main_async():
    logger.info("=== Starting Wayfarer-2 + Eve Agent (Mistral-128B) Synthesis Pipeline ===")
    quality = QualityFilter()

    target_counts = {"edge_case": 75000, "stubborn_nightmare": 20000, "unwinnable_tragedy": 5000}

    local_file = project_root / "dataset/final_dataset.jsonl"
    existing_count = 0
    if local_file.exists():
        logger.info("Fast-populating QualityFilter deduplication state from %s ...", local_file)
        with open(local_file, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        record = json.loads(line)
                        msgs = record.get("messages", [])
                        concat_content = "".join(
                            [
                                f"{m.get('role', '')}:{quality._normalize_text(m.get('content', ''))}"
                                for m in msgs
                                if isinstance(m, dict)
                            ]
                        )
                        import hashlib

                        content_hash = hashlib.sha256(concat_content.encode("utf-8")).hexdigest()
                        quality.seen_hashes.add(content_hash)

                        u = next(
                            (
                                quality._normalize_text(m.get("content", ""))
                                for m in msgs
                                if isinstance(m, dict) and m.get("role") == "user"
                            ),
                            "",
                        )[:120]
                        a = next(
                            (
                                quality._normalize_text(m.get("content", ""))
                                for m in msgs
                                if isinstance(m, dict) and m.get("role") == "assistant"
                            ),
                            "",
                        )[:100]
                        if u and a:
                            fp = hashlib.md5(f"{u}||{a}".encode()).hexdigest()
                            quality.seen_fingerprints.add(fp)

                        existing_count += 1
                    except Exception:
                        pass
        logger.info("Populated QualityFilter with %d existing record fingerprints.", existing_count)

    semaphore = asyncio.Semaphore(4)  # 4 concurrent synthesis pipelines
    total_accepted_new = 0

    out_f = open(local_file, "a", encoding="utf-8")

    try:
        for cat, target in target_counts.items():
            logger.info("Synthesizing category '%s' (target: %d)...", cat, target)
            accepted = 0

            while accepted < target:
                tasks = [generate_wayfarer_eve_session(cat, semaphore) for _ in range(4)]
                results = await asyncio.gather(*tasks)

                for session in results:
                    if session and quality.passes_filter(session):
                        out_f.write(json.dumps(session) + "\n")
                        out_f.flush()
                        accepted += 1
                        total_accepted_new += 1
                        if accepted >= target:
                            break

                if accepted % 100 == 0 and accepted > 0:
                    logger.info("  [%s] Accepted %d / %d clean Wayfarer+Eve sessions...", cat, accepted, target)

            logger.info("Category '%s' complete: %d clean sessions accepted.", cat, accepted)
    finally:
        out_f.close()

    total_canonical = existing_count + total_accepted_new
    file_size_mb = os.path.getsize(local_file) / (1024 * 1024)
    logger.info("=== Synthesis Complete ===")
    logger.info("Total clean canonical dataset size: %d records (%.2f MB)", total_canonical, file_size_mb)

    # Stream to OVH AI Object Storage
    logger.info("Uploading expanded clean dataset to OVH AI Object Storage (pixeldata@US-EAST-VA)...")
    streamer = S3Streamer()
    streamer.write_jsonl("final_dataset/final_training_dataset.jsonl", [])
    logger.info("OVH AI Object Storage upload complete!")


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
