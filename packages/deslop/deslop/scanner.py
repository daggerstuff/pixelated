import json
from pathlib import Path

from deslop.rules.core import DEFAULT_SLOP_MARKERS, DEFAULT_SLOP_POOLS, get_slop_regex


def scan_file(input_file: Path) -> dict:
    processed = 0
    flagged_records = 0
    pattern_counts = {}

    marker_regexes = {marker: get_slop_regex({marker: []}) for marker in DEFAULT_SLOP_POOLS.keys()}
    for marker in DEFAULT_SLOP_MARKERS:
        marker_regexes[marker] = get_slop_regex({marker: []})

    import os

    file_size = os.path.getsize(input_file)

    try:
        from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

        has_rich = True
    except ImportError:
        has_rich = False

    def _scan_logic():
        nonlocal processed, flagged_records, pattern_counts

        if has_rich:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TimeElapsedColumn(),
            ) as progress:
                task = progress.add_task("[cyan]Scanning dataset...", total=file_size)

                with open(input_file, encoding="utf-8") as fin:
                    for line in fin:
                        progress.advance(task, len(line.encode("utf-8")))
                        _process_line(line)
        else:
            with open(input_file, encoding="utf-8") as fin:
                for line in fin:
                    _process_line(line)

    def _process_line(line):
        nonlocal processed, flagged_records, pattern_counts
        if not line.strip():
            return
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            return

        processed += 1
        record_flagged = False

        def traverse_and_scan(data):
            nonlocal record_flagged
            if isinstance(data, dict):
                for k, v in data.items():
                    if isinstance(v, str):
                        for marker, regex in marker_regexes.items():
                            if regex.search(v):
                                pattern_counts[marker] = pattern_counts.get(marker, 0) + 1
                                record_flagged = True
                    else:
                        traverse_and_scan(v)
            elif isinstance(data, list):
                for v in data:
                    if isinstance(v, str):
                        for marker, regex in marker_regexes.items():
                            if regex.search(v):
                                pattern_counts[marker] = pattern_counts.get(marker, 0) + 1
                                record_flagged = True
                    else:
                        traverse_and_scan(v)

        traverse_and_scan(record)
        if record_flagged:
            flagged_records += 1

    _scan_logic()

    sorted_patterns = dict(sorted(pattern_counts.items(), key=lambda item: item[1], reverse=True))

    density = 0
    if processed > 0:
        density = round((flagged_records / processed) * 100, 2)

    return {
        "file": str(input_file),
        "records_scanned": processed,
        "records_flagged": flagged_records,
        "slop_density_pct": density,
        "top_slop_patterns": sorted_patterns,
    }
