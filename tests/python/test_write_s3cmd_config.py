from __future__ import annotations

import importlib.util
from pathlib import Path


SCRIPT_PATH = Path(
    "/home/vivi/pixelated/.agent/internal/scripts/write_s3cmd_config.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location("write_s3cmd_config", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_render_s3cmd_config_includes_spaces_credentials_and_endpoints() -> None:
    module = _load_module()

    rendered = module.render_s3cmd_config(
        access_key="access",
        secret_key="secret",
        host_base="sfo3.digitaloceanspaces.com",
        host_bucket="%(bucket)s.sfo3.digitaloceanspaces.com",
        bucket_location="sfo3",
    )

    assert "access_key = access" in rendered
    assert "secret_key = secret" in rendered
    assert "host_base = sfo3.digitaloceanspaces.com" in rendered
    assert "host_bucket = %(bucket)s.sfo3.digitaloceanspaces.com" in rendered
    assert "bucket_location = sfo3" in rendered
    assert "use_https = True" in rendered


def test_write_s3cmd_config_persists_private_file(tmp_path: Path) -> None:
    module = _load_module()
    output_path = tmp_path / "pixel-data.s3cfg"

    module.write_s3cmd_config(
        output_path=output_path,
        access_key="access",
        secret_key="secret",
        host_base="sfo3.digitaloceanspaces.com",
        host_bucket="%(bucket)s.sfo3.digitaloceanspaces.com",
        bucket_location="sfo3",
    )

    assert output_path.exists()
    assert output_path.read_text(encoding="utf-8").startswith("[default]\n")
    assert output_path.stat().st_mode & 0o777 == 0o600
