"""Shared utilities for serverless RL training scripts."""

import json
import logging
import math
import random
from functools import lru_cache

import art
import weave
from transformers import AutoTokenizer


# Suppress harmless W&B artifact-pruning warnings from serverless backend
class _PruneWarningFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "Could not prune old train-state artifacts" not in msg and "404 Client Error" not in msg


def apply_prune_filter() -> None:
    """Apply the prune warning filter to root and all existing loggers."""
    for logger_name in [*logging.root.manager.loggerDict.keys(), ""]:
        logging.getLogger(logger_name).addFilter(_PruneWarningFilter())


@weave.op()
def compute_ngram_overlap(response: str, expected: str, n: int = 2) -> float:
    """Compute n-gram Jaccard similarity for better semantic overlap estimation."""
    res_words = response.lower().split()
    exp_words = expected.lower().split()

    if len(res_words) < n or len(exp_words) < n:
        # Fallback to unigram overlap if very short
        res_set = set(res_words)
        exp_set = set(exp_words)
        return len(res_set & exp_set) / len(exp_set) if exp_set else 0.0

    res_ngrams = {tuple(res_words[i : i + n]) for i in range(len(res_words) - n + 1)}
    exp_ngrams = {tuple(exp_words[i : i + n]) for i in range(len(exp_words) - n + 1)}

    intersection = len(res_ngrams & exp_ngrams)
    union = len(res_ngrams | exp_ngrams)
    return intersection / union if union > 0 else 0.0


@lru_cache(maxsize=1)
def _get_tokenizer():
    """Load and cache the Qwen3 tokenizer for local token-id injection."""
    return AutoTokenizer.from_pretrained(
        "Qwen/Qwen3-30B-A3B-Instruct-2507",
        trust_remote_code=True,
    )


@weave.op()
async def rollout(
    _model: art.Model,
    messages: list,
    _step: int = 0,
) -> art.Trajectory:
    """Generate a response and compute reward via the model's serverless inference endpoint."""
    # Build trajectory from messages (all but last = context, last = expected assistant)
    context = messages[:-1] if len(messages) > 1 else messages
    expected = messages[-1]["content"] if messages else ""

    trajectory = art.Trajectory(
        messages_and_choices=list(context),
        reward=0.0,
        metrics={"response_len": 0, "expected_len": 0, "length_ratio": 0.0},
    )

    # Ensure trajectory ends with user message for generation
    trajectory.messages_and_choices = list(context)

    # Use the model's own serverless vLLM inference endpoint (supports return_token_ids)
    client = _model.openai_client()
    completion = await client.chat.completions.create(
        model=_model.get_inference_name(),
        messages=trajectory.messages(),
        max_tokens=1024,
        temperature=0.8,
        logprobs=True,
        extra_body={"return_token_ids": True},
    )
    choice = completion.choices[0]

    # ------------------------------------------------------------------
    # Ollama compatibility: inject token IDs that the W&B serverless
    # backend requires but Ollama's OpenAI-compatible endpoint omits.
    # ------------------------------------------------------------------
    tokenizer = _get_tokenizer()
    prompt_msgs = trajectory.messages()

    # 1) prompt_token_ids — tokenize the formatted prompt
    prompt_text = tokenizer.apply_chat_template(
        prompt_msgs, tokenize=False, add_generation_prompt=True
    )
    prompt_token_ids = tokenizer.encode(prompt_text, add_special_tokens=False)
    if hasattr(completion, "model_extra") and completion.model_extra is not None:
        completion.model_extra["prompt_token_ids"] = prompt_token_ids
    else:
        object.__setattr__(completion, "prompt_token_ids", prompt_token_ids)
    if getattr(choice, "__pydantic_extra__", None) is None:
        object.__setattr__(choice, "__pydantic_extra__", {})
    choice.__pydantic_extra__["prompt_token_ids"] = prompt_token_ids

    # 2) Per-token token_ids — vLLM with return_tokens_as_token_ids=True
    #    encodes tokens as "token_id:12345" strings.  We emulate that so
    #    the W&B serverless backend can extract IDs from the token field.
    #    We also inject a top-level `token_ids` array on the Choice object
    #    because the W&B backend checks for it explicitly.
    if choice.logprobs and choice.logprobs.content:
        # Sanitize top_logprobs (Ollama returns None, backend expects a list)
        for lp in choice.logprobs.content:
            if getattr(lp, "top_logprobs", None) is None:
                object.__setattr__(lp, "top_logprobs", [])

        # Reconstruct full generated text from logprob tokens
        full_text = "".join(lp.token for lp in choice.logprobs.content)
        response_token_ids = tokenizer.encode(full_text, add_special_tokens=False)

        if len(response_token_ids) == len(choice.logprobs.content):
            for lp, tid in zip(choice.logprobs.content, response_token_ids):
                object.__setattr__(lp, "token", f"token_id:{tid}")
        else:
            # Fallback: tokenize each token individually
            response_token_ids = []
            for lp in choice.logprobs.content:
                tids = tokenizer.encode(lp.token, add_special_tokens=False)
                tid = tids[0] if tids else tokenizer.unk_token_id
                response_token_ids.append(tid)
                object.__setattr__(lp, "token", f"token_id:{tid}")

        # Inject token_ids array onto the Choice object itself
        if getattr(choice, "__pydantic_extra__", None) is None:
            object.__setattr__(choice, "__pydantic_extra__", {})
        choice.__pydantic_extra__["token_ids"] = response_token_ids

    trajectory.messages_and_choices.append(choice)
    # Qwen3 thinking mode: response may live in reasoning rather than content
    response = choice.message.content or ""
    if not response and hasattr(choice.message, "reasoning"):
        response = choice.message.reasoning or ""

    # Compute reward
    response_len = len(response.split())
    expected_len = len(expected.split())

    # Smooth Length reward (Gaussian penalty centered around target length)
    target_len = max(expected_len, 100)  # Aim for expected length or at least 100 words
    sigma = 150.0  # Tolerance for length variance
    length_reward = math.exp(-((response_len - target_len) ** 2) / (2 * sigma**2))

    # Advanced Similarity reward (N-gram overlap)
    overlap = compute_ngram_overlap(response, expected, n=2)

    # Combine rewards (weighting semantic overlap slightly higher)
    trajectory.reward = length_reward * 0.4 + overlap * 0.6
    trajectory.metrics["response_len"] = response_len
    trajectory.metrics["expected_len"] = expected_len
    trajectory.metrics["length_ratio"] = response_len / max(expected_len, 1)
    trajectory.metrics["overlap"] = overlap

    return trajectory


@weave.op()
def log_rl_step(
    step: int,
    avg_reward: float,
    metrics: dict[str, float],
) -> dict:
    """Log per-step RL metrics to Weave."""
    return {
        "step": step,
        "avg_reward": avg_reward,
        "avg_response_len": metrics["response_len"],
        "avg_expected_len": metrics["expected_len"],
        "avg_length_ratio": metrics["length_ratio"],
        "avg_overlap": metrics["overlap"],
    }


def compute_step_metrics(
    train_groups: list,
) -> tuple[float, dict[str, float]]:
    """Compute average reward and metrics dict from train groups."""
    all_rewards = [t.reward for g in train_groups for t in g.trajectories]
    avg_reward = sum(all_rewards) / len(all_rewards) if all_rewards else 0.0

    all_response_lens = [t.metrics.get("response_len", 0) for g in train_groups for t in g.trajectories]
    all_expected_lens = [t.metrics.get("expected_len", 0) for g in train_groups for t in g.trajectories]
    all_length_ratios = [t.metrics.get("length_ratio", 0) for g in train_groups for t in g.trajectories]
    all_overlaps = [t.metrics.get("overlap", 0) for g in train_groups for t in g.trajectories]

    metrics = {
        "response_len": sum(all_response_lens) / len(all_response_lens) if all_response_lens else 0.0,
        "expected_len": sum(all_expected_lens) / len(all_expected_lens) if all_expected_lens else 0.0,
        "length_ratio": sum(all_length_ratios) / len(all_length_ratios) if all_length_ratios else 0.0,
        "overlap": sum(all_overlaps) / len(all_overlaps) if all_overlaps else 0.0,
    }
    return avg_reward, metrics


class ShuffledEpochIterator:
    """Yield batches from a shuffled dataset, reshuffling at epoch boundaries."""

    def __init__(self, examples: list, batch_size: int, seed: int = 42):
        self.examples = examples
        self.batch_size = batch_size
        self.seed = seed
        self.epoch = 0
        self.index = 0
        self._indices: list[int] = []
        self._shuffle()

    def _shuffle(self) -> None:
        rng = random.Random(self.seed + self.epoch)
        self._indices = list(range(len(self.examples)))
        rng.shuffle(self._indices)
        self.index = 0

    def skip(self, n: int) -> None:
        """Skip n examples (used for resume)."""
        while n > 0:
            remaining = len(self._indices) - self.index
            if n >= remaining:
                n -= remaining
                self.epoch += 1
                self._shuffle()
            else:
                self.index += n
                n = 0

    def next_batch(self) -> list:
        """Return the next batch of examples."""
        if self.index + self.batch_size > len(self._indices):
            self.epoch += 1
            self._shuffle()
        batch_indices = self._indices[self.index : self.index + self.batch_size]
        self.index += self.batch_size
        return [self.examples[i] for i in batch_indices]


def load_dataset(path: str) -> list:
    """Load, filter, and deduplicate training dataset."""
    seen: set[str] = set()
    examples = []
    with open(path) as f:
        for line in f:
            data = json.loads(line)
            messages = data.get("messages", [])
            if len(messages) >= 2 and messages[-1].get("role") == "assistant":
                # Fingerprint on first user + first assistant content to dedupe
                user_content = next((m.get("content", "") for m in messages if m.get("role") == "user"), "")[:120]
                assistant_content = next((m.get("content", "") for m in messages if m.get("role") == "assistant"), "")[
                    :120
                ]
                fingerprint = f"{user_content}||{assistant_content}"
                if fingerprint not in seen:
                    seen.add(fingerprint)
                    examples.append(messages)
    return examples
