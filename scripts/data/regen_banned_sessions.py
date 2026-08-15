"""
regen_banned_sessions.py
========================
1. Scan all pixelated_v2 parquet batches in the OVHcloud bucket
2. Identify sessions with banned opener phrases
3. Regenerate flagged sessions via PsychAgent (vLLM OpenAI-compatible endpoint on the GPU node)
4. Patch the parquet files in-place and re-upload to the bucket

Usage:
  uv run python scripts/data/regen_banned_sessions.py
"""

import json
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from tqdm import tqdm

# ── Config ──────────────────────────────────────────────────────────────
BUCKET = "pixeldata@US-EAST-VA"
BUCKET_PREFIX = "pixelated_v2/parquet-files"
NUM_BATCHES = 200
WORK_DIR = Path("/tmp/pixelated_regen")
VLLM_HOST = "135.148.101.90"  # L40S external IP
VLLM_PORT = 8000
MODEL_NAME = "PsychAgent"
MAX_WORKERS = 4  # parallel batch processing
REGEN_WORKERS = 8  # concurrent regen calls to vLLM
MAX_TOKENS = 512
TEMPERATURE = 0.85
TOP_P = 0.95

BANNED_OPENERS = [
    "i hear how",
    "it makes sense that you feel",
    "i understand your frustration",
    "i can hear",
    "that sounds really",
    "i'm so sorry to hear",
    "thank you for sharing",
    "it sounds like you",
    "i want you to know",
    "i can imagine how",
]

SYSTEM_PROMPT = """You are Pixel, a highly empathetic, clinically precise, and psychologically grounded AI therapist. You balance deep emotional validation, active listening, and evidence-based clinical insights (CBT, DBT, ACT, IFS, Psychodynamic) without toxic positivity or clichés.

CRITICAL RULES — your first response MUST NOT begin with any of these phrases:
- "It sounds like you"
- "I hear how"
- "That sounds really"
- "I can hear"
- "It makes sense that you feel"
- "I understand your frustration"
- "Thank you for sharing"
- "I'm so sorry to hear"
- "I want you to know"
- "I can imagine how"

Instead: open with a precise clinical observation, a grounding question, or a direct reflective statement that shows you truly heard the specific content of what was said — not a generic empathy template."""

# ── Helpers ─────────────────────────────────────────────────────────────


def has_banned_opener(messages) -> bool:
    if isinstance(messages, np.ndarray):
        messages = messages.tolist()
    if not isinstance(messages, list):
        return False
    for m in messages:
        if not isinstance(m, dict) or m.get("role") != "assistant":
            continue
        content = m.get("content", "").lower().strip()
        for banned in BANNED_OPENERS:
            if content.startswith(banned):
                return True
        return False  # only check first assistant turn
    return False


def ovhai_download(batch_name: str, dest: Path) -> bool:
    result = subprocess.run(
        [
            "ovhai",
            "bucket",
            "object",
            "download",
            BUCKET,
            "-p",
            f"{BUCKET_PREFIX}/{batch_name}",
            "-o",
            str(dest) + "/",
            "--remove-prefix",
            f"{BUCKET_PREFIX}/",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and (dest / batch_name).exists()


def ovhai_upload(local_path: Path, remote_name: str) -> bool:
    result = subprocess.run(
        [
            "ovhai",
            "bucket",
            "object",
            "upload",
            BUCKET,
            str(local_path),
            "--name",
            f"{BUCKET_PREFIX}/{remote_name}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0


def wait_for_vllm(timeout: int = 300) -> bool:
    url = f"http://{VLLM_HOST}:{VLLM_PORT}/v1/models"
    print(f"⏳ Waiting for PsychAgent at {url}...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = httpx.get(url, timeout=5)
            if r.status_code == 200:
                models = r.json().get("data", [])
                names = [m["id"] for m in models]
                print(f"✅ vLLM ready — models: {names}")
                return True
        except Exception:
            pass
        time.sleep(5)
    print("❌ vLLM did not become ready in time")
    return False


def regen_session(messages, client: httpx.Client) -> list | None:
    """Regenerate a session using PsychAgent, returning new messages list."""
    if isinstance(messages, np.ndarray):
        messages = messages.tolist()

    # Build prompt: keep system + user turns only, let PsychAgent fill assistant turns
    prompt_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    user_turns = [m for m in messages if isinstance(m, dict) and m.get("role") == "user"]
    asst_turns = [m for m in messages if isinstance(m, dict) and m.get("role") == "assistant"]

    if not user_turns:
        return None

    # Interleave: user → ask PsychAgent → next user → etc.
    new_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    history = [{"role": "system", "content": SYSTEM_PROMPT}]

    for i, user_msg in enumerate(user_turns):
        history.append(user_msg)
        new_messages.append(user_msg)

        try:
            resp = client.post(
                f"http://{VLLM_HOST}:{VLLM_PORT}/v1/chat/completions",
                json={
                    "model": MODEL_NAME,
                    "messages": history,
                    "max_tokens": MAX_TOKENS,
                    "temperature": TEMPERATURE,
                    "top_p": TOP_P,
                },
                timeout=60,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"].strip()
        except Exception:
            return None  # on failure, skip this record

        asst_msg = {"role": "assistant", "content": content}
        history.append(asst_msg)
        new_messages.append(asst_msg)

    return new_messages


def process_batch(batch_name: str, work_dir: Path) -> dict:
    batch_dir = work_dir / batch_name.replace(".parquet", "")
    batch_dir.mkdir(parents=True, exist_ok=True)

    stats = {"batch": batch_name, "flagged": 0, "regenned": 0, "failed": 0, "uploaded": False}

    # Download
    if not ovhai_download(batch_name, batch_dir):
        stats["error"] = "download_failed"
        return stats

    local_path = batch_dir / batch_name
    df = pd.read_parquet(local_path)

    # Identify flagged rows
    flagged_idx = [i for i, row in df.iterrows() if has_banned_opener(row["messages"])]
    stats["flagged"] = len(flagged_idx)

    if not flagged_idx:
        return stats  # nothing to do

    # Regen flagged sessions concurrently
    with httpx.Client() as client:

        def _regen(idx):
            new_msgs = regen_session(df.at[idx, "messages"], client)
            return idx, new_msgs

        with ThreadPoolExecutor(max_workers=REGEN_WORKERS) as ex:
            futures = {ex.submit(_regen, idx): idx for idx in flagged_idx}
            for fut in as_completed(futures):
                idx, new_msgs = fut.result()
                if new_msgs is not None:
                    df.at[idx, "messages"] = np.array(new_msgs, dtype=object)
                    stats["regenned"] += 1
                else:
                    stats["failed"] += 1

    # Save and re-upload
    df.to_parquet(local_path, index=False)
    if ovhai_upload(local_path, batch_name):
        stats["uploaded"] = True
    else:
        stats["error"] = "upload_failed"

    # Cleanup local copy
    shutil.rmtree(batch_dir, ignore_errors=True)
    return stats


# ── Main ─────────────────────────────────────────────────────────────────


def main():
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    # Wait for PsychAgent to be ready
    if not wait_for_vllm(timeout=360):
        raise RuntimeError("PsychAgent vLLM server did not start in time")

    batch_names = [f"batch_{i:05d}.parquet" for i in range(NUM_BATCHES)]

    print(f"\n🔍 Scanning + regenerating {NUM_BATCHES} batches with {MAX_WORKERS} workers...")
    all_stats = []
    total_flagged = 0
    total_regenned = 0
    total_failed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(process_batch, name, WORK_DIR / f"worker_{i % MAX_WORKERS}"): name
            for i, name in enumerate(batch_names)
        }
        with tqdm(total=NUM_BATCHES, unit="batch") as pbar:
            for fut in as_completed(futures):
                stats = fut.result()
                all_stats.append(stats)
                total_flagged += stats["flagged"]
                total_regenned += stats["regenned"]
                total_failed += stats["failed"]
                pbar.set_postfix(flagged=total_flagged, regenned=total_regenned, failed=total_failed)
                pbar.update(1)

    # Summary
    upload_fails = [s for s in all_stats if not s.get("uploaded") and s["flagged"] > 0]
    print(f"""
{"=" * 55}
REGEN COMPLETE
{"=" * 55}
  Total batches processed : {NUM_BATCHES}
  Sessions flagged        : {total_flagged:,}
  Sessions regenerated    : {total_regenned:,}
  Regen failures          : {total_failed:,}
  Upload failures         : {len(upload_fails)}
{"=" * 55}
""")

    # Save stats
    stats_path = WORK_DIR / "regen_stats.json"
    with open(stats_path, "w") as f:
        json.dump(all_stats, f, indent=2)
    print(f"Stats saved to {stats_path}")


if __name__ == "__main__":
    main()
