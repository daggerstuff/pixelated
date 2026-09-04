from pathlib import Path

from skillreducer.parser import parse_skill_md, write_skill_md


def test_parse_and_roundtrip(tmp_path: Path) -> None:
    src = Path("tests/fixtures/sample-pdf-skill/SKILL.md")
    skill = parse_skill_md(src)
    assert skill.name == "sample-pdf-skill"
    assert "PDF" in skill.description
    assert "pdfplumber" in skill.body

    out = tmp_path / "SKILL.md"
    write_skill_md(out, skill.frontmatter, skill.body)
    reparsed = parse_skill_md(out)
    assert reparsed.description == skill.description
    assert reparsed.body == skill.body
