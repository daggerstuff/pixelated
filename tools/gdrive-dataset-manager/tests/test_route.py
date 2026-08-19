from __future__ import annotations

from gdrive_index.extract import Kind, route


def test_google_native_types() -> None:
    assert route("application/vnd.google-apps.document", "x") is Kind.GOOGLE_DOC
    assert route("application/vnd.google-apps.spreadsheet", "x") is Kind.GOOGLE_SHEET
    assert route("application/vnd.google-apps.presentation", "x") is Kind.GOOGLE_SLIDES


def test_pdf_and_xlsx() -> None:
    assert route("application/pdf", "a.pdf") is Kind.PDF
    assert route("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a") is Kind.XLSX
    assert route("application/vnd.ms-excel", "a") is Kind.XLSX


def test_media_by_mime_and_extension() -> None:
    assert route("audio/mpeg", "song.mp3") is Kind.MEDIA
    assert route("video/mp4", "clip.mp4") is Kind.MEDIA
    assert route("application/octet-stream", "talk.m4a") is Kind.MEDIA


def test_text_types() -> None:
    assert route("text/plain", "a.txt") is Kind.TEXT
    assert route("text/markdown", "a.md") is Kind.TEXT
    assert route("application/json", "a.json") is Kind.TEXT


def test_unextractable_is_skipped() -> None:
    assert route("application/octet-stream", "blob.bin") is Kind.SKIP
    assert route("image/png", "pic.png") is Kind.SKIP
