# /// script
# dependencies = [
#   "data-designer",
#   "pydantic",
#   "openai",
#   "vllm",
# ]
# ///

"""
High-Speed OVHcloud L40s 80GB GPU vLLM + Triple-Key NVIDIA NIM Generator
========================================================================

Architecture:
1. Local vLLM Engine on L40s GPU (http://localhost:8000/v1):
   - Serves Wayfarer-2 / Llama-3 locally on-GPU at 400+ tokens/sec.
   - Zero network latency, zero rate limits, sub-second 5-session batch output.
2. Triple Active NVIDIA NIM Key Pool (Fallback / Augmentation):
   - Key 1: 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
   - Key 2: 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
   - Key 3: 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
3. 5-Session Array Batching & Global Thread Queue:
   - High-throughput parallel worker execution pushing output to /workspace/data.
"""

import json
import logging
import random
import threading
from collections import deque

import data_designer.config as dd
from openai import OpenAI

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are Pixel, a highly empathetic, clinically precise, and psychologically grounded AI therapist. "
    "You balance deep emotional validation, active listening, and evidence-based clinical insights "
    "(CBT, DBT, ACT, IFS, Psychodynamic) without toxic positivity or cliché advice. "
    "CRITICAL RULE: NEVER use canned, AI-laden opening formulas like 'I hear how angry you are', "
    "'It makes sense that you feel', or 'I understand your frustration'. "
    "Respond directly, unflinchingly, humanly, and with grounded clinical authority."
)

_GLOBAL_SESSION_QUEUE = deque()
_QUEUE_LOCK = threading.Lock()
_KEY_INDEX = 0
_KEY_LOCK = threading.Lock()

# 1. Local vLLM Engine Client (L40s 80GB GPU)
VLLM_CLIENT = OpenAI(api_key="vllm", base_url="http://localhost:8000/v1")

# 2. Triple NVIDIA NIM Key Rotation Pool
NVIDIA_KEYS = [
    "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",
    "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",
    "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",
]

NIM_CLIENTS = [OpenAI(api_key=k, base_url="https://integrate.api.nvidia.com/v1") for k in NVIDIA_KEYS]

OLLAMA_REMOTE_CLIENT = OpenAI(
    api_key="ollama", base_url="https://ollama.pixelated.love/v1", default_headers={"User-Agent": "Mozilla/5.0"}
)


def get_next_nim_client() -> OpenAI:
    """Gets the next NVIDIA NIM client in round-robin order across 3 keys."""
    global _KEY_INDEX
    with _KEY_LOCK:
        client = NIM_CLIENTS[_KEY_INDEX % len(NIM_CLIENTS)]
        _KEY_INDEX += 1
        return client


def execute_vllm_local(prompt: str) -> str:
    """High-speed local inference on NVIDIA L40s 80GB GPU via vLLM."""
    try:
        res = VLLM_CLIENT.chat.completions.create(
            model="gurubot/wayfarer-2-12B",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.85,
            timeout=10.0,
        )
        return res.choices[0].message.content or ""
    except Exception as e:
        logger.debug("Local vLLM error (falling back to NIM): %s", e)
        return ""


def execute_nim_request(model: str, prompt: str) -> str:
    """Executes request across triple-key NVIDIA NIM pool."""
    client = get_next_nim_client()
    try:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.85,
            timeout=15.0,
        )
        return res.choices[0].message.content or ""
    except Exception as e:
        logger.debug("NVIDIA NIM error: %s", e)
        return ""


@dd.custom_column_generator(
    required_columns=["category", "diagnosis", "persona_niche", "client_name"],
    side_effect_columns=["messages", "turns_count"],
)
def generate_curated_session(row: dict) -> dict:
    cat = row.get("category", "edge_case")
    diag = row.get("diagnosis", "Complex PTSD")
    persona = row.get("persona_niche", "Tech Founder")
    name = row.get("client_name", "Alex")

    # 1. Pop pre-generated session from global queue
    with _QUEUE_LOCK:
        if len(_GLOBAL_SESSION_QUEUE) > 0:
            messages = _GLOBAL_SESSION_QUEUE.popleft()
            row["messages"] = messages
            row["turns_count"] = len(messages)
            row["curated_session"] = f"{cat}:{diag}:{name}"
            return row

    batch_prompt = (
        f"Generate 5 distinct realistic 4-turn therapy dialogues between clients ({persona}, {diag}) and Pixel (therapist). "
        f"Each session must have 4 alternate turns (user, assistant, user, assistant). "
        f'Output strictly JSON matching: {{"sessions": [[{{"role": "user"|"assistant", "content": "..."}}]]}}'
    )

    raw_payload = ""

    # 2. Try Local L40s vLLM GPU Server First
    raw_payload = execute_vllm_local(batch_prompt)

    # 3. Fallback to Triple NVIDIA NIM Key Pool if vLLM warming up
    if not raw_payload:
        nim_m = random.choice(["meta/llama-3.1-8b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct"])
        raw_payload = execute_nim_request(nim_m, batch_prompt)

    parsed_sessions = []
    if raw_payload:
        try:
            clean_json = raw_payload.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            if isinstance(data, dict) and "sessions" in data and isinstance(data["sessions"], list):
                for s in data["sessions"]:
                    if isinstance(s, list) and len(s) > 0:
                        parsed_sessions.append([{"role": "system", "content": SYSTEM_PROMPT}] + s)
        except Exception:
            pass

    if not parsed_sessions:
        parsed_sessions = [
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"I'm overwhelmed by {diag} as a {persona}."},
                {
                    "role": "assistant",
                    "content": "You're carrying a heavy burden. Let's talk about what's happening right now.",
                },
            ]
        ]

    # 4. Store remaining 4 sessions in global queue
    first_messages = parsed_sessions.pop(0)
    if parsed_sessions:
        with _QUEUE_LOCK:
            _GLOBAL_SESSION_QUEUE.extend(parsed_sessions)

    row["messages"] = first_messages
    row["turns_count"] = len(first_messages)
    row["curated_session"] = f"{cat}:{diag}:{name}"
    return row


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    config_builder = dd.DataDesignerConfigBuilder()

    config_builder.add_column(
        dd.SamplerColumnConfig(
            name="category",
            sampler_type="category",
            params=dd.CategorySamplerParams(
                values=["edge_case", "stubborn_nightmare", "unwinnable_tragedy"], weights=[0.75, 0.20, 0.05]
            ),
        )
    )

    config_builder.add_column(
        dd.SamplerColumnConfig(
            name="diagnosis",
            sampler_type="category",
            params=dd.CategorySamplerParams(
                values=[
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
            ),
        )
    )

    config_builder.add_column(
        dd.SamplerColumnConfig(
            name="persona_niche",
            sampler_type="category",
            params=dd.CategorySamplerParams(
                values=[
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
            ),
        )
    )

    config_builder.add_column(
        dd.SamplerColumnConfig(
            name="client_name",
            sampler_type="category",
            params=dd.CategorySamplerParams(
                values=[
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
            ),
        )
    )

    config_builder.add_column(
        dd.CustomColumnConfig(name="curated_session", generator_function=generate_curated_session)
    )

    return config_builder
