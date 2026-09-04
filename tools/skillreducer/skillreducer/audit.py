from __future__ import annotations

from pathlib import Path

from skillreducer.config import Config
from skillreducer.models import AuditIssue, AuditReport, Skill, TokenStats
from skillreducer.parser import parse_skill_md
from skillreducer.tokenizer import count_tokens


def audit_skill(path: Path, config: Config | None = None) -> AuditReport:
    config = config or Config.load()

    skill = parse_skill_md(path)
    stats = _token_stats(skill)
    issues = _detect_issues(skill, stats, config)
    return AuditReport(
        skill_path=skill.path,
        stats=stats,
        issues=issues,
        body_lines=len(skill.body.splitlines()) if skill.body else 0,
        reference_count=len(skill.references),
    )


def _token_stats(skill: Skill) -> TokenStats:
    ref_tokens = sum(r.token_count for r in skill.references)
    return TokenStats(
        description=count_tokens(skill.description),
        body=count_tokens(skill.body),
        references=ref_tokens,
    )


def _detect_issues(skill: Skill, stats: TokenStats, config: Config) -> list[AuditIssue]:
    issues: list[AuditIssue] = []

    if not skill.description.strip():
        issues.append(
            AuditIssue(
                code="F1_MISSING_DESCRIPTION",
                message="Skill has no routing description in frontmatter",
                severity="error",
            )
        )
    elif stats.description <= config.short_description_tokens:
        issues.append(
            AuditIssue(
                code="F1_SHORT_DESCRIPTION",
                message=(
                    f"Description is {stats.description} tokens "
                    f"(<= {config.short_description_tokens}); routing may fail"
                ),
                severity="warning",
            )
        )
    elif stats.description > 120:
        issues.append(
            AuditIssue(
                code="F1_VERBOSE_DESCRIPTION",
                message=f"Description is {stats.description} tokens; likely contains non-routing filler",
                severity="warning",
            )
        )

    if stats.body > 3000:
        issues.append(
            AuditIssue(
                code="F2_LARGE_BODY",
                message=f"Body is {stats.body} tokens; consider progressive disclosure",
                severity="warning",
            )
        )

    body_lines = len(skill.body.splitlines()) if skill.body else 0
    if body_lines > 500:
        issues.append(
            AuditIssue(
                code="F2_LONG_BODY",
                message=f"Body is {body_lines} lines (> 500); split into reference files",
                severity="warning",
            )
        )

    if any(k in skill.body.lower() for k in ("## example", "## examples", "```")):
        if not any(r.path.name in {"examples.md", "reference.md"} for r in skill.references):
            issues.append(
                AuditIssue(
                    code="F2_MONOLITHIC",
                    message="Examples embedded in SKILL.md instead of separate reference files",
                    severity="info",
                )
            )

    if stats.references > 5000:
        issues.append(
            AuditIssue(
                code="F3_HEAVY_REFERENCES",
                message=f"Reference files total {stats.references} tokens",
                severity="warning",
            )
        )

    return issues
