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
COOKIEFILE = downloader_mod.COOKIEFILE


def test_fetch_playlist_entries_passes_cookiefile(monkeypatch, tmp_path):
    # Create a fake cookie file and set COOKIEFILE to its path
    fake_cookie = tmp_path / "cookies.txt"
    fake_cookie.write_text("fake")
    monkeypatch.setattr(downloader_mod, "COOKIEFILE", str(fake_cookie))

    captured_opts = {}

    class DummyYDL:
        def __init__(self, opts):
            captured_opts.update(opts)
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            return False
        def extract_info(self, url, download=False):
            return {"entries": []}

    # Inject a fake yt_dlp module so the inner `from yt_dlp import YoutubeDL` picks it up
    import sys as _sys
    import types as _types
    fake_yt = _types.ModuleType("yt_dlp")
    fake_yt.YoutubeDL = DummyYDL
    monkeypatch.setitem(_sys.modules, "yt_dlp", fake_yt)

    # Call the function; it should use our DummyYDL and set cookiefile
    fetch_playlist_entries("https://www.youtube.com/playlist?list=PL")

    assert "cookiefile" in captured_opts and captured_opts["cookiefile"] == str(fake_cookie)
