from __future__ import annotations

import pytest
from gdrive_index.chunk import chunk_text


def test_empty_text_yields_no_chunks() -> None:
    assert chunk_text("") == []
    assert chunk_text("   \n  ") == []


def test_short_text_is_single_chunk() -> None:
    assert chunk_text("hello world", chunk_size=100, overlap=20) == ["hello world"]


def test_overlap_covers_window_boundaries() -> None:
    text = "a" * 250
    chunks = chunk_text(text, chunk_size=100, overlap=20)
    assert len(chunks) == 3
    assert all(len(chunk) <= 100 for chunk in chunks)


def test_overlap_must_be_smaller_than_chunk_size() -> None:
    with pytest.raises(ValueError, match="overlap"):
        chunk_text("abc", chunk_size=10, overlap=10)


def test_full_text_is_recoverable_from_first_chars() -> None:
    text = "x" * 500
    chunks = chunk_text(text, chunk_size=100, overlap=20)
    covered = len(chunks[0]) + (len(chunks) - 1) * (100 - 20)
    assert covered >= len(text)
