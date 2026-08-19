from __future__ import annotations

from pathlib import Path

import openpyxl

from . import truncate


def extract_xlsx(path: Path) -> str:
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    try:
        lines: list[str] = []
        for sheet in wb.worksheets:
            lines.append(f"# {sheet.title}")
            for row in sheet.iter_rows(values_only=True):
                cells = [str(cell) for cell in row if cell is not None]
                if cells:
                    lines.append(" ".join(cells))
    finally:
        wb.close()
    return truncate("\n".join(lines))
