#!/usr/bin/env python3
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.quality_scoring.scoring_interface import compute_signals, compose_score


def main(args: list[str] | None = None) -> int:
    import argparse
    parser = argparse.ArgumentParser(description='Quality scoring stub CLI')
    parser.add_argument('--in', dest='inp', required=True, help='Input JSONL with fields: id, text')
    parser.add_argument('--out', dest='out', required=True, help='Output JSONL with signals, composite, decision')
    parser.add_argument('--config', dest='config', default=str(ROOT / 'scripts/quality_scoring/config.example.json'))
    ns = parser.parse_args(args or [])

    cfg = json.loads(Path(ns.config).read_text(encoding='utf-8'))
    weights = cfg.get('weights', {})
    thresholds = cfg.get('thresholds', {})

    in_path = Path(ns.inp)
    out_path = Path(ns.out)

    wrote = 0
    with in_path.open('r', encoding='utf-8') as fin, out_path.open('w', encoding='utf-8') as fout:
        for line in fin:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            text = obj.get('text', '')
            sid = obj.get('id')
            sigs = compute_signals(text)
            res = compose_score(sigs, weights=weights, thresholds=thresholds)
            fout.write(json.dumps({
                'id': sid,
                'signals': {
                    'empathy': res.signals.empathy,
                    'fidelity': res.signals.fidelity,
                    'domain': res.signals.domain,
                    'harm': res.signals.harm,
                },
                'composite': res.composite,
                'decision': res.decision
            }, ensure_ascii=False) + '\n')
            wrote += 1
    print(f"Wrote {wrote} scored items to {out_path}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
