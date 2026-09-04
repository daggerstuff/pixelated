from __future__ import annotations

import hashlib
import json
import math
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import replace
from pathlib import Path
from typing import Any

from skillrevise.core.env import env_names, get_env
from skillrevise.core.models import (
    DiagnosisReport,
    FailureType,
    RepairPrinciple,
    TaskSpec,
)

from .principles_types import (
    AbsorbedPrincipleAbstraction,
    PrincipleRetrievalCandidate,
    PrincipleRetrievalConfig,
)


def _abstract_absorbed_repair(
    *, target: str, evidence: str, task: TaskSpec, diagnosis: DiagnosisReport
) -> AbsorbedPrincipleAbstraction | None:
    """Convert an episode-local repair note into a transferable bank principle.

    The bank should remember condition-action repair patterns, not task answers.
    Raw targets and verifier snippets stay in supporting episode provenance.
    """
    context = " ".join([target, evidence, diagnosis.causal_judgment, diagnosis.summary]).lower()
    labels = {label.value for label in diagnosis.labels}

    if _mentions_sentinel_convention(context):
        return AbsorbedPrincipleAbstraction(
            title="Sentinel Convention Repair",
            trigger=(
                "verifier evidence shows that a sentinel or boundary value is an allowed interface exception, "
                "not an ordinary data object"
            ),
            action_template=(
                "preserve the sentinel in the fields where the verifier allows it, but exclude it from "
                "ordinary materialized-object sets, traversal queues, and invariant checks when the verifier "
                "defines it as terminal or exceptional"
            ),
            verification_template=(
                "Mirror the verifier traversal or invariant locally: allowed sentinels may appear only in the "
                "exception-bearing field, and ordinary objects must still satisfy reachability or membership checks."
            ),
            trigger_keywords=["verifier", "sentinel", "terminal", "boundary", "exception", "interface"],
            retrieval_tags=["sentinel convention", "boundary value", "interface exception", "reachability"],
        )

    if _mentions_output_artifact(context):
        return AbsorbedPrincipleAbstraction(
            title="Verifier-Visible Artifact Repair",
            trigger="verifier evidence indicates that required artifacts are missing or written outside verifier scope",
            action_template=(
                "derive every required artifact path from the prompt or tests, write artifacts to the "
                "verifier-visible output locations, and assert that each required artifact exists and is readable "
                "before finalizing"
            ),
            verification_template=(
                "Run a final existence/readability check for every required output path from the verifier-visible "
                "working context."
            ),
            trigger_keywords=["verifier", "artifact", "output", "path", "existence", "readable"],
            retrieval_tags=["verifier-visible output", "artifact existence", "path grounding"],
        )

    if _mentions_assertion_mirroring(context):
        return AbsorbedPrincipleAbstraction(
            title="Verifier Assertion Mirroring Repair",
            trigger="verifier evidence exposes a concrete assertion that the skill did not check before finalizing",
            action_template=(
                "translate the failed verifier assertion into a local pre-finalization check with the same "
                "expected-versus-actual condition, while preserving already-passing behavior"
            ),
            verification_template=(
                "Re-run or restate the failed assertion locally and confirm the previous passing checks still pass."
            ),
            trigger_keywords=["verifier", "assertion", "precheck", "expected", "actual", "invariant"],
            retrieval_tags=["assertion mirroring", "pre-finalization check", "verifier alignment"],
        )

    if _mentions_input_invariant_repair(context) or FailureType.FALSE_CERTAINTY.value in labels:
        return AbsorbedPrincipleAbstraction(
            title="Input Invariant Repair",
            trigger="the skill assumes clean inputs, complete intermediate state, or successful tool results without proof",
            action_template=(
                "validate inputs, intermediate invariants, and tool outputs before using them; when validation fails, "
                "fallback explicitly or stop with a targeted repair instead of continuing from an unchecked assumption"
            ),
            verification_template=(
                "Add local checks for required fields, ranges, counts, and generated artifacts before the final answer."
            ),
            trigger_keywords=["validation", "fallback", "invariant", "assumption", "false_certainty"],
            retrieval_tags=["input validation", "fallback handling", "strict invariant checks"],
        )

    if _mentions_hardcoding_repair(context) or FailureType.OVER_SPECIFICITY.value in labels:
        return AbsorbedPrincipleAbstraction(
            title="Anti-Hardcoding Repair",
            trigger="the skill overfits to task-instance paths, commands, versions, constants, or example values",
            action_template=(
                "replace task-instance hardcoding with discovery steps and conditional checks that derive paths, "
                "commands, versions, and constants from the current workspace or verifier contract"
            ),
            verification_template="Run the derived command or path check in the current workspace before finalizing.",
            trigger_keywords=["hardcoding", "discovery", "conditional", "path", "version", "constant"],
            retrieval_tags=["anti-hardcoding", "conditional discovery", "workspace grounding"],
        )

    if _mentions_concision_repair(context) or FailureType.CONTEXT_POLLUTION.value in labels:
        return AbsorbedPrincipleAbstraction(
            title="Action-Driving Skill Concision Repair",
            trigger="the revised skill contains repeated, stale, or low-signal guidance that crowds out executable checks",
            action_template=(
                "remove duplicated or non-operational prose and keep only guidance that changes inspection, "
                "implementation, validation, or recovery behavior"
            ),
            verification_template=(
                "Confirm every retained instruction maps to an observable action, check, fallback, or preserve constraint."
            ),
            trigger_keywords=["context_pollution", "concision", "repeated", "stale", "actionable"],
            retrieval_tags=["skill concision", "action-driving guidance", "context hygiene"],
        )

    return None


def _mentions_sentinel_convention(text: str) -> bool:
    return any(keyword in text for keyword in ["sentinel", "terminal", "boundary value"]) or bool(
        re.search(r"\b(end|stop|done|null|none|n/?a|unknown)\b", text)
        and any(keyword in text for keyword in ["reachab", "travers", "node", "edge", "queue", "target"])
    )


def _mentions_output_artifact(text: str) -> bool:
    return any(
        keyword in text
        for keyword in [
            "verifier-visible output",
            "output path",
            "artifact",
            "file not found",
            "solution file not found",
            "required output",
            "exists and is readable",
        ]
    )


def _mentions_assertion_mirroring(text: str) -> bool:
    return any(keyword in text for keyword in ["verifier assertion", "failed assertion", "assertion"]) or (
        "expected" in text and "actual" in text
    )


def _mentions_input_invariant_repair(text: str) -> bool:
    return any(
        keyword in text
        for keyword in [
            "input validation",
            "fallback",
            "strict constraint",
            "constraint check",
            "validate inputs",
            "missing fallback",
        ]
    )


def _mentions_hardcoding_repair(text: str) -> bool:
    return any(keyword in text for keyword in ["hard-code", "hard coded", "hardcoded", "fixed path", "fixed command"])


def _mentions_concision_repair(text: str) -> bool:
    return any(
        keyword in text
        for keyword in [
            "trim repeated",
            "low-signal",
            "low signal",
            "repeated guidance",
            "non-operational",
            "context pollution",
        ]
    )


def _contains_task_local_anchor(text: str, task: TaskSpec) -> bool:
    lowered = text.lower()
    if task.task_id.lower() in lowered:
        return True
    if re.search(r"(/[\w./-]+|[A-Za-z0-9_-]+\.(json|py|csv|txt|pdf|dot|sh|toml|ya?ml|png|jpe?g))", text):
        return True
    if re.search(r"`[^`]+`", text):
        return True
    return False


def _principle_to_jsonable(principle: RepairPrinciple) -> dict[str, object]:
    principle = _materialize_principle(principle)
    return {
        "principle_id": principle.principle_id,
        "title": principle.title,
        "defect_labels": principle.defect_labels,
        "failure_types": [item.value for item in principle.failure_types],
        "trigger_keywords": principle.trigger_keywords,
        "trigger_evidence": principle.trigger_evidence,
        "repair_rule": principle.repair_rule,
        "transfer_constraint": principle.transfer_constraint,
        "supporting_cases": principle.supporting_cases,
        "acceptance_evidence": principle.acceptance_evidence,
        "intent": principle.intent,
        "trigger": principle.trigger,
        "applicable_failure_modes": principle.applicable_failure_modes,
        "evidence_requirements": principle.evidence_requirements,
        "retrieval_text": principle.retrieval_text,
        "action_template": principle.action_template,
        "verification_template": principle.verification_template,
        "escalation_rule": principle.escalation_rule,
        "supporting_episodes": principle.supporting_episodes,
        "negative_episodes": principle.negative_episodes,
        "utility_stats": principle.utility_stats,
        "provenance": principle.provenance,
        "version": principle.version,
        "status": principle.status,
    }


def _materialize_principle(principle: RepairPrinciple, *, source: str | None = None) -> RepairPrinciple:
    provenance = dict(principle.provenance)
    if source and not provenance:
        provenance = {"source": source, "created_from_episode": None}
    elif not provenance:
        provenance = {"source": "unknown", "created_from_episode": None}

    applicable_failure_modes = principle.applicable_failure_modes or [
        failure_type.value for failure_type in principle.failure_types
    ]
    intent = principle.intent or _fallback_intent(principle)
    trigger = principle.trigger or principle.trigger_evidence
    action_template = principle.action_template or principle.repair_rule
    retrieval_text = principle.retrieval_text or _principle_retrieval_text(
        replace(
            principle,
            intent=intent,
            trigger=trigger,
            applicable_failure_modes=applicable_failure_modes,
            action_template=action_template,
        )
    )
    utility_stats = dict(principle.utility_stats)
    utility_stats.setdefault("episodes_used", 0.0)
    utility_stats.setdefault("episodes_positive", 0.0)
    utility_stats.setdefault("episodes_neutral", 0.0)
    utility_stats.setdefault("episodes_negative", 0.0)
    utility_stats.setdefault("avg_reward_delta", 0.0)
    utility_stats.setdefault("avg_failed_assertion_delta", 0.0)

    return replace(
        principle,
        intent=intent,
        trigger=trigger,
        applicable_failure_modes=applicable_failure_modes,
        evidence_requirements=principle.evidence_requirements
        or ["Apply only when observable trajectory or verifier evidence supports the trigger."],
        retrieval_text=retrieval_text,
        action_template=action_template,
        verification_template=principle.verification_template
        or "Verify the repaired behavior against the observable contract before finalizing.",
        escalation_rule=principle.escalation_rule
        or "If the same failure repeats within an episode, escalate from local patching to a stronger method-level repair.",
        utility_stats=utility_stats,
        provenance=provenance,
    )


def _keywords_for(task: TaskSpec, diagnosis: DiagnosisReport) -> list[str]:
    keywords = [task.family]
    keywords.extend(label.value for label in diagnosis.labels)
    for evidence in diagnosis.evidence[:3]:
        keywords.extend(_simple_tokens(evidence.snippet))
    deduped: list[str] = []
    for keyword in keywords:
        keyword = keyword.lower().strip()
        if keyword and keyword not in deduped:
            deduped.append(keyword)
    return deduped[:12]


def _simple_tokens(text: str) -> list[str]:
    tokens = []
    for raw in text.replace("/", " ").replace("_", " ").replace("-", " ").split():
        token = raw.strip("`'\".,:;()[]{}").lower()
        if len(token) >= 4 and token.isascii():
            tokens.append(token)
    return tokens[:8]


def _shorten(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 3] + "..."


def _principle_retrieval_text(principle: RepairPrinciple) -> str:
    if principle.retrieval_text:
        return principle.retrieval_text
    return " ".join(
        [
            principle.title,
            principle.intent,
            principle.trigger,
            " ".join(principle.defect_labels),
            " ".join(item.value for item in principle.failure_types),
            " ".join(principle.trigger_keywords),
            principle.trigger_evidence,
            principle.repair_rule,
            principle.action_template,
            principle.verification_template,
            principle.escalation_rule,
            principle.transfer_constraint,
            " ".join(principle.supporting_cases),
            " ".join(principle.acceptance_evidence),
        ]
    )


def _principle_metadata_text(principle: RepairPrinciple) -> str:
    return " ".join(
        [
            principle.title,
            principle.intent,
            principle.trigger,
            " ".join(principle.applicable_failure_modes),
            " ".join(principle.trigger_keywords),
        ]
    )


def _principle_keyword_text(principle: RepairPrinciple) -> str:
    metadata = _principle_metadata_text(principle)
    content = _principle_retrieval_text(principle)
    fields = [
        principle.title,
        principle.title,
        metadata,
        metadata,
        content,
    ]
    return " ".join(fields)


def _bm25_scores(query: str, principles: list[RepairPrinciple]) -> dict[str, float]:
    query_terms = _token_list(query)
    documents = {principle.principle_id: _token_list(_principle_keyword_text(principle)) for principle in principles}
    if not query_terms or not documents:
        return {}

    doc_freq: dict[str, int] = {}
    for terms in documents.values():
        for term in set(terms):
            doc_freq[term] = doc_freq.get(term, 0) + 1

    num_docs = len(documents)
    avg_len = sum(len(terms) for terms in documents.values()) / max(num_docs, 1)
    k1 = 1.5
    b = 0.75
    scores: dict[str, float] = {}
    for principle_id, terms in documents.items():
        if not terms:
            continue
        term_counts: dict[str, int] = {}
        for term in terms:
            term_counts[term] = term_counts.get(term, 0) + 1
        score = 0.0
        doc_len = len(terms)
        for term in query_terms:
            tf = term_counts.get(term, 0)
            if tf <= 0:
                continue
            df = doc_freq.get(term, 0)
            idf = math.log(1.0 + (num_docs - df + 0.5) / (df + 0.5))
            denom = tf + k1 * (1.0 - b + b * doc_len / max(avg_len, 1e-9))
            score += idf * (tf * (k1 + 1.0)) / denom
        if score > 0:
            scores[principle_id] = score
    return scores


def _dense_scores(
    query: str, principles: list[RepairPrinciple], config: PrincipleRetrievalConfig
) -> tuple[dict[str, float], str]:
    texts = [query]
    for principle in principles:
        texts.append(_principle_metadata_text(principle))
        texts.append(_principle_retrieval_text(principle))
    embeddings, status = _embed_texts(texts, config)
    if embeddings is None or len(embeddings) != len(texts):
        return {}, status

    query_embedding = embeddings[0]
    scores: dict[str, float] = {}
    content_weight = min(max(config.dense_content_weight, 0.0), 1.0)
    for index, principle in enumerate(principles):
        meta_embedding = embeddings[1 + index * 2]
        content_embedding = embeddings[2 + index * 2]
        meta_score = _cosine_similarity(query_embedding, meta_embedding)
        content_score = _cosine_similarity(query_embedding, content_embedding)
        score = (1.0 - content_weight) * meta_score + content_weight * content_score
        if score > 0:
            scores[principle.principle_id] = score
    return scores, status


def _rrf_fuse(
    *,
    sparse_scores: dict[str, float],
    dense_scores: dict[str, float],
    keyword_weight: float,
    semantic_weight: float,
    rrf_k: int,
) -> dict[str, float]:
    sparse_ranks = _rank_map(sparse_scores)
    dense_ranks = _rank_map(dense_scores)
    principle_ids = set(sparse_ranks).union(dense_ranks)
    fused: dict[str, float] = {}
    k = max(rrf_k, 1)
    for principle_id in principle_ids:
        score = 0.0
        if principle_id in sparse_ranks:
            score += keyword_weight / (k + sparse_ranks[principle_id])
        if principle_id in dense_ranks:
            score += semantic_weight / (k + dense_ranks[principle_id])
        if score > 0:
            fused[principle_id] = score
    return fused


def _rank_map(scores: dict[str, float]) -> dict[str, int]:
    return {
        principle_id: index + 1
        for index, (principle_id, _) in enumerate(sorted(scores.items(), key=lambda item: (-item[1], item[0])))
    }


def _rank_candidates(
    principles: list[RepairPrinciple],
    scores: dict[str, float],
    context: str,
    task: TaskSpec,
    diagnosis: DiagnosisReport,
    limit: int,
    *,
    source: str,
) -> list[PrincipleRetrievalCandidate]:
    by_id = {principle.principle_id: principle for principle in principles}
    ranked = sorted(
        ((principle_id, score) for principle_id, score in scores.items() if principle_id in by_id and score > 0),
        key=lambda item: (-item[1], item[0]),
    )
    candidates: list[PrincipleRetrievalCandidate] = []
    for index, (principle_id, score) in enumerate(ranked[:limit]):
        principle = by_id[principle_id]
        signals = _exact_match_signals(principle, context, task, diagnosis)
        signals.append(f"{source}_rank:{index + 1}")
        candidates.append(
            PrincipleRetrievalCandidate(
                principle=principle,
                score=score,
                rank=index + 1,
                matched_signals=_dedupe(signals),
            )
        )
    return candidates


def _exact_match_signals(
    principle: RepairPrinciple, context: str, task: TaskSpec, diagnosis: DiagnosisReport
) -> list[str]:
    signals: list[str] = []
    if set(diagnosis.labels).intersection(principle.failure_types):
        signals.append("failure_type")
    for mode in principle.applicable_failure_modes:
        if mode and mode.lower() in context:
            signals.append(f"failure_mode:{mode}")
    for defect in principle.defect_labels:
        if defect and defect.lower() in context:
            signals.append(f"defect:{defect}")
    for keyword in principle.trigger_keywords:
        if keyword and keyword.lower() in context:
            signals.append(f"keyword:{keyword}")
    if task.task_id in principle.supporting_cases or task.family in principle.supporting_cases:
        signals.append("supporting_case")
    return signals


def _embed_texts(texts: list[str], config: PrincipleRetrievalConfig) -> tuple[list[list[float]] | None, str]:
    local_config = _load_local_embedding_config()
    cache_path = (
        config.embedding_cache
        or get_env(os.environ, "SKILL_REVISE_PRINCIPLE_EMBEDDING_CACHE")
        or local_config.get("cache", "")
        or ""
    )
    cache = _load_embedding_cache(cache_path) if cache_path else {}
    model = config.embedding_model or (
        get_env(os.environ, "SKILL_REVISE_PRINCIPLE_EMBEDDING_MODEL")
        or local_config.get("model", "qwen/qwen3-embedding-4b")
    )
    embeddings: list[list[float] | None] = []
    missing: list[tuple[int, str, str]] = []
    for index, text in enumerate(texts):
        key = _embedding_cache_key(model, text)
        cached = cache.get(key)
        if isinstance(cached, list) and cached and all(isinstance(value, (int, float)) for value in cached):
            embeddings.append([float(value) for value in cached])
        else:
            embeddings.append(None)
            missing.append((index, key, text))

    status = "cache"
    if missing:
        new_embeddings, status = _compute_embeddings([item[2] for item in missing], config, model)
        if new_embeddings is None:
            return None, status
        for (index, key, _), embedding in zip(missing, new_embeddings, strict=False):
            vector = [float(value) for value in embedding]
            embeddings[index] = vector
            cache[key] = vector
        if cache_path:
            _write_embedding_cache(cache_path, cache)

    if any(embedding is None for embedding in embeddings):
        return None, status
    return [embedding for embedding in embeddings if embedding is not None], status


def _compute_embeddings(
    texts: list[str], config: PrincipleRetrievalConfig, model: str
) -> tuple[list[list[float]] | None, str]:
    endpoint = _embedding_endpoint(config)
    if endpoint:
        return _compute_embeddings_via_http(texts, config, model, endpoint)

    backend = (get_env(os.environ, "SKILL_REVISE_PRINCIPLE_EMBEDDING_BACKEND", "") or "").strip().lower()
    if backend in {"sentence-transformers", "sentence_transformers", "local"}:
        return _compute_embeddings_via_sentence_transformers(texts, model)
    return None, "no_embedding_backend"


def _embedding_endpoint(config: PrincipleRetrievalConfig) -> str:
    local_config = _load_local_embedding_config()
    endpoint = (
        config.embedding_url
        or get_env(os.environ, "SKILL_REVISE_PRINCIPLE_EMBEDDING_URL")
        or local_config.get("url", "")
        or ""
    ).strip()
    if endpoint and not endpoint.rstrip("/").endswith("/embeddings"):
        endpoint = endpoint.rstrip("/") + "/embeddings"
    return endpoint


def _compute_embeddings_via_http(
    texts: list[str], config: PrincipleRetrievalConfig, model: str, endpoint: str
) -> tuple[list[list[float]] | None, str]:
    local_config = _load_local_embedding_config()
    api_key = (
        config.embedding_api_key
        or get_env(os.environ, "SKILL_REVISE_PRINCIPLE_EMBEDDING_API_KEY")
        or local_config.get("api_key", "")
        or ""
    )
    payload = json.dumps({"model": model, "input": texts}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    body: Any = None
    last_status = "http_error:unknown"
    max_attempts = 8
    for attempt in range(max_attempts):
        request = urllib.request.Request(endpoint, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            last_status = f"http_error:{exc.code}:{_shorten(error_body, 200)}"
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            last_status = f"http_error:{type(exc).__name__}"
        else:
            data = body.get("data") if isinstance(body, dict) else None
            if isinstance(data, list):
                break
            last_status = _embedding_error_status(body)
        if attempt < max_attempts - 1:
            time.sleep(min(30.0, 2.0 * (attempt + 1)))
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, list):
        return None, last_status
    embeddings = []
    for item in data:
        embedding = item.get("embedding") if isinstance(item, dict) else None
        if not isinstance(embedding, list):
            return None, "http_error:missing_embedding"
        embeddings.append([float(value) for value in embedding])
    return embeddings, "http"


def _embedding_error_status(body: Any) -> str:
    if not isinstance(body, dict):
        return "http_error:missing_data"
    error = body.get("error")
    if isinstance(error, dict):
        message = str(error.get("message") or error.get("code") or "missing_data")
        return f"http_error:missing_data:{_shorten(message, 200)}"
    if isinstance(error, str) and error:
        return f"http_error:missing_data:{_shorten(error, 200)}"
    return "http_error:missing_data"


_SENTENCE_TRANSFORMER_MODELS: dict[str, Any] = {}


def _compute_embeddings_via_sentence_transformers(
    texts: list[str], model: str
) -> tuple[list[list[float]] | None, str]:
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except Exception as exc:
        return None, f"sentence_transformers_unavailable:{type(exc).__name__}"

    try:
        encoder = _SENTENCE_TRANSFORMER_MODELS.get(model)
        if encoder is None:
            encoder = SentenceTransformer(model)
            _SENTENCE_TRANSFORMER_MODELS[model] = encoder
        vectors = encoder.encode(texts, normalize_embeddings=False)
    except Exception as exc:
        return None, f"sentence_transformers_error:{type(exc).__name__}"
    return [[float(value) for value in vector] for vector in vectors], "sentence_transformers"


def _load_embedding_cache(path: str) -> dict[str, list[float]]:
    cache_path = Path(path)
    if not cache_path.exists():
        return {}
    try:
        payload = json.loads(cache_path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    items = payload.get("items") if isinstance(payload, dict) else payload
    if not isinstance(items, dict):
        return {}
    cache: dict[str, list[float]] = {}
    for key, value in items.items():
        if isinstance(key, str) and isinstance(value, list):
            cache[key] = [float(item) for item in value if isinstance(item, (int, float))]
    return cache


def _write_embedding_cache(path: str, cache: dict[str, list[float]]) -> None:
    cache_path = Path(path)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps({"items": cache}, ensure_ascii=True))


def _embedding_cache_key(model: str, text: str) -> str:
    return hashlib.sha1(f"{model}\0{text}".encode()).hexdigest()


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right, strict=False))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def _token_list(text: str) -> list[str]:
    stopwords = _stopwords()
    tokens: list[str] = []
    for token in re.findall(r"[A-Za-z0-9_/-]{3,}", text.lower()):
        clean = token.strip("_-/")
        if clean and clean not in stopwords:
            tokens.append(clean)
    return tokens


def _load_local_embedding_config() -> dict[str, str]:
    try:
        from skillrevise import local_llm_config as config  # type: ignore
    except Exception:
        return {}
    keys = {
        "api_key": "SKILL_REVISE_PRINCIPLE_EMBEDDING_API_KEY",
        "url": "SKILL_REVISE_PRINCIPLE_EMBEDDING_URL",
        "model": "SKILL_REVISE_PRINCIPLE_EMBEDDING_MODEL",
        "cache": "SKILL_REVISE_PRINCIPLE_EMBEDDING_CACHE",
    }
    values = {}
    for field, env_name in keys.items():
        values[field] = ""
        for candidate in env_names(env_name):
            value = getattr(config, candidate, "")
            if value not in {None, ""}:
                values[field] = str(value)
                break
    return values


def _stopwords() -> set[str]:
    return {
        "the",
        "and",
        "for",
        "with",
        "that",
        "this",
        "from",
        "into",
        "when",
        "then",
        "only",
        "task",
        "skill",
        "repair",
        "principle",
    }


def _fallback_intent(principle: RepairPrinciple) -> str:
    if principle.repair_rule:
        return _shorten(principle.repair_rule, 160)
    return "Reusable repair operator for the matched skill-design defect."


def _semantic_tokens(text: str) -> set[str]:
    stopwords = _stopwords()
    tokens = set()
    for token in re.findall(r"[A-Za-z0-9_/-]{3,}", text.lower()):
        clean = token.strip("_-/")
        if clean and clean not in stopwords:
            tokens.add(clean)
    return tokens


def _dedupe(items: list[str]) -> list[str]:
    deduped: list[str] = []
    for item in items:
        if item not in deduped:
            deduped.append(item)
    return deduped
