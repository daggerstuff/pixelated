from __future__ import annotations
import sys
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.ingestion.run_normalize import main as run_main


def test_run_normalize_writes_jsonl(tmp_path: Path):
    # Run and check output file
    rc = run_main()
    assert rc == 0
    out_path = ROOT / 'tmp_rovodev_normalized.jsonl'
    assert out_path.exists()
    line = out_path.read_text(encoding='utf-8').splitlines()[0]
    obj = json.loads(line)
    assert 'text' in obj and 'source' in obj and obj.get('source') == 'pubmed'
