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


REQUIRED_FIELDS = ['id','source','text','topics','license','provenance']

def _schema_check(obj: dict) -> None:
    missing = [k for k in REQUIRED_FIELDS if k not in obj]
    if missing:
        raise ValueError(f"Normalized record missing fields: {missing}")


def main(args: list[str] | None = None) -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='pubmed', choices=['pubmed'])
    parser.add_argument('--out', default=str(ROOT / 'tmp_rovodev_normalized.jsonl'))
    ns = parser.parse_args(args or [])

    out_path = Path(ns.out)
    count = 0

    with out_path.open('w', encoding='utf-8') as out:
        if ns.source == 'pubmed':
            conn = PubMedConnector()
            normalizer = normalize_pubmed
        else:
            raise SystemExit(f"Unsupported source: {ns.source}")
        for rec in conn.fetch():
            norm = normalizer(rec.data)
            norm['id'] = f"{ns.source}-{count+1}"
            _schema_check(norm)
            out.write(json.dumps(norm, ensure_ascii=False) + "\n")
            count += 1
    print(f"Wrote {count} records to {out_path}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
