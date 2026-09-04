from __future__ import annotations

from skillrevise.core.models import FailureType, RepairPrinciple

DEFAULT_SEED_PRINCIPLES = [
    RepairPrinciple(
        principle_id="workflow-checkpointing",
        title="Make The Skill Executable As Checkpoints",
        defect_labels=["missing_workflow_explicitness", "over_generality", "wrong_abstraction_level"],
        failure_types=[FailureType.OVER_GENERALITY, FailureType.WRONG_ABSTRACTION_LEVEL],
        trigger_keywords=["vague", "broad", "workflow", "checkpoint", "step", "not actionable"],
        trigger_evidence="The skill gives broad advice but does not force verifiable intermediate decisions.",
        repair_rule=(
            "Rewrite the procedure as ordered checkpoints: discover, validate, act, verify, and recover. "
            "Each checkpoint should tell the agent what observable signal confirms progress."
        ),
        transfer_constraint="Do not encode a one-task answer as a checkpoint; encode the check that would reveal it.",
        supporting_cases=["swe-debug", "dialogue-parser"],
    ),
    RepairPrinciple(
        principle_id="input-schema-validation",
        title="Validate Input And Output Schemas Before Finalizing",
        defect_labels=["missing_input_validation", "output_format_mismatch", "missing_verifier_alignment"],
        failure_types=[FailureType.FALSE_CERTAINTY, FailureType.WRONG_ABSTRACTION_LEVEL],
        trigger_keywords=["schema", "json", "csv", "npy", "shape", "dtype", "tokens", "field", "format"],
        trigger_evidence="Verifier failures mention malformed fields, wrong types, missing keys, or numeric mismatches.",
        repair_rule=(
            "Add a post-write schema check that reloads produced artifacts and asserts required keys, types, "
            "shapes, ranges, and serialization formats before the agent claims completion."
        ),
        transfer_constraint="Check task-declared schema and verifier constraints, not hard-coded expected values.",
        supporting_cases=["enterprise-information-search", "jax-computing-basics"],
    ),
    RepairPrinciple(
        principle_id="environment-output-grounding",
        title="Ground Required Outputs In Verifier-Visible Paths",
        defect_labels=["missing_environment_grounding", "missing_verifier_alignment", "output_format_mismatch"],
        failure_types=[FailureType.ENVIRONMENT_MISMATCH, FailureType.FALSE_CERTAINTY],
        trigger_keywords=[
            "file not found",
            "output",
            "path",
            "permission",
            "workspace",
            "/output",
            "/root",
            "target file",
        ],
        trigger_evidence="Execution or verifier says the expected artifact was missing or written outside the checked path.",
        repair_rule=(
            "Require a final existence/readability check at the exact task-specified output path. If writing there fails, "
            "inspect mounts, permissions, task scripts, or supported write routes instead of silently switching paths."
        ),
        transfer_constraint="Use exact paths only when supplied by the task or verifier; otherwise discover them locally.",
        supporting_cases=["civ6-adjacency-optimizer", "lake-warming-attribution"],
    ),
    RepairPrinciple(
        principle_id="verifier-contract-alignment",
        title="Translate Verifier Logic Into Skill Constraints",
        defect_labels=["missing_verifier_alignment", "strict_constraint_checking", "output_format_mismatch"],
        failure_types=[FailureType.FALSE_CERTAINTY, FailureType.WRONG_ABSTRACTION_LEVEL],
        trigger_keywords=["verifier", "test", "assert", "expected", "reachability", "terminal", "end", "contract"],
        trigger_evidence="The skill follows plausible domain logic but misses a subtle verifier convention.",
        repair_rule=(
            "Make the skill require reading or inferring the verifier contract, then restating any non-obvious sentinel, "
            "format, tolerance, traversal, or scoring rule as a hard pre-finalization check. For terminal sentinels, "
            "distinguish verifier-allowed edge targets from nodes that should be materialized and traversed, and encode "
            "the distinction as a concrete reload-and-assert post-write check."
        ),
        transfer_constraint="Record the class of verifier convention, not a brittle copy of the current hidden answer.",
        supporting_cases=["dialogue-parser", "jax-computing-basics"],
    ),
    RepairPrinciple(
        principle_id="fallback-after-tool-failure",
        title="Add Bounded Recovery For Broken Tools Or Assumptions",
        defect_labels=["missing_fallback_handling", "tool_usage_mismatch", "missing_environment_grounding"],
        failure_types=[FailureType.ENVIRONMENT_MISMATCH, FailureType.FALSE_CERTAINTY],
        trigger_keywords=["error", "failed", "unavailable", "timeout", "exception", "permission", "fallback"],
        trigger_evidence="A command, tool, file, endpoint, or assumption failed and the agent did not switch to a valid alternative.",
        repair_rule=(
            "Add one bounded fallback branch: when the planned route fails, inspect the failure signal, choose the closest "
            "environment-supported alternative, and re-run the smallest check."
        ),
        transfer_constraint="Keep fallback branches short; avoid turning the skill into a generic troubleshooting manual.",
        supporting_cases=["civ6-adjacency-optimizer", "fix-build-agentops"],
    ),
    RepairPrinciple(
        principle_id="transfer-preserving-repair",
        title="Repair The Rule, Not The Instance",
        defect_labels=["over_specificity", "negative_transfer_risk", "context_pollution"],
        failure_types=[
            FailureType.OVER_SPECIFICITY,
            FailureType.CONTEXT_POLLUTION,
            FailureType.WRONG_ABSTRACTION_LEVEL,
        ],
        trigger_keywords=["hard-code", "specific", "literal", "memorize", "overfit", "transfer", "too long", "tokens"],
        trigger_evidence="The repair target is a single task instance, path, literal, or answer rather than a reusable behavior.",
        repair_rule=(
            "Replace instance-specific content with a trigger condition and reusable decision rule. Keep only details that "
            "are part of the task-family contract or environment contract."
        ),
        transfer_constraint="Evaluate whether the edited skill would still help a sibling task with different files or values.",
        supporting_cases=["swe-debug"],
    ),
    RepairPrinciple(
        principle_id="trigger-noninterference",
        title="Make Skill Triggering Precise Enough To Avoid Harm",
        defect_labels=["negative_transfer_risk", "context_pollution", "over_generality"],
        failure_types=[FailureType.CONTEXT_POLLUTION, FailureType.OVER_GENERALITY],
        trigger_keywords=["irrelevant", "wrong task", "overhead", "more tokens", "misleading", "not applicable"],
        trigger_evidence="The skill adds cost or steers the agent when its procedure is not needed for the current task.",
        repair_rule=(
            "Narrow When to Use and add exclusion conditions so the skill fires only when its checks or workflow change "
            "an execution decision."
        ),
        transfer_constraint="Prefer concise trigger boundaries over broad domain labels.",
        supporting_cases=["SkillCraft", "withskill_gpt_revised_six_v1"],
    ),
]

DEFAULT_REPAIR_PRINCIPLES = DEFAULT_SEED_PRINCIPLES
