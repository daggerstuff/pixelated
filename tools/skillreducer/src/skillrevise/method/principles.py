from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from skillrevise.core.metrics import trace_outcome_score
from skillrevise.core.models import (
    DiagnosisReport,
    FailureType,
    HarnessResult,
    PairedEvaluation,
    RepairPrinciple,
    RevisionCandidate,
    Skill,
    TaskSpec,
)

from .principles_retrieval import (
    _abstract_absorbed_repair,
    _bm25_scores,
    _contains_task_local_anchor,
    _dedupe,
    _dense_scores,
    _fallback_intent,
    _materialize_principle,
    _principle_retrieval_text,
    _principle_to_jsonable,
    _rank_candidates,
    _rrf_fuse,
    _semantic_tokens,
)
from .principles_seed_principles import (
    DEFAULT_REPAIR_PRINCIPLES,
    DEFAULT_SEED_PRINCIPLES,
)
from .principles_types import (
    AbsorbedPrincipleAbstraction,
    PrincipleRetrievalCandidate,
    PrincipleRetrievalConfig,
)

__all__ = [
    "DEFAULT_REPAIR_PRINCIPLES",
    "DEFAULT_SEED_PRINCIPLES",
    "AbsorbedPrincipleAbstraction",
    "PrincipleAbsorber",
    "PrincipleBank",
    "PrincipleRetrievalCandidate",
    "PrincipleRetrievalConfig",
]


class PrincipleBank:
    """Repair-principle bank for diagnosing and revising LLM-authored skills.

    The default bank is initialized with seed repair principles. Later revision
    experience can add absorbed principles when a repair is evidence-backed,
    outcome-improving, and utility-positive.
    """

    def __init__(
        self,
        principles: list[RepairPrinciple],
        *,
        retrieval_config: PrincipleRetrievalConfig | None = None,
    ) -> None:
        self.principles = principles
        self.retrieval_config = retrieval_config or PrincipleRetrievalConfig()

    @classmethod
    def default(cls) -> PrincipleBank:
        return cls.with_seed_principles()

    @classmethod
    def with_seed_principles(
        cls, *, retrieval_config: PrincipleRetrievalConfig | None = None
    ) -> PrincipleBank:
        return cls(
            [_materialize_principle(principle, source="seed_principle") for principle in DEFAULT_SEED_PRINCIPLES],
            retrieval_config=retrieval_config,
        )

    @classmethod
    def from_json(
        cls,
        path: str | Path,
        *,
        retrieval_config: PrincipleRetrievalConfig | None = None,
    ) -> PrincipleBank:
        payload = json.loads(Path(path).read_text())
        if isinstance(payload, dict):
            items = payload.get("principles", [])
        else:
            items = payload
        principles = []
        for item in items:
            principle = RepairPrinciple(
                principle_id=str(item["principle_id"]),
                title=str(item["title"]),
                defect_labels=[str(label) for label in item.get("defect_labels", [])],
                failure_types=[FailureType(value) for value in item.get("failure_types", [])],
                trigger_keywords=[str(keyword) for keyword in item.get("trigger_keywords", [])],
                trigger_evidence=str(item.get("trigger_evidence", "")),
                repair_rule=str(item.get("repair_rule", "")),
                transfer_constraint=str(item.get("transfer_constraint", "")),
                supporting_cases=[str(case) for case in item.get("supporting_cases", [])],
                acceptance_evidence=[str(case) for case in item.get("acceptance_evidence", [])],
                intent=str(item.get("intent", "")),
                trigger=str(item.get("trigger", "")),
                applicable_failure_modes=[str(mode) for mode in item.get("applicable_failure_modes", [])],
                evidence_requirements=[str(requirement) for requirement in item.get("evidence_requirements", [])],
                retrieval_text=str(item.get("retrieval_text", "")),
                action_template=str(item.get("action_template", "")),
                verification_template=str(item.get("verification_template", "")),
                escalation_rule=str(item.get("escalation_rule", "")),
                supporting_episodes=[
                    dict(case) if isinstance(case, dict) else {"case": str(case)}
                    for case in item.get("supporting_episodes", [])
                ],
                negative_episodes=[
                    dict(case) if isinstance(case, dict) else {"case": str(case)}
                    for case in item.get("negative_episodes", [])
                ],
                utility_stats={
                    str(key): float(value)
                    for key, value in dict(item.get("utility_stats", {})).items()
                    if isinstance(value, (int, float))
                },
                provenance=dict(item.get("provenance", {})),
                version=int(item.get("version", 1)),
                status=str(item.get("status", "active")),
            )
            principles.append(_materialize_principle(principle))
        return cls(principles, retrieval_config=retrieval_config)

    def add(self, principle: RepairPrinciple) -> bool:
        if any(item.principle_id == principle.principle_id for item in self.principles):
            return False
        self.principles.append(principle)
        return True

    def to_jsonable(self) -> dict[str, list[dict[str, object]]]:
        return {"principles": [_principle_to_jsonable(item) for item in self.principles]}

    def write_json(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_jsonable(), indent=2, ensure_ascii=True))

    def retrieve(self, task: TaskSpec, diagnosis: DiagnosisReport, *, limit: int = 4) -> list[RepairPrinciple]:
        return [candidate.principle for candidate in self.retrieve_candidates(task, diagnosis, limit=limit)]

    def retrieve_candidates(
        self, task: TaskSpec, diagnosis: DiagnosisReport, *, limit: int = 4
    ) -> list[PrincipleRetrievalCandidate]:
        if limit <= 0:
            return []

        context = self._context_text(task, diagnosis)
        method = self.retrieval_config.method
        if method == "legacy":
            return self._retrieve_legacy(task, diagnosis, context, limit=limit)

        active_principles = [principle for principle in self.principles if principle.status == "active"]
        if not active_principles:
            return []

        sparse_scores = (
            _bm25_scores(context, active_principles)
            if method in {"bm25", "hybrid-rrf", "dense"}
            else {}
        )
        dense_scores, dense_status = (
            _dense_scores(context, active_principles, self.retrieval_config)
            if method in {"dense", "hybrid-rrf"}
            else ({}, "disabled")
        )
        if method in {"dense", "hybrid-rrf"} and not dense_scores:
            raise RuntimeError(f"Dense principle retrieval unavailable: {dense_status}")

        if method == "bm25":
            return _rank_candidates(active_principles, sparse_scores, context, task, diagnosis, limit, source="bm25")
        if method == "dense":
            return _rank_candidates(active_principles, dense_scores, context, task, diagnosis, limit, source="dense")

        fused_scores = _rrf_fuse(
            sparse_scores=sparse_scores,
            dense_scores=dense_scores,
            keyword_weight=self.retrieval_config.keyword_weight,
            semantic_weight=self.retrieval_config.semantic_weight,
            rrf_k=self.retrieval_config.rrf_k,
        )
        if not fused_scores:
            return self._retrieve_legacy(task, diagnosis, context, limit=limit)
        return _rank_candidates(
            active_principles, fused_scores, context, task, diagnosis, limit, source="hybrid-rrf"
        )

    def _retrieve_legacy(
        self, task: TaskSpec, diagnosis: DiagnosisReport, context: str, *, limit: int
    ) -> list[PrincipleRetrievalCandidate]:
        query_tokens = _semantic_tokens(context)
        scored: list[tuple[float, RepairPrinciple, list[str]]] = []
        for principle in self.principles:
            if principle.status != "active":
                continue
            score, matched_signals = self._score(principle, diagnosis, context, query_tokens, task)
            if score > 0:
                scored.append((score, principle, matched_signals))

        scored.sort(key=lambda item: (-item[0], item[1].principle_id))
        return [
            PrincipleRetrievalCandidate(principle=principle, score=score, rank=index + 1, matched_signals=signals)
            for index, (score, principle, signals) in enumerate(scored[:limit])
        ]

    def render_for_prompt(self, principles: list[RepairPrinciple]) -> str:
        candidates = [
            PrincipleRetrievalCandidate(principle=principle, score=0.0, rank=index + 1, matched_signals=[])
            for index, principle in enumerate(principles)
        ]
        return self.render_candidates_for_prompt(candidates)

    def render_candidates_for_prompt(self, candidates: list[PrincipleRetrievalCandidate]) -> str:
        if not candidates:
            return "- No repair principle matched strongly. Use the diagnosis conservatively."
        blocks = []
        for candidate in candidates:
            principle = candidate.principle
            blocks.append(
                "\n".join(
                    [
                        f"- Rank {candidate.rank}: [{principle.principle_id}] {principle.title}",
                        f"  Retrieval score: {candidate.score:.3f}",
                        f"  Matched signals: {', '.join(candidate.matched_signals) or 'semantic/context match only'}",
                        f"  Intent: {principle.intent or _fallback_intent(principle)}",
                        f"  Trigger: {principle.trigger or principle.trigger_evidence}",
                        f"  Failure modes: {', '.join(principle.applicable_failure_modes) or ', '.join(item.value for item in principle.failure_types)}",
                        f"  Defects: {', '.join(principle.defect_labels)}",
                        f"  Trigger evidence: {principle.trigger_evidence}",
                        f"  Repair rule: {principle.repair_rule}",
                        f"  Action template: {principle.action_template or principle.repair_rule}",
                        f"  Verification template: {principle.verification_template or 'none'}",
                        f"  Escalation rule: {principle.escalation_rule or 'none'}",
                        f"  Evidence requirements: {', '.join(principle.evidence_requirements) or 'observable trajectory/verifier support'}",
                        f"  Transfer constraint: {principle.transfer_constraint}",
                        f"  Supporting cases: {', '.join(principle.supporting_cases) or 'none'}",
                        f"  Supporting episodes: {len(principle.supporting_episodes)}",
                        f"  Negative episodes: {len(principle.negative_episodes)}",
                        f"  Acceptance evidence: {', '.join(principle.acceptance_evidence) or 'none'}",
                    ]
                )
            )
        return "\n".join(blocks)

    def _score(
        self,
        principle: RepairPrinciple,
        diagnosis: DiagnosisReport,
        context: str,
        query_tokens: set[str],
        task: TaskSpec,
    ) -> tuple[float, list[str]]:
        score = 0.0
        matched_signals: list[str] = []
        label_set = set(diagnosis.labels)
        label_overlap = len(label_set.intersection(principle.failure_types))
        if label_overlap:
            score += 4.0 * label_overlap
            matched_signals.append("failure_type")
        for defect in principle.defect_labels:
            if defect in context:
                score += 3.0
                matched_signals.append(f"defect:{defect}")
        for keyword in principle.trigger_keywords:
            if keyword.lower() in context:
                score += 1.0
                matched_signals.append(f"keyword:{keyword}")
        if task.task_id in principle.supporting_cases or task.family in principle.supporting_cases:
            score += 2.0
            matched_signals.append("supporting_case")
        document_tokens = _semantic_tokens(_principle_retrieval_text(principle))
        if document_tokens and query_tokens:
            overlap = len(query_tokens.intersection(document_tokens))
            similarity = overlap / math.sqrt(len(query_tokens) * len(document_tokens))
            if similarity > 0:
                score += 6.0 * similarity
                matched_signals.append(f"semantic:{similarity:.2f}")
        positive = float(principle.utility_stats.get("episodes_positive", 0.0))
        negative = float(principle.utility_stats.get("episodes_negative", 0.0))
        score += min(2.0, 0.5 * positive)
        score -= min(2.0, 0.75 * negative)
        return score, _dedupe(matched_signals)

    def _context_text(self, task: TaskSpec, diagnosis: DiagnosisReport) -> str:
        evidence = " ".join(f"{item.source} {item.snippet} {item.reason}" for item in diagnosis.evidence)
        return " ".join(
            [
                task.task_id,
                task.family,
                task.instruction,
                " ".join(task.acceptance_criteria),
                " ".join(label.value for label in diagnosis.labels),
                diagnosis.causal_judgment,
                diagnosis.summary,
                " ".join(diagnosis.rewrite_targets),
                evidence,
            ]
        ).lower()


class PrincipleAbsorber:
    """Conservatively absorb outcome-improving revision experience into a bank."""

    def __init__(
        self,
        principle_bank: PrincipleBank,
        *,
        min_utility_gain: float = 0.0,
        min_absolute_utility: float = 0.0,
        min_outcome_gain: float = 0.0,
    ) -> None:
        self.principle_bank = principle_bank
        self.min_utility_gain = min_utility_gain
        self.min_absolute_utility = min_absolute_utility
        self.min_outcome_gain = min_outcome_gain

    def absorb(
        self,
        *,
        task: TaskSpec,
        before_skill: Skill,
        after_skill: Skill,
        diagnosis: DiagnosisReport,
        revision: RevisionCandidate,
        before_eval: PairedEvaluation,
        after_eval: PairedEvaluation,
    ) -> RepairPrinciple | None:
        utility_gain = after_eval.utility.overall_score - before_eval.utility.overall_score
        if utility_gain <= self.min_utility_gain:
            return None
        if after_eval.utility.overall_score <= self.min_absolute_utility:
            return None
        if not diagnosis.evidence:
            return None

        no_skill_score = trace_outcome_score(after_eval.no_skill)
        before_score = trace_outcome_score(before_eval.with_skill)
        after_score = trace_outcome_score(after_eval.with_skill)
        if no_skill_score is None or before_score is None or after_score is None:
            return None
        if after_score - before_score <= self.min_outcome_gain:
            return None
        if after_score < no_skill_score:
            return None

        principle = self._build_principle(
            task=task,
            before_skill=before_skill,
            after_skill=after_skill,
            diagnosis=diagnosis,
            revision=revision,
            before_eval=before_eval,
            after_eval=after_eval,
            utility_gain=utility_gain,
            before_score=before_score,
            after_score=after_score,
        )
        if principle is None:
            return None
        return principle if self.principle_bank.add(principle) else None

    def absorb_episode(self, result: HarnessResult) -> RepairPrinciple | None:
        """Absorb only after the full task episode, not after an intermediate revision."""
        if not result.iterations:
            return None
        if result.selected_skill.version == result.initial_skill.version:
            return None

        producer = next(
            (
                iteration
                for iteration in result.iterations
                if iteration.revision is not None
                and iteration.revision.revised_skill.version == result.selected_skill.version
            ),
            None,
        )
        if producer is None:
            return None

        initial = result.iterations[0]
        return self.absorb(
            task=result.task,
            before_skill=result.initial_skill,
            after_skill=result.selected_skill,
            diagnosis=producer.diagnosis,
            revision=producer.revision,
            before_eval=initial.evaluation,
            after_eval=result.selected_evaluation,
        )

    def _build_principle(
        self,
        *,
        task: TaskSpec,
        before_skill: Skill,
        after_skill: Skill,
        diagnosis: DiagnosisReport,
        revision: RevisionCandidate,
        before_eval: PairedEvaluation,
        after_eval: PairedEvaluation,
        utility_gain: float,
        before_score: float,
        after_score: float,
    ) -> RepairPrinciple | None:
        evidence = diagnosis.evidence[0]
        labels = [label.value for label in diagnosis.labels]
        target = diagnosis.rewrite_targets[0] if diagnosis.rewrite_targets else revision.rationale
        abstraction = _abstract_absorbed_repair(target=target, evidence=evidence.snippet, task=task, diagnosis=diagnosis)
        if abstraction is None:
            return None
        digest_source = "|".join(
            [
                task.family,
                ",".join(labels),
                abstraction.action_template,
                abstraction.trigger,
            ]
        )
        digest = hashlib.sha1(digest_source.encode("utf-8")).hexdigest()[:10]
        title = abstraction.title
        trigger_evidence = f"[{evidence.source}] {abstraction.trigger}"
        repair_rule = f"When {abstraction.trigger}, revise the skill to: {abstraction.action_template}"
        if _contains_task_local_anchor(repair_rule, task):
            return None
        return RepairPrinciple(
            principle_id=f"absorbed-{task.family}-{digest}".replace(" ", "-"),
            title=title,
            defect_labels=labels,
            failure_types=list(diagnosis.labels),
            trigger_keywords=_dedupe([task.family, *labels, *abstraction.trigger_keywords])[:12],
            trigger_evidence=trigger_evidence,
            intent="Repair a reusable skill-design defect observed across a complete task episode.",
            trigger=abstraction.trigger,
            applicable_failure_modes=[label.value for label in diagnosis.labels],
            evidence_requirements=[
                f"Observed episode evidence from {evidence.source}.",
                "At least one later skill version improves reward or preserves reward with higher utility.",
                "The reusable action can be stated without task-specific identifiers, constants, paths, or answers.",
            ],
            retrieval_text=" ".join([title, abstraction.trigger, abstraction.action_template, *abstraction.retrieval_tags]),
            action_template=abstraction.action_template,
            verification_template=abstraction.verification_template,
            escalation_rule=(
                "If the same failed check repeats within an episode, prefer a method-level repair over another local patch."
            ),
            repair_rule=repair_rule,
            transfer_constraint=(
                "Apply only when the same defect pattern is supported by trajectory or verifier evidence; "
                "do not copy task-specific answers, identifiers, constants, paths, or output values. "
                "Task-local anchors belong only in supporting episode provenance."
            ),
            supporting_cases=[task.family],
            supporting_episodes=[
                {
                    "task_id": task.task_id,
                    "family": task.family,
                    "from_version": before_skill.version,
                    "to_version": after_skill.version,
                    "utility_gain": utility_gain,
                    "reward_before": before_score,
                    "reward_after": after_score,
                    "local_anchors": {
                        "raw_rewrite_target": target,
                        "evidence_source": evidence.source,
                        "evidence_snippet": evidence.snippet,
                    },
                }
            ],
            utility_stats={
                "episodes_used": 1.0,
                "episodes_positive": 1.0,
                "episodes_neutral": 0.0,
                "episodes_negative": 0.0,
                "avg_reward_delta": after_score - before_score,
            },
            provenance={
                "source": "absorbed_episode",
                "created_from_episode": task.task_id,
                "abstraction": "transferable_condition_action",
            },
            acceptance_evidence=[
                (
                    f"accepted_episode={before_skill.version}->{after_skill.version}; "
                    f"utility_gain={utility_gain:.6f}; reward={before_score:.3f}->{after_score:.3f}; "
                    f"tool_calls={before_eval.with_skill.tool_calls}->{after_eval.with_skill.tool_calls}; "
                    f"steps={before_eval.with_skill.steps}->{after_eval.with_skill.steps}"
                )
            ],
        )

    def _title_for(self, diagnosis: DiagnosisReport, task: TaskSpec) -> str:
        if diagnosis.labels:
            label = diagnosis.labels[0].value.replace("_", " ").title()
            return f"{label} Repair For {task.family}"
        return f"Accepted Repair For {task.family}"


