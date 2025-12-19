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
    out_file = tmp_path / 'out.jsonl'
    rc = run_main(['--source','pubmed','--out',str(out_file)])
    assert rc == 0
    assert out_file.exists()
    line = out_file.read_text(encoding='utf-8').splitlines()[0]
    obj = json.loads(line)
    assert obj.get('source') == 'pubmed'
    for k in ['id','source','text','topics','license','provenance']:
        assert k in obj
