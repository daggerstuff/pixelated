#!/usr/bin/env python3
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.ingestion.connectors.pubmed import PubMedConnector
from scripts.ingestion.normalize.schema import normalize_pubmed


def main() -> int:
    out_path = ROOT / 'tmp_rovodev_normalized.jsonl'
    count = 0
    with out_path.open('w', encoding='utf-8') as out:
        conn = PubMedConnector()
        for rec in conn.fetch():
            norm = normalize_pubmed(rec.data)
            norm['id'] = f"pubmed-{count+1}"
            out.write(json.dumps(norm, ensure_ascii=False) + "\n")
            count += 1
    print(f"Wrote {count} records to {out_path}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
