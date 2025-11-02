import importlib.util
import os
import sys

module_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "yt-downloader", "downloader.py"))
spec = importlib.util.spec_from_file_location("downloader_mod", module_path)
downloader_mod = importlib.util.module_from_spec(spec)
sys.modules["downloader_mod"] = downloader_mod
spec.loader.exec_module(downloader_mod)
resume_check = downloader_mod.resume_check


def test_resume_check_detects_existing_files(tmp_path):
    # create a fake output folder structure
    out = tmp_path / "Downloads" / "Uploader" / "Playlist Title"
    out.mkdir(parents=True)
    # create fake files matching playlist pattern
    fmt = "mp3"
    entries = []
    for i in range(1, 4):
        title = f"Song {i}"
        entries.append({"index": i, "id": f"id{i}", "title": title})
        fname = f"{i:02d} - {title}.{fmt}"
        (out / fname).write_text("dummy")

    to_download, skipped, summary = resume_check(entries, str(tmp_path / "Downloads"), fmt, True)
    assert len(skipped) == 3
    assert len(to_download) == 0
    # summary should include the directory where files were created
    assert any("Uploader" in d or "Playlist Title" in d for d in summary.keys())
