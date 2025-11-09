import sys
import types
from pathlib import Path

from ai.examples import download_model


def test_cli_download_file(monkeypatch, tmp_path, capsys):
    called = {}

    def fake_hf_hub_download(repo_id, filename=None, repo_type=None, cache_dir=None, token=None, **kwargs):
        called['repo_id'] = repo_id
        called['filename'] = filename
        called['cache_dir'] = cache_dir
        # Safely coerce cache_dir to a Path (avoid passing None to Path())
        cache_path = Path(cache_dir) if cache_dir is not None else Path()
        return str(cache_path / filename) if filename else str(cache_path)

    fake_mod = types.ModuleType("huggingface_hub")
    setattr(fake_mod, "hf_hub_download", fake_hf_hub_download)
    monkeypatch.setitem(sys.modules, 'huggingface_hub', fake_mod)
    monkeypatch.setenv('HUGGINGFACE_HUB_TOKEN', 'test-token')

    argv = ['download_model.py', 'owner/repo', '--filename', 'file.bin', '--out', str(tmp_path)]
    monkeypatch.setattr(sys, 'argv', argv)

    ret = download_model.main()
    out = capsys.readouterr().out

    assert ret == 0
    assert 'Downloaded file to:' in out
    assert called['repo_id'] == 'owner/repo'
    assert called['filename'] == 'file.bin'
    assert called['cache_dir'] == str(tmp_path)


def test_cli_snapshot_download(monkeypatch, tmp_path, capsys):
    called = {}

    def fake_snapshot_download(repo_id, revision=None, repo_type=None, cache_dir=None, token=None, **kwargs):
        called['repo_id'] = repo_id
        called['revision'] = revision
        called['cache_dir'] = cache_dir
        # Safely coerce cache_dir to a Path (avoid returning None or passing None to Path())
        cache_path = Path(cache_dir) if cache_dir is not None else Path()
        return str(cache_path)

    fake_mod = types.ModuleType("huggingface_hub")
    setattr(fake_mod, "snapshot_download", fake_snapshot_download)
    monkeypatch.setitem(sys.modules, 'huggingface_hub', fake_mod)
    monkeypatch.setenv('HUGGINGFACE_HUB_TOKEN', 'test-token')

    argv = ['download_model.py', 'owner/repo', '--out', str(tmp_path)]
    monkeypatch.setattr(sys, 'argv', argv)

    ret = download_model.main()
    out = capsys.readouterr().out

    assert ret == 0
    assert 'Downloaded repository snapshot to:' in out
    assert called['repo_id'] == 'owner/repo'
    assert called['cache_dir'] == str(tmp_path)
