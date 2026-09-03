from __future__ import annotations

from dataclasses import dataclass, field

from skillreducer.config import Config
from skillreducer.llm.client import LLMClient
from skillreducer.stage3.extract import ExtractResult, extract_scripts_from_markdown


@dataclass
class Stage3Result:
    files: dict[str, str] = field(default_factory=dict)
    scripts: dict[str, str] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def run_stage3(
    md_files: dict[str, str],
    llm: LLMClient | None,
    config: Config | None = None,
) -> Stage3Result:
    result: ExtractResult = extract_scripts_from_markdown(md_files, llm, config)
    return Stage3Result(
        files=result.files,
        scripts=result.scripts,
        notes=result.notes,
    )
