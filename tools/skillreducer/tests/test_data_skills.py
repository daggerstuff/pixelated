from pathlib import Path

from skillreducer.audit import audit_skill


def test_data_folder_skills_exist() -> None:
    data = Path("data")
    skills = ["pdf-processing", "api-testing", "marketing-strategy", "sql-analytics"]
    for name in skills:
        assert (data / name / "SKILL.md").exists(), f"missing data/{name}/SKILL.md"


def test_audit_data_pdf_skill() -> None:
    report = audit_skill(Path("data/pdf-processing"))
    assert report.stats.total > 0
    codes = {i.code for i in report.issues}
    assert "F2_MONOLITHIC" in codes


def test_audit_data_api_testing_missing_description() -> None:
    report = audit_skill(Path("data/api-testing"))
    codes = {i.code for i in report.issues}
    assert "F1_MISSING_DESCRIPTION" in codes or "F1_SHORT_DESCRIPTION" in codes
