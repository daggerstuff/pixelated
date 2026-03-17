#!/usr/bin/env python3
"""Evaluate model output repetition against golden prompts.

This script is intended for post-training verification of anti-repetition retraining.
It loads a base model (optionally with a LoRA adapter), generates responses for each
prompt in a JSON evaluation set, and computes repetition metrics.

Usage:
  uv run python scripts/training/evaluate_repetition.py \
    --model-path LatitudeGames/Wayfarer-2-12B \
    --adapter-path /path/to/lora_adapter \
    --prompts-file ai/lab/evals/golden_questions.json \
    --output-file ai/lab/evals/repetition_report.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

try:
    from peft import PeftModel
except ImportError:  # pragma: no cover - optional dependency at runtime
    PeftModel = None


WORD_RE = re.compile(r"\b\w+\b", flags=re.UNICODE)


@dataclass
class RepetitionMetrics:
    consecutive_repeat_max: int
    repeated_ngram_ratio: float
    repeated_ngram_count: int
    unique_ngram_count: int
    is_degenerate: bool


def tokenize_words(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def max_consecutive_word_repeat(words: list[str]) -> int:
    if not words:
        return 0

    current = 1
    best = 1
    for idx in range(1, len(words)):
        if words[idx] == words[idx - 1]:
            current += 1
            if current > best:
                best = current
        else:
            current = 1

    return best


def repeated_ngram_ratio(words: list[str], n: int = 3) -> tuple[float, int, int]:
    if len(words) < n:
        return 0.0, 0, 0

    ngrams = [tuple(words[i : i + n]) for i in range(len(words) - n + 1)]
    counts = Counter(ngrams)
    repeated = sum(1 for count in counts.values() if count > 1)
    unique = len(counts)
    ratio = repeated / unique if unique else 0.0
    return ratio, repeated, unique


def detect_degenerate_repetition(
    text: str,
    consecutive_threshold: int = 4,
    ngram_repeat_ratio_threshold: float = 0.2,
) -> RepetitionMetrics:
    words = tokenize_words(text)
    consecutive_max = max_consecutive_word_repeat(words)
    ratio, repeated_count, unique_count = repeated_ngram_ratio(words, n=3)
    is_degenerate = consecutive_max >= consecutive_threshold or ratio >= ngram_repeat_ratio_threshold

    return RepetitionMetrics(
        consecutive_repeat_max=consecutive_max,
        repeated_ngram_ratio=ratio,
        repeated_ngram_count=repeated_count,
        unique_ngram_count=unique_count,
        is_degenerate=is_degenerate,
    )


def load_prompts(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array in {path}, found {type(data).__name__}")

    prompts: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        prompt = item.get("prompt")
        if isinstance(prompt, str) and prompt.strip():
            prompts.append(item)

    if not prompts:
        raise ValueError(f"No prompts found in {path}")

    return prompts


def infer_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_model_and_tokenizer(model_path: str, adapter_path: str | None, device: str):
    dtype = torch.bfloat16 if device == "cuda" else torch.float32

    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=dtype,
        device_map="auto" if device == "cuda" else None,
        trust_remote_code=True,
    )

    if adapter_path:
        if PeftModel is None:
            raise RuntimeError("peft is required when --adapter-path is provided")
        model = PeftModel.from_pretrained(model, adapter_path)

    model.eval()
    if device != "cuda":
        model.to(device)

    return model, tokenizer


def generate_response(
    model,
    tokenizer,
    prompt: str,
    device: str,
    max_new_tokens: int,
    temperature: float,
    top_p: float,
) -> str:
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=1024)
    if device != "cuda":
        inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0,
            temperature=max(temperature, 1e-6),
            top_p=top_p,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
            repetition_penalty=1.1,
        )

    generated_ids = output_ids[0][inputs["input_ids"].shape[1] :]
    return tokenizer.decode(generated_ids, skip_special_tokens=True).strip()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate repetition in generated model outputs")
    parser.add_argument("--model-path", required=True, help="Base model path or Hugging Face ID")
    parser.add_argument("--adapter-path", default=None, help="Optional LoRA adapter path")
    parser.add_argument(
        "--prompts-file",
        default="ai/lab/evals/golden_questions.json",
        help="JSON file containing prompt objects with a 'prompt' key",
    )
    parser.add_argument(
        "--output-file",
        default="ai/lab/evals/repetition_report.json",
        help="Output JSON report path",
    )
    parser.add_argument("--max-new-tokens", type=int, default=220)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--top-p", type=float, default=0.9)
    parser.add_argument("--limit", type=int, default=0, help="Optional number of prompts to evaluate")
    parser.add_argument(
        "--target-max-repetition-rate",
        type=float,
        default=0.05,
        help="Pass criterion: max fraction of degenerate outputs",
    )
    parser.add_argument(
        "--consecutive-threshold",
        type=int,
        default=4,
        help="Consecutive same-word threshold for degeneration",
    )
    parser.add_argument(
        "--ngram-ratio-threshold",
        type=float,
        default=0.2,
        help="Repeated trigram ratio threshold for degeneration",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()

    prompts = load_prompts(Path(args.prompts_file))
    if args.limit > 0:
        prompts = prompts[: args.limit]

    device = infer_device()
    print(f"[INFO] Device: {device}")
    print(f"[INFO] Loading model: {args.model_path}")
    if args.adapter_path:
        print(f"[INFO] Loading adapter: {args.adapter_path}")

    model, tokenizer = load_model_and_tokenizer(args.model_path, args.adapter_path, device)

    results: list[dict[str, Any]] = []
    degenerate_count = 0

    for index, item in enumerate(prompts, start=1):
        prompt = item["prompt"]
        response = generate_response(
            model,
            tokenizer,
            prompt,
            device=device,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
        )

        metrics = detect_degenerate_repetition(
            response,
            consecutive_threshold=args.consecutive_threshold,
            ngram_repeat_ratio_threshold=args.ngram_ratio_threshold,
        )

        if metrics.is_degenerate:
            degenerate_count += 1

        results.append(
            {
                "id": item.get("id"),
                "category": item.get("category"),
                "priority": item.get("priority"),
                "prompt": prompt,
                "response": response,
                "metrics": asdict(metrics),
            }
        )

        print(
            f"[INFO] {index}/{len(prompts)} {item.get('id', 'N/A')} "
            f"degenerate={metrics.is_degenerate} "
            f"consecutive_max={metrics.consecutive_repeat_max} "
            f"ngram_ratio={metrics.repeated_ngram_ratio:.3f}"
        )

    total = len(results)
    repetition_rate = (degenerate_count / total) if total else math.nan

    summary = {
        "model_path": args.model_path,
        "adapter_path": args.adapter_path,
        "prompts_file": args.prompts_file,
        "total_prompts": total,
        "degenerate_outputs": degenerate_count,
        "repetition_rate": repetition_rate,
        "target_max_repetition_rate": args.target_max_repetition_rate,
        "passes_target": repetition_rate <= args.target_max_repetition_rate if total else False,
        "thresholds": {
            "consecutive_threshold": args.consecutive_threshold,
            "ngram_ratio_threshold": args.ngram_ratio_threshold,
        },
        "generation": {
            "max_new_tokens": args.max_new_tokens,
            "temperature": args.temperature,
            "top_p": args.top_p,
        },
    }

    report = {
        "summary": summary,
        "results": results,
    }

    output_path = Path(args.output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("\n=== REPETITION EVALUATION SUMMARY ===")
    print(json.dumps(summary, indent=2))
    print(f"[INFO] Report written to: {output_path}")

    return 0 if summary["passes_target"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
