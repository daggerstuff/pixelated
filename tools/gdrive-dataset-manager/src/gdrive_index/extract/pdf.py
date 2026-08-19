from __future__ import annotations

from pathlib import Path

import pymupdf

from . import truncate


def extract_pdf(path: Path) -> str:
    doc = pymupdf.open(str(path))
    try:
        pages = [page.get_text() for page in doc]
    finally:
        doc.close()
    return truncate("\n".join(pages))
