import sys
import types

from ai.hf_client import HuggingFaceClient


def test_init_reads_token_from_env(monkeypatch):
    monkeypatch.setenv("HUGGINGFACE_HUB_TOKEN", "test-token-123")
    client = HuggingFaceClient()
    assert client.token == "test-token-123"


def _make_fake_hf_module(hf_hub_download=None, snapshot_download=None, HfApi=None):
    mod = types.ModuleType("huggingface_hub")
    # attach the expected symbols dynamically to avoid static-analysis
    # errors from type checkers that restrict ModuleType attributes.
    if hf_hub_download is not None:
        setattr(mod, "hf_hub_download", hf_hub_download)
    if snapshot_download is not None:
        setattr(mod, "snapshot_download", snapshot_download)
    if HfApi is not None:
        setattr(mod, "HfApi", HfApi)
    return mod


def test_download_file_calls_hf_hub_download(monkeypatch):
    called = {}

    def fake_hf_hub_download(repo_id, filename=None, repo_type=None, cache_dir=None, token=None, **kwargs):
        called['repo_id'] = repo_id
        called['filename'] = filename
        called['token'] = token
        return "/tmp/fake_path"

    fake_mod = _make_fake_hf_module(hf_hub_download=fake_hf_hub_download)
    # inject fake module so the client method can import it lazily
    monkeypatch.setitem(sys.modules, 'huggingface_hub', fake_mod)

    client = HuggingFaceClient(token="abc")
    result = client.download_file("owner/repo", filename="file.bin")
    assert result == "/tmp/fake_path"
    assert called['repo_id'] == "owner/repo"
    assert called['filename'] == "file.bin"
    assert called['token'] == "abc"


def test_snapshot_download_calls_snapshot_download(monkeypatch):
    called = {}

    def fake_snapshot_download(repo_id, revision=None, repo_type=None, cache_dir=None, token=None, **kwargs):
        called['repo_id'] = repo_id
        called['revision'] = revision
        called['token'] = token
        return "/tmp/fake_snapshot"

    fake_mod = _make_fake_hf_module(snapshot_download=fake_snapshot_download)
    monkeypatch.setitem(sys.modules, 'huggingface_hub', fake_mod)

    client = HuggingFaceClient(token="tok")
    result = client.snapshot_download("owner/repo", revision="main")
    assert result == "/tmp/fake_snapshot"
    assert called['repo_id'] == "owner/repo"
    assert called['revision'] == "main"
    assert called['token'] == "tok"


def test_list_files_uses_hfapi(monkeypatch):
    class FakeApi:
        def __init__(self):
            pass

        def list_repo_files(self, repo_id, repo_type=None, revision=None):
            assert repo_id == "owner/repo"
            return ["file1.txt", "subdir/file2.bin"]

    fake_mod = _make_fake_hf_module(HfApi=FakeApi)
    monkeypatch.setitem(sys.modules, 'huggingface_hub', fake_mod)

    client = HuggingFaceClient()
    files = client.list_files("owner/repo")
    assert files == ["file1.txt", "subdir/file2.bin"]
