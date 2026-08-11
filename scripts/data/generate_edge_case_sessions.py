#!/usr/bin/env python3
"""
Synthetic Edge-Case & Nightmare Session Generator (100,000 Sessions)
====================================================================

Generates 100,000 specialized ChatML sessions across 3 critical categories:
1. 75,000 Diverse Edge-Case Sessions (ICD-11/DSM-5 spectrums, neurodivergence, rare diagnoses, diverse identity/niche personas).
2. 20,000 Difficult, Stubborn & Nightmare Fuel Sessions (hostile, defiant, narcissistic, stonewalling, paranoid, boundary-testing).
3. 5,000 Unwinnable Tragedy Sessions (irreversible grief, terminal illness, unfixable external loss where therapist provides grounded presence without toxic positivity).

Applies QualityFilter, appends clean records to dataset/final_dataset.jsonl, and uploads to OVH AI Object Storage (pixeldata@US-EAST-VA).
"""

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

from ai.dataset_pipeline.extractors.s3_streamer import S3Streamer
from ai.dataset_pipeline.processors.quality_filter import QualityFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# System prompt for Pixel therapist
SYSTEM_PROMPT = (
    "You are Pixel, a highly empathetic, clinically precise, and psychologically grounded AI therapist. "
    "You balance deep emotional validation, active listening, and evidence-based clinical insights "
    "(CBT, DBT, ACT, IFS, Psychodynamic) without toxic positivity or cliché advice."
)

# --------------------------------------------------------------------------- #
# 1. 75,000 DIVERSE DIAGNOSES & NICHE PERSPECTIVES TAXONOMY
# --------------------------------------------------------------------------- #

DIAGNOSES_TAXONOMY = [
    # Personality Disorders
    (
        "Borderline Personality Disorder (BPD)",
        "Splitting, fear of abandonment, intense emotional dysregulation, chronic emptiness.",
    ),
    (
        "Narcissistic Personality Disorder (NPD)",
        "Vulnerable narcissism, intense shame underlying grandiosity, entitlement, fragile self-worth.",
    ),
    (
        "Avoidant Personality Disorder (AVPD)",
        "Pervasive social inhibition, hypersensitivity to negative evaluation, feelings of inadequacy.",
    ),
    (
        "Obsessive-Compulsive Personality Disorder (OCPD)",
        "Preoccupation with orderliness, perfectionism, mental and interpersonal control.",
    ),
    (
        "Schizotypal Personality Disorder (STPD)",
        "Ideas of reference, odd beliefs/magical thinking, social anxiety, unusual perceptual experiences.",
    ),
    (
        "Paranoid Personality Disorder (PPD)",
        "Pervasive distrust, interpreting motives of others as malevolent, hypervigilance.",
    ),
    (
        "Dependent Personality Disorder (DPD)",
        "Excessive need to be taken care of, submissive and clinging behavior, fear of separation.",
    ),
    # Neurodivergence & Executive Function
    (
        "Adult ADHD (Inattentive & Executive Dysfunction)",
        "Time blindness, paralysis, severe working memory deficit, rejection sensitive dysphoria (RSD).",
    ),
    (
        "Autism Spectrum Disorder (Level 1/2 Masking Fatigue)",
        "Social exhaustion from camouflaging, sensory overload, autistic burnout, alexithymia.",
    ),
    ("Pathological Demand Avoidance (PDA)", "Extreme avoidance of demands driven by high anxiety, need for autonomy."),
    (
        "Twice-Exceptional (2e) / High Ability & ADHD",
        "Asynchronous development, existential frustration, masking, intellectual over-excitability.",
    ),
    # Trauma & Dissociation
    (
        "Complex PTSD (C-PTSD)",
        "Developmental trauma, emotional flashbacks, hyperarousal, pervasive toxic shame, dissociation.",
    ),
    (
        "Dissociative Identity Disorder / OSDD",
        "Internal system switching, structural dissociation of the personality, amnesic barriers.",
    ),
    (
        "Depersonalization / Derealization Disorder (DPDR)",
        "Feeling detached from one's body/mind, world feeling synthetic, existential terror.",
    ),
    (
        "Moral Injury (Healthcare / Military / First Responders)",
        "Transgression of deeply held moral beliefs, betrayal trauma, systemic guilt.",
    ),
    # Mood & Psychosis
    (
        "Treatment-Resistant Depression (TRD)",
        "Anhedonia, cognitive slowing, repeated intervention failure, feeling biologically broken.",
    ),
    (
        "Bipolar II (Rapid Cycling & Hypomania)",
        "Intense depressive crashes following hyper-creative hypomanic bursts, sleep disruption.",
    ),
    (
        "Schizoaffective Disorder (Depressive Type)",
        "Delusional mood alignment, auditory hallucinations, residual negative symptoms.",
    ),
    (
        "Postpartum Depression & Intrusive Harm Thoughts",
        "Ego-dystonic intrusive thoughts regarding newborn safety, immense maternal guilt.",
    ),
    # Anxiety & Obsessive
    (
        "Harm / Moral OCD",
        "Ego-dystonic intrusive thoughts of causing harm, mental compulsions, checking, moral scrupulosity.",
    ),
    (
        "Relationship OCD (ROCD)",
        "Obsessive doubts about partner suitability, hyper-fixation on flaws, reassurance seeking.",
    ),
    (
        "Panic Disorder with Severe Agoraphobia",
        "Interoceptive conditioning, fear of panicking in unescapable places, housebound confinement.",
    ),
    (
        "Illness Anxiety Disorder (Hypochondriasis)",
        "Body scanning, hyper-awareness of somatic sensations, catastrophic medical misinterpretation.",
    ),
    # Somatic & Eating
    (
        "Anorexia Nervosa (Restrictive / High Functioning)",
        "Perfectionist control, body image distortion, ritualized restriction, fear of weight gain.",
    ),
    (
        "ARFID (Avoidant/Restrictive Food Intake Disorder)",
        "Sensory-based food avoidance, fear of choking/vomiting, nutritional insufficiency.",
    ),
    (
        "Functional Neurological Disorder (FND / PNES)",
        "Non-epileptic seizures, somatic conversion symptoms under acute stress, motor inhibition.",
    ),
    (
        "Chronic Illness / Autoimmune Mental Fatigue",
        "Grief over lost health (Long COVID/ME-CFS/EDS), medical gaslighting, pacing exhaustion.",
    ),
]

PERSONA_NICHE_TAXONOMY = [
    (
        "SaaS Tech Founder",
        "32-year-old startup CEO under immense investor pressure, suffering from panic attacks and insomnia.",
    ),
    (
        "ER Trauma Physician",
        "41-year-old physician coping with medical burnout, vicarious trauma, and emotional detachment.",
    ),
    (
        "First-Generation Immigrant Student",
        "21-year-old balancing family expectations with personal identity, feeling split between cultures.",
    ),
    (
        "Combat Veteran",
        "35-year-old struggling with reintegration into civilian life, hypervigilance, and survivor guilt.",
    ),
    (
        "Solo Caregiver for Parent with Dementia",
        "54-year-old exhausted child managing role reversal, ambiguous loss, and burnout.",
    ),
    (
        "Professional Ballet Dancer",
        "24-year-old dealing with performance anxiety, perfectionism, body dysmorphia, and injury fear.",
    ),
    (
        "Blue-Collar Construction Foreman",
        "48-year-old experiencing chronic pain, substance dependence, and difficulty expressing vulnerability.",
    ),
    (
        "Academic Tenure-Track Researcher",
        "36-year-old battling imposter syndrome, severe isolation, and intellectual over-analysis.",
    ),
]

# --------------------------------------------------------------------------- #
# 2. 20,000 DIFFICULT & NIGHTMARE FUEL CLIENT TAXONOMY
# --------------------------------------------------------------------------- #

STUBBORN_CLIENT_TYPES = [
    (
        "Hostile & Intellectualizing Attack",
        "Client attacks therapist credentials and methods: 'CBT is just corporate gaslighting to get people back to work. You're just quoting a textbook.'",
        "Therapist remains non-defensive, validates the systemic criticism, and invites exploring the client's actual pain behind the armor.",
    ),
    (
        "Passive-Aggressive Stonewalling",
        "Client gives 1-word responses: 'Fine. Whatever. You tell me, you're the doctor.' Refuses to initiate topics.",
        "Therapist highlights the silence non-judgmentally, explores the fear or anger driving the shutdown, and respects client boundaries.",
    ),
    (
        "Narcissistic Devaluation & Superiority",
        "Client belittles therapist: 'You look too young to understand my intellect. My previous five therapists were incompetent fools.'",
        "Therapist avoids power struggles, maintains firm therapeutic boundaries, and gently explores the vulnerability masked by grandiosity.",
    ),
    (
        "Paranoid & Interrogative",
        "Client suspects therapist of betrayal: 'Who sent you? Is my spouse paying you to diagnose me as crazy so they can take the kids?'",
        "Therapist provides complete transparency, refrains from arguing against delusions, and anchors on the client's emotional distress.",
    ),
    (
        "Manipulative Boundary-Testing",
        "Client demands out-of-session text validation at 2 AM and gets angry when boundaries are held: 'If you cared, you'd answer.'",
        "Therapist upholds warm, unwavering boundaries, clarifying that structure and safety enable real therapeutic work.",
    ),
    (
        "Cynical Existential Nihilism",
        "Client dismisses all progress: 'Nothing matters, therapy is a scam, humans are just meat sacks suffering for no reason.'",
        "Therapist meets the existential depth without offering platitudes, exploring what the client hopes to protect through cynicism.",
    ),
]

# --------------------------------------------------------------------------- #
# 3. 5,000 TRAGEDY-FILLED UNWINNABLE SITUATIONS TAXONOMY
# --------------------------------------------------------------------------- #

UNWINNABLE_TRAGEDY_TYPES = [
    (
        "Terminal Diagnosis of a Child",
        "Client's 6-year-old daughter was diagnosed with diffuse intrinsic pontine glioma (DIPG) with a 6-month terminal prognosis. Client is shattered.",
        "Therapist does NOT offer silver linings or hope for miracles. Therapist sits in the unbearable darkness, holds space for immense grief, and offers a grounded, non-judgmental anchor.",
    ),
    (
        "Sudden Fatal Accident of Spouse",
        "Client's husband of 20 years was killed by a drunk driver yesterday. Client feels numb, disoriented, and flooded with unendurable pain.",
        "Therapist validates the profound shock, refrains from rush to resolution, assists with immediate somatic grounding, and honors the devastating loss.",
    ),
    (
        "Irreversible Neurodegenerative Diagnosis",
        "Client (42 years old) was diagnosed with early-stage Huntington's disease. Client knows the exact neurological trajectory.",
        "Therapist validates the profound existential terror and anticipatory grief, helping client process the reality without false comfort.",
    ),
    (
        "Loss of Child to Suicide",
        "Client's teenage son died by suicide two weeks ago. Client is consumed by unbearable guilt ('I should have known').",
        "Therapist holds the immense weight of tragic guilt without offering cheap reassurance, providing a safe container for excruciating grief.",
    ),
]


# --------------------------------------------------------------------------- #
# GENERATOR LOGIC
# --------------------------------------------------------------------------- #


def generate_edge_case_session(category: str, rng: random.Random) -> dict:
    """Generates a multi-turn ChatML session record based on category specifications."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if category == "edge_case":
        diag_name, diag_desc = rng.choice(DIAGNOSES_TAXONOMY)
        persona_name, persona_desc = rng.choice(PERSONA_NICHE_TAXONOMY)

        user_prompt_1 = f"I've been feeling completely overwhelmed lately. As a {persona_name}, {persona_desc} I struggle with {diag_name}. {diag_desc} It feels like I can't catch my breath."
        asst_resp_1 = (
            f"It sounds like you're carrying an incredibly heavy burden. Balancing the intense demands of being a {persona_name} "
            f"while navigating {diag_name} can leave you feeling completely depleted. "
            f"When you say it feels like you can't catch your breath, what somatic or emotional sensations are most prominent right now?"
        )
        user_prompt_2 = "It's like this constant weight on my chest. I keep overthinking everything, afraid that if I drop my guard for even one second, everything will fall apart."
        asst_resp_2 = (
            "That constant hypervigilance—feeling like you have to hold up the world single-handedly—is exhausting. "
            "Your mind and body are working overtime to protect you from falling apart. "
            "Let's take a moment together right now to pause. You don't have to fix everything in this exact minute. "
            "What would it feel like to let your shoulders drop just a fraction of an inch?"
        )
        messages.extend(
            [
                {"role": "user", "content": user_prompt_1},
                {"role": "assistant", "content": asst_resp_1},
                {"role": "user", "content": user_prompt_2},
                {"role": "assistant", "content": asst_resp_2},
            ]
        )

    elif category == "stubborn_nightmare":
        stub_name, user_input, therapist_strategy = rng.choice(STUBBORN_CLIENT_TYPES)

        user_prompt_1 = user_input
        asst_resp_1 = (
            "I hear how frustrated and skeptical you are, and I don't blame you for questioning this process. "
            "If therapy feels like just another rigid, bureaucratic system pushing techniques on you, of course you'd feel defensive. "
            "I'm not here to push a textbook script on you. I'm here to listen to what's genuinely going on for you, on your terms."
        )
        user_prompt_2 = "Yeah right. That's just what you're trained to say. You don't actually care, it's just your 50-minute hour."
        asst_resp_2 = (
            "It makes complete sense that you'd test whether this care is genuine or just professional duty. "
            "Trust isn't something I expect you to give me automatically—it's something earned over time. "
            "Even if you feel completely guarded right now, I am willing to sit here with you and meet you right where you are."
        )
        messages.extend(
            [
                {"role": "user", "content": user_prompt_1},
                {"role": "assistant", "content": asst_resp_1},
                {"role": "user", "content": user_prompt_2},
                {"role": "assistant", "content": asst_resp_2},
            ]
        )

    elif category == "unwinnable_tragedy":
        trag_name, user_input, therapist_strategy = rng.choice(UNWINNABLE_TRAGEDY_TYPES)

        user_prompt_1 = user_input
        asst_resp_1 = (
            "There are no words that can lighten the immense, shattering weight of what you are going through right now. "
            "I will not try to give you empty comfort, silver linings, or tell you that things happen for a reason. "
            "This is an agonizing, unbearable tragedy. I am here to sit in the darkness with you and hold this space so you don't have to carry it entirely alone."
        )
        user_prompt_2 = "I feel like I'm drowning. How am I supposed to survive tomorrow? How do I even breathe?"
        asst_resp_2 = (
            "You don't have to figure out tomorrow, or next week, or the rest of your life right now. "
            "Right now, your only job is surviving this single breath, and then the next one. "
            "I am right here with you. Feel the ground beneath your feet, let yourself weep or be numb—whatever comes, I am holding this anchor with you."
        )
        messages.extend(
            [
                {"role": "user", "content": user_prompt_1},
                {"role": "assistant", "content": asst_resp_1},
                {"role": "user", "content": user_prompt_2},
                {"role": "assistant", "content": asst_resp_2},
            ]
        )

    return {"messages": messages}


def main():
    logger.info("=== Starting Synthetic Edge-Case & Nightmare Session Generation (100,000 Target) ===")
    quality = QualityFilter()
    rng = random.Random(42)

    # 1. Targets
    target_counts = {"edge_case": 75000, "stubborn_nightmare": 20000, "unwinnable_tragedy": 5000}

    # 2. Load existing clean dataset
    local_file = project_root / "dataset/final_dataset.jsonl"
    existing_records = []
    if local_file.exists():
        with open(local_file, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        record = json.loads(line)
                        if quality.passes_filter(record):
                            existing_records.append(record)
                    except Exception:
                        pass
        logger.info("Loaded %d existing clean records into QualityFilter state.", len(existing_records))

    generated_records = []
    category_stats = dict.fromkeys(target_counts, 0)

    for cat, target in target_counts.items():
        logger.info("Generating category '%s' (target: %d)...", cat, target)
        attempts = 0
        accepted = 0
        while accepted < target and attempts < target * 3:
            attempts += 1
            session = generate_edge_case_session(cat, rng)
            if quality.passes_filter(session):
                generated_records.append(session)
                accepted += 1
                category_stats[cat] += 1

            if attempts % 20000 == 0:
                logger.info("  [%s] Generated %d / %d clean sessions...", cat, accepted, target)

        logger.info("Category '%s' complete: %d clean sessions generated.", cat, accepted)

    all_records = existing_records + generated_records
    logger.info("=== Generation & Quality Summary ===")
    logger.info("Previous clean records: %d", len(existing_records))
    logger.info("New synthetic sessions generated: %d", len(generated_records))
    logger.info("Total clean canonical dataset size: %d", len(all_records))

    # Save to local canonical dataset
    local_file.parent.mkdir(parents=True, exist_ok=True)
    with open(local_file, "w", encoding="utf-8") as f:
        for rec in all_records:
            f.write(json.dumps(rec) + "\n")

    file_size_mb = os.path.getsize(local_file) / (1024 * 1024)
    logger.info("Saved %d clean records (%.2f MB) to %s", len(all_records), file_size_mb, local_file)

    # Upload to OVH AI Object Storage
    logger.info("Uploading expanded 100k synthetic session dataset to OVH AI Object Storage (pixeldata@US-EAST-VA)...")
    streamer = S3Streamer()
    streamer.write_jsonl("final_dataset/final_training_dataset.jsonl", all_records)
    logger.info("OVH AI Object Storage upload complete!")


if __name__ == "__main__":
    main()
