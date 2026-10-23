"""Protect frozen blind evidence and clinician answer fields when repackaging."""

import json
import shutil
import zipfile

import pytest

from scripts.training.repackage_v6_clinician_review import TARGET, build, digest


def test_package_preserves_evidence_and_contains_blank_complete_form(tmp_path):
    shutil.copytree(TARGET / "qualified-review", tmp_path / "qualified-review")
    result = build(tmp_path)
    with zipfile.ZipFile(result["archive"]) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        assert set(archive.namelist()) == {*manifest["files_sha256"], "manifest.json"}
        for name, sha in manifest["files_sha256"].items():
            assert digest(archive.read(name)) == sha
        for name in manifest["frozen_inputs_unchanged"]:
            assert archive.read(name) == (TARGET / "qualified-review" / name).read_bytes()
        template = json.loads(archive.read("assessment-template.json"))
        assert len(template["ratings"]) == 68
        assert len(template["pair_preferences"]) == 44
        assert sum(len(pair) for pair in template["ratings"].values()) == 136
        for ident, pair in template["ratings"].items():
            for rating in pair.values():
                assert rating["rating_status"] == ""
                assert rating["rationale"] == ""
                if ident.startswith("qualified-review-"):
                    assert len(rating["dimension_scores"]) == 4
                    assert set(rating["dimension_scores"].values()) == {None}
                    assert rating["critical_failure"] is None
                else:
                    assert rating["task_met"] is None
        assert template["reviewer_verification"]["qualification_verified"] is True
        assert template["completed_at"] is None
        assert template["status"] == "draft"
        assert not any("mapping" in name or "sealed" in name for name in archive.namelist())
        html = archive.read("START-HERE.html").decode()
        assert "__REVIEW_DATA__" not in html
        assert "connect-src 'none'" in html
        assert "user will verify" not in html.lower()
        assert "all-provider-calls" not in html
    with pytest.raises(ValueError, match="already exists"):
        build(tmp_path)


def test_rejects_changed_blinded_source(tmp_path):
    shutil.copytree(TARGET / "qualified-review", tmp_path / "qualified-review")
    path = tmp_path / "qualified-review/blinded-packets.jsonl"
    path.write_bytes(path.read_bytes() + b"\n")
    with pytest.raises(ValueError, match="Frozen review inputs differ"):
        build(tmp_path)
