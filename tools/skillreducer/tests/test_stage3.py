from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from skillreducer.config import Config
from skillreducer.pipeline import reduce_skill
from skillreducer.stage3.extract import extract_scripts_from_markdown
from skillreducer.stage3.scan import scan_python_blocks, scan_script_blocks


SAMPLE_MD = """\
**Quick API**

```python
pdf.pages[0].extract_text()
```

**Example 1: Extract first page**

```python
import pdfplumber
with pdfplumber.open("report.pdf") as pdf:
    print(pdf.pages[0].extract_text())
```
"""

MULTI_LINE_BLOCK = """\
```python
import pdfplumber
with pdfplumber.open("report.pdf") as pdf:
  tables = pdf.pages[0].extract_tables()
  for table in tables:
    print(table)
```
"""


MULTI_LINE_SHELL = """\
```bash
#!/usr/bin/env bash
set -euo pipefail
for file in *.pdf; do
  pdftotext "$file" "${file%.pdf}.txt"
done
```
"""


def test_scan_script_blocks_python_and_shell() -> None:
    md = """\
```python
x = 1
```

```bash
echo hi
```

```markdown
# title
```
"""
    blocks = scan_script_blocks(md)
    assert len(blocks) == 2
    assert blocks[0].language == "python"
    assert blocks[1].language == "bash"
    assert "x = 1" in blocks[0].content
    assert "echo hi" in blocks[1].content


def test_scan_python_blocks_alias_includes_shell() -> None:
    md = "```python\nx = 1\n```\n```sh\necho hi\n```"
    blocks = scan_python_blocks(md)
    assert len(blocks) == 2


def test_llm_selective_extraction() -> None:
    llm = MagicMock()
    llm.enabled = True
    llm.complete_json.return_value = {
        "items": [
            {
                "index": 0,
                "extract": False,
                "reason": "one-liner",
            },
            {
                "index": 1,
                "extract": True,
                "reason": "runnable example",
                "script_name": "extract_first_page.py",
                "replacement": "Run: `python scripts/extract_first_page.py`",
            },
        ]
    }

    result = extract_scripts_from_markdown(
        {"examples.md": SAMPLE_MD},
        llm,
        Config(min_script_tokens=5),
    )

    assert "scripts/extract_first_page.py" in result.scripts
    assert "pdf.pages[0].extract_text()" in result.files["examples.md"]
    assert "import pdfplumber" not in result.files["examples.md"]
    assert "Run: `python scripts/extract_first_page.py`" in result.files["examples.md"]
    assert any("1/2" in note for note in result.notes)


def test_heuristic_keeps_small_blocks_inline() -> None:
    one_liner_md = """\
**Quick API**

```python
pdf.pages[0].extract_text()
```
"""
    result = extract_scripts_from_markdown(
        {"examples.md": one_liner_md},
        None,
        Config(min_script_tokens=20),
    )
    assert result.scripts == {}
    assert result.files["examples.md"] == one_liner_md


def test_heuristic_extracts_substantial_shell_block() -> None:
    result = extract_scripts_from_markdown(
        {"examples.md": MULTI_LINE_SHELL},
        None,
        Config(min_script_tokens=5),
    )
    assert len(result.scripts) == 1
    script_path = next(iter(result.scripts))
    assert script_path.endswith(".sh")
    content = result.scripts[script_path]
    assert content.startswith("#!/usr/bin/env bash")
    assert "pdftotext" in content
    assert "bash scripts/" in result.files["examples.md"]
    assert "```bash" not in result.files["examples.md"]


def test_llm_extracts_bash_block() -> None:
    llm = MagicMock()
    llm.enabled = True
    llm.complete_json.return_value = {
        "items": [
            {
                "index": 0,
                "extract": True,
                "reason": "multi-line deploy script",
                "script_name": "batch_pdftotext.sh",
                "replacement": "Run: `bash scripts/batch_pdftotext.sh`",
            }
        ]
    }
    result = extract_scripts_from_markdown(
        {"examples.md": MULTI_LINE_SHELL},
        llm,
        Config(min_script_tokens=5),
    )
    assert "scripts/batch_pdftotext.sh" in result.scripts
    assert "Run: `bash scripts/batch_pdftotext.sh`" in result.files["examples.md"]


def test_heuristic_extracts_substantial_block() -> None:
    result = extract_scripts_from_markdown(
        {"examples.md": MULTI_LINE_BLOCK},
        None,
        Config(min_script_tokens=5),
    )
    assert len(result.scripts) == 1
    script_path = next(iter(result.scripts))
    assert script_path.endswith(".py")
    assert "import pdfplumber" in result.scripts[script_path]
    assert "```python" not in result.files["examples.md"]


def test_token_gate_reverts_when_no_savings(monkeypatch: pytest.MonkeyPatch) -> None:
    llm = MagicMock()
    llm.enabled = True
    code = "import os\nprint('line')\n"
    md = f"```python\n{code}```"
    llm.complete_json.return_value = {
        "items": [
            {
                "index": 0,
                "extract": True,
                "script_name": "run_example.py",
                "replacement": "Run: `python scripts/run_example.py`",
            }
        ]
    }

    monkeypatch.setattr("skillreducer.stage3.extract.count_tokens", lambda _text: 100)

    result = extract_scripts_from_markdown(
        {"SKILL.md": md},
        llm,
        Config(min_script_tokens=1),
    )
    assert result.scripts == {}
    assert result.files["SKILL.md"] == md
    assert any("did not reduce tokens" in note for note in result.notes)


def test_all_false_review_leaves_md_unchanged() -> None:
    llm = MagicMock()
    llm.enabled = True
    llm.complete_json.return_value = {
        "items": [
            {"index": 0, "extract": False, "reason": "inline"},
            {"index": 1, "extract": False, "reason": "inline"},
        ]
    }
    result = extract_scripts_from_markdown(
        {"examples.md": SAMPLE_MD},
        llm,
        Config(),
    )
    assert result.scripts == {}
    assert result.files["examples.md"] == SAMPLE_MD


def test_multi_file_processing() -> None:
    llm = MagicMock()
    llm.enabled = True

    def _side_effect(prompt: str) -> dict:
        if "SKILL.md" in prompt:
            return {"items": [{"index": 0, "extract": False, "reason": "inline"}]}
        return {
            "items": [
                {
                    "index": 0,
                    "extract": True,
                    "script_name": "extract_tables.py",
                    "replacement": "Run: `python scripts/extract_tables.py`",
                }
            ]
        }

    llm.complete_json.side_effect = _side_effect
    skill_md = "```python\nx = 1\n```"
    result = extract_scripts_from_markdown(
        {"SKILL.md": skill_md, "examples.md": MULTI_LINE_BLOCK},
        llm,
        Config(min_script_tokens=5),
    )
    assert "SKILL.md" in result.files
    assert "examples.md" in result.files
    assert len(result.scripts) == 1


def test_collision_produces_unique_script_names() -> None:
    llm = MagicMock()
    llm.enabled = True
    md = MULTI_LINE_BLOCK + "\n\n" + MULTI_LINE_BLOCK.replace("tables", "rows")
    llm.complete_json.return_value = {
        "items": [
            {
                "index": 0,
                "extract": True,
                "script_name": "extract.py",
                "replacement": "Run: `python scripts/extract.py`",
            },
            {
                "index": 1,
                "extract": True,
                "script_name": "extract.py",
                "replacement": "Run: `python scripts/extract_2.py`",
            },
        ]
    }
    result = extract_scripts_from_markdown(
        {"examples.md": md},
        llm,
        Config(min_script_tokens=5),
    )
    names = {path.split("/")[-1] for path in result.scripts}
    assert len(names) == 2
    assert len(set(names)) == 2


def test_pipeline_stage3_only_writes_scripts(tmp_path: Path) -> None:
    skill_dir = tmp_path / "pdf-skill"
    skill_dir.mkdir()
    skill_dir.joinpath("SKILL.md").write_text(
        "---\nname: pdf-skill\ndescription: PDF tools\n---\n\n" + MULTI_LINE_BLOCK,
        encoding="utf-8",
    )
    config = Config(use_llm=False, min_script_tokens=5)
    report = reduce_skill(
        skill_dir,
        output_dir=tmp_path / "optimized",
        config=config,
        stage=3,
    )
    out_dir = tmp_path / "optimized" / "pdf-skill"
    scripts_dir = out_dir / "scripts"
    assert scripts_dir.is_dir()
    assert list(scripts_dir.glob("*.py"))
    assert "```python" not in (out_dir / "SKILL.md").read_text(encoding="utf-8")
    assert any("Stage 3" in note for note in report.stage_notes)
