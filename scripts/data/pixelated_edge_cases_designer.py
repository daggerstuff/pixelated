# /// script
# dependencies = [
#   "data-designer",
#   "pydantic",
#   "openai",
# ]
# ///

"""
High-Speed Triple-Key NVIDIA NIM + 9router + Wayfarer-2 Generator
=================================================================

Architecture:
- Triple Active NVIDIA NIM API Key Pool (Round-Robin):
  * Key 1: ***REMOVED***
  * Key 2: ***REMOVED***
  * Key 3: ***REMOVED***
  Alternates requests across 3 active keys to triple NVIDIA NIM rate limits.
- Routing Rules:
  * Nightmare & Unwinnable Tragedy: Wayfarer-2 on https://ollama.pixelated.love/v1.
  * General Edge Cases: Triple NVIDIA NIM Keys + 9router + Ollama (Wayfarer-2, Qwen3-4B, Psycho).
- 5-Session Array Batching & Global Thread Queue:
  Threads pop instantly from collections.deque() buffer for maximum generation speed.
"""

import json
import logging
import random
import threading
import time
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
_OLLAMA_LOCK = threading.Lock()
_KEY_INDEX = 0
_KEY_LOCK = threading.Lock()

NVIDIA_KEYS = [
    "***REMOVED***",
    "***REMOVED***",
    "***REMOVED***",
]

NIM_CLIENTS = [OpenAI(api_key=k, base_url="https://integrate.api.nvidia.com/v1") for k in NVIDIA_KEYS]

ROUTER_BASE_URL = "http://localhost:20128/v1"
ROUTER_MODELS = ["cmc/deepseek/deepseek-v4-flash", "cerebras/llama-3.3-70b", "meta/llama-3.1-8b-instruct"]

FAST_OLLAMA_MODELS = [
    "richardyoung/qwen3-4b-instruct-2507-abliterated:latest",
    "maxwell1500/psycho:latest",
    "gurubot/wayfarer-2-12B:latest",
]


def get_next_nim_client() -> OpenAI:
    """Gets the next NVIDIA NIM client in round-robin order across 3 keys."""
    global _KEY_INDEX
    with _KEY_LOCK:
        client = NIM_CLIENTS[_KEY_INDEX % len(NIM_CLIENTS)]
        _KEY_INDEX += 1
        return client


def execute_ollama_wayfarer(ollama_client: OpenAI, prompt: str) -> str:
    with _OLLAMA_LOCK:
        time.sleep(0.1)

    try:
        w_res = ollama_client.chat.completions.create(
            model="gurubot/wayfarer-2-12B:latest",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.85,
        )
        return w_res.choices[0].message.content or ""
    except Exception as e:
        logger.debug("Wayfarer-2 request error: %s", e)
        return ""


def execute_fast_ollama(ollama_client: OpenAI, model: str, prompt: str) -> str:
    try:
        res = ollama_client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.85,
        )
        return res.choices[0].message.content or ""
    except Exception:
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


def execute_9router(router_client: OpenAI, model: str, prompt: str) -> str:
    try:
        res = router_client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.85,
            timeout=15.0,
        )
        return res.choices[0].message.content or ""
    except Exception:
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

    # 2. Setup API clients
    router_client = OpenAI(api_key="9router", base_url=ROUTER_BASE_URL)
    ollama_client = OpenAI(
        api_key="ollama", base_url="https://ollama.pixelated.love/v1", default_headers={"User-Agent": "Mozilla/5.0"}
    )

    batch_prompt = (
        f"Generate 5 distinct realistic 4-turn therapy dialogues between clients ({persona}, {diag}) and Pixel (therapist). "
        f"Each session must have 4 alternate turns (user, assistant, user, assistant). "
        f'Output strictly JSON matching: {{"sessions": [[{{"role": "user"|"assistant", "content": "..."}}]]}}'
    )

    raw_payload = ""

    # 3. Model Routing Rules
    if cat in ("stubborn_nightmare", "unwinnable_tragedy"):
        # GRUESOME SHIT STAYS STRICTLY WITH WAYFARER-2
        raw_payload = execute_ollama_wayfarer(ollama_client, batch_prompt)
    else:
        # GENERAL EDGE CASES: Triple-Key NVIDIA NIM + 9router + Ollama Pool
        choice = random.random()
        if choice < 0.45:
            # Triple-Key NVIDIA NIM Pool
            nim_m = random.choice(
                [
                    "meta/llama-3.1-8b-instruct",
                    "nvidia/llama-3.1-nemotron-70b-instruct",
                    "mistralai/mistral-medium-3.5-128b",
                ]
            )
            raw_payload = execute_nim_request(nim_m, batch_prompt)
            if not raw_payload:
                raw_payload = execute_fast_ollama(ollama_client, random.choice(FAST_OLLAMA_MODELS), batch_prompt)
        elif choice < 0.75:
            # 9router Gateway
            m = random.choice(ROUTER_MODELS)
            raw_payload = execute_9router(router_client, m, batch_prompt)
            if not raw_payload:
                raw_payload = execute_fast_ollama(ollama_client, random.choice(FAST_OLLAMA_MODELS), batch_prompt)
        else:
            # Ollama Pool (Qwen3-4B / Psycho / Wayfarer-2)
            m = random.choice(FAST_OLLAMA_MODELS)
            raw_payload = execute_fast_ollama(ollama_client, m, batch_prompt)

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
