from __future__ import annotations

import json
from pathlib import Path

from gdrive_index.auth import match_client_secret, read_client_id


def test_read_client_id_from_token(tmp_path: Path) -> None:
    token = tmp_path / "token.json"
    token.write_text(json.dumps({"client_id": "12345-abc.apps.googleusercontent.com"}), encoding="utf-8")
    assert read_client_id(token) == "12345-abc.apps.googleusercontent.com"


def test_read_client_id_missing_file(tmp_path: Path) -> None:
    assert read_client_id(tmp_path / "nope.json") is None


def test_read_client_id_malformed(tmp_path: Path) -> None:
    token = tmp_path / "token.json"
    token.write_text("{not json", encoding="utf-8")
    assert read_client_id(token) is None


def test_match_client_secret_by_prefix(tmp_path: Path) -> None:
    (tmp_path / "client_secret_111-aaa.json").write_text("{}", encoding="utf-8")
    (tmp_path / "client_secret_222-bbb.json").write_text("{}", encoding="utf-8")
    match = match_client_secret("222-bbb", tmp_path)
    assert match is not None
    assert match.name == "client_secret_222-bbb.json"


def test_match_client_secret_no_match(tmp_path: Path) -> None:
    (tmp_path / "client_secret_111-aaa.json").write_text("{}", encoding="utf-8")
    assert match_client_secret("999-zzz", tmp_path) is None
