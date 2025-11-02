import importlib.util
import os
import sys

# Import module by path
module_path = os.path.join(os.path.dirname(__file__), "..", "yt-downloader", "downloader.py")
module_path = os.path.abspath(module_path)
spec = importlib.util.spec_from_file_location("downloader_mod", module_path)
downloader_mod = importlib.util.module_from_spec(spec)
sys.modules["downloader_mod"] = downloader_mod
spec.loader.exec_module(downloader_mod)
fetch_playlist_entries = downloader_mod.fetch_playlist_entries


def test_fetch_playlist_entries_passes_proxy(monkeypatch):
    captured_opts = {}
    fake_proxy = "http://127.0.0.1:8888"
    monkeypatch.setattr(downloader_mod, "PROXY", fake_proxy)

    class DummyYDL:
        def __init__(self, opts):
            captured_opts.update(opts)
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            return False
        def extract_info(self, url, download=False):
            return {"entries": []}

    import sys as _sys
    import types as _types
    fake_yt = _types.ModuleType("yt_dlp")
    fake_yt.YoutubeDL = DummyYDL
    monkeypatch.setitem(_sys.modules, "yt_dlp", fake_yt)

    fetch_playlist_entries("https://www.youtube.com/playlist?list=PL")

    assert "proxy" in captured_opts and captured_opts["proxy"] == fake_proxy
