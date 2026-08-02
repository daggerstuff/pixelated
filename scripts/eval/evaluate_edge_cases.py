"""
Pixelated Edge Case Dataset Evaluator
======================================
Evaluates the pixelated_v2 edge case dataset across:
1. Schema & Structural Integrity
2. Category Distribution (edge_case / stubborn_nightmare / unwinnable_tragedy)
3. Diagnosis & Persona Coverage
4. Session Quality Metrics:
   - Turn count distribution
   - Message length distribution
   - Banned opener detection (AI clichés)
   - Fallback session detection (malformed / minimal)
   - JSON decode rate
5. Sample output (2 sessions per category)
"""

import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

EVAL_DIR = Path("/tmp/pixelated_v2_eval")
BATCHES = list(EVAL_DIR.glob("*.parquet"))

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


def load_all(batches):
    dfs = []
    for b in sorted(batches):
        try:
            dfs.append(pd.read_parquet(b))
        except Exception as e:
            sys.stdout.write(f"  ⚠ Failed to load {b.name}: {e}\n")
    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()


def check_banned_opener(text: str) -> str | None:
    t = text.lower().strip()
    for b in BANNED_OPENERS:
        if t.startswith(b) or f"\n{b}" in t:
            return b
    return None


def eval_session(messages):
    # messages can be a numpy ndarray of dicts, a list, or a JSON string
    if isinstance(messages, np.ndarray):
        messages = messages.tolist()
    elif isinstance(messages, str):
        try:
            messages = json.loads(messages)
        except Exception:
            return {"valid": False, "reason": "json_parse_error"}
    if not isinstance(messages, list):
        return {"valid": False, "reason": f"messages not a list (got {type(messages).__name__})"}

    user_turns = [m for m in messages if isinstance(m, dict) and m.get("role") == "user"]
    asst_turns = [m for m in messages if isinstance(m, dict) and m.get("role") == "assistant"]

    if len(asst_turns) == 0:
        return {"valid": False, "reason": "no assistant turns"}

    banned_hits = []
    total_asst_chars = 0
    for m in asst_turns:
        content = m.get("content", "")
        total_asst_chars += len(content)
        hit = check_banned_opener(content)
        if hit:
            banned_hits.append(hit)

    is_fallback = len(user_turns) == 1 and len(asst_turns) == 1 and total_asst_chars < 120

    return {
        "valid": True,
        "user_turns": len(user_turns),
        "asst_turns": len(asst_turns),
        "total_turns": len(messages),
        "avg_asst_chars": total_asst_chars / max(len(asst_turns), 1),
        "banned_hits": banned_hits,
        "is_fallback": is_fallback,
    }


def print_category_distribution(df):
    sys.stdout.write(f"\n{'─' * 40}\n")
    sys.stdout.write("1. CATEGORY DISTRIBUTION\n")
    if "category" in df.columns:
        cats = df["category"].value_counts()
        for cat, count in cats.items():
            pct = count / len(df) * 100
            sys.stdout.write(f"  {cat:<30} {count:>5}  ({pct:.1f}%)\n")


def print_diagnosis_coverage(df):
    sys.stdout.write(f"\n{'─' * 40}\n")
    sys.stdout.write("2. DIAGNOSIS COVERAGE\n")
    if "diagnosis" in df.columns:
        diags = df["diagnosis"].value_counts()
        sys.stdout.write(f"  Unique diagnoses: {df['diagnosis'].nunique()}\n")
        for d, c in diags.head(5).items():
            sys.stdout.write(f"  {d[:45]:<46} {c:>4}\n")
        if len(diags) > 5:
            sys.stdout.write(f"  ... and {len(diags) - 5} more\n")


def print_persona_coverage(df):
    sys.stdout.write(f"\n{'─' * 40}\n")
    sys.stdout.write("3. PERSONA COVERAGE\n")
    if "persona_niche" in df.columns:
        personas = df["persona_niche"].value_counts()
        sys.stdout.write(f"  Unique personas: {df['persona_niche'].nunique()}\n")
        for p, c in personas.head(5).items():
            sys.stdout.write(f"  {p[:45]:<46} {c:>4}\n")


def print_session_quality_metrics(df):
    sys.stdout.write(f"\n{'─' * 40}\n")
    sys.stdout.write("4. SESSION QUALITY METRICS\n")

    results = []
    for _, row in df.iterrows():
        messages = row.get("messages")
        results.append(eval_session(messages))

    valid = [r for r in results if r.get("valid")]
    invalid = [r for r in results if not r.get("valid")]
    fallbacks = [r for r in valid if r.get("is_fallback")]
    banned = [r for r in valid if r.get("banned_hits")]

    sys.stdout.write(
        f"  Valid sessions:      {len(valid):>5} / {len(results)} ({len(valid) / len(results) * 100:.1f}%)\n"
    )
    sys.stdout.write(f"  Invalid/malformed:   {len(invalid):>5} ({len(invalid) / len(results) * 100:.1f}%)\n")
    sys.stdout.write(f"  Fallback (stub):     {len(fallbacks):>5} ({len(fallbacks) / len(results) * 100:.1f}%)\n")
    sys.stdout.write(f"  Banned opener hits:  {len(banned):>5} ({len(banned) / len(results) * 100:.1f}%)\n")

    if valid:
        avg_turns = sum(r["total_turns"] for r in valid) / len(valid)
        avg_asst_chars = sum(r["avg_asst_chars"] for r in valid) / len(valid)
        sys.stdout.write(f"  Avg turns/session:   {avg_turns:.1f}\n")
        sys.stdout.write(f"  Avg asst chars/turn: {avg_asst_chars:.0f}\n")

    if banned:
        all_banned = []
        for r in banned:
            all_banned.extend(r["banned_hits"])
        sys.stdout.write("\n  Top banned openers found:\n")
        for phrase, count in Counter(all_banned).most_common(5):
            sys.stdout.write(f"    '{phrase}' — {count}x\n")

    if invalid:
        reasons = Counter(r.get("reason", "unknown") for r in invalid)
        sys.stdout.write("\n  Invalid reasons:\n")
        for reason, count in reasons.items():
            sys.stdout.write(f"    {reason}: {count}\n")


def print_sample_output(df):
    sys.stdout.write(f"\n{'─' * 40}\n")
    sys.stdout.write("5. SAMPLE SESSIONS\n")

    for cat in ["edge_case", "stubborn_nightmare", "unwinnable_tragedy"]:
        subset = df[df["category"] == cat] if "category" in df.columns else df
        if len(subset) == 0:
            continue
        sample = subset.sample(1).iloc[0]

        messages = sample.get("messages")
        if isinstance(messages, np.ndarray):
            messages = messages.tolist()
        elif isinstance(messages, str):
            try:
                messages = json.loads(messages)
            except Exception:
                continue
        if not isinstance(messages, list):
            continue

        sys.stdout.write(f"\n  [{cat.upper()}] — {sample.get('diagnosis', '?')} / {sample.get('persona_niche', '?')}\n")
        for m in messages:
            if not isinstance(m, dict) or m.get("role") == "system":
                continue
            role = m.get("role", "?").upper()
            content = m.get("content", "")[:300]
            sys.stdout.write(f"    {role}: {content}{'...' if len(m.get('content', '')) > 300 else ''}\n")


def main():
    sys.stdout.write(f"\n{'=' * 60}\n")
    sys.stdout.write("PIXELATED v2 EDGE CASE DATASET — EVALUATION REPORT\n")
    sys.stdout.write(f"{'=' * 60}\n")
    sys.stdout.write(f"Batches analyzed: {len(BATCHES)} ({', '.join(b.name for b in sorted(BATCHES))})\n")

    df = load_all(BATCHES)
    if df.empty:
        sys.stdout.write("ERROR: No data loaded.\n")
        return

    sys.stdout.write(f"Total records in sample: {len(df):,}\n")
    sys.stdout.write(f"\nColumns: {list(df.columns)}\n")

    print_category_distribution(df)
    print_diagnosis_coverage(df)
    print_persona_coverage(df)
    print_session_quality_metrics(df)
    print_sample_output(df)

    sys.stdout.write(f"\n{'=' * 60}\n")
    sys.stdout.write("EVALUATION COMPLETE\n")
    sys.stdout.write(f"{'=' * 60}\n\n")


if __name__ == "__main__":
    main()
