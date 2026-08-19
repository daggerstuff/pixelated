from __future__ import annotations

from enum import StrEnum
from pathlib import Path

MAX_EXTRACT_CHARS = 2_000_000

GOOGLE_DOC = "application/vnd.google-apps.document"
GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet"
GOOGLE_SLIDES = "application/vnd.google-apps.presentation"

XLSX_MIMES = frozenset(
    {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    }
)

TEXT_MIMES = frozenset(
    {
        "application/json",
        "application/xml",
        "text/xml",
        "application/yaml",
        "application/x-yaml",
    }
)

MEDIA_EXTENSIONS = frozenset(
    {
        ".mp3",
        ".wav",
        ".m4a",
        ".flac",
        ".ogg",
        ".opus",
        ".aac",
        ".wma",
        ".mp4",
        ".mkv",
        ".mov",
        ".avi",
        ".webm",
        ".m4v",
        ".mpg",
        ".mpeg",
        ".3gp",
    }
)


class Kind(StrEnum):
    GOOGLE_DOC = "google_doc"
    GOOGLE_SHEET = "google_sheet"
    GOOGLE_SLIDES = "google_slides"
    PDF = "pdf"
    XLSX = "xlsx"
    TEXT = "text"
    MEDIA = "media"
    SKIP = "skip"


GOOGLE_NATIVE_KINDS = {
    GOOGLE_DOC: Kind.GOOGLE_DOC,
    GOOGLE_SHEET: Kind.GOOGLE_SHEET,
    GOOGLE_SLIDES: Kind.GOOGLE_SLIDES,
}


def route(mime_type: str, name: str) -> Kind:
    """Classify a Drive file by mime type (with extension fallback for media)."""
    if mime_type in GOOGLE_NATIVE_KINDS:
        return GOOGLE_NATIVE_KINDS[mime_type]
    if mime_type == "application/pdf":
        return Kind.PDF
    if mime_type in XLSX_MIMES:
        return Kind.XLSX
    if mime_type.startswith(("audio/", "video/")) or Path(name).suffix.lower() in MEDIA_EXTENSIONS:
        return Kind.MEDIA
    if mime_type.startswith("text/") or mime_type in TEXT_MIMES:
        return Kind.TEXT
    return Kind.SKIP


def truncate(text: str) -> str:
    return text[:MAX_EXTRACT_CHARS]
