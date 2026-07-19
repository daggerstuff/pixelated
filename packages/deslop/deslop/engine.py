import json
from pathlib import Path

from deslop.rules.core import DEFAULT_SLOP_POOLS, _weighted_pick, get_slop_regex


def remove_slop(text: str, item_id: str = "generic_id") -> str:
    slop_re = get_slop_regex(DEFAULT_SLOP_POOLS)

    def repl(match):
        matched_text = match.group(0)
        lowered = matched_text.lower()
        pool = DEFAULT_SLOP_POOLS.get(lowered)
        if not pool:
            return ""

        seed_key = f"slop:{item_id}:{lowered}"
        rep = _weighted_pick(pool, seed_key)
        if rep is None:
            return ""

        if matched_text and matched_text[0].isupper():
            rep = rep[0].upper() + rep[1:]
        return rep

    return slop_re.sub(repl, text)


def apply_deslop_to_file(input_file: Path, output_file: Path) -> dict:
    processed = 0
    rewritten = 0

    with open(input_file, encoding="utf-8") as fin, open(output_file, "w", encoding="utf-8") as fout:
        for line in fin:
            if not line.strip():
                continue

            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                fout.write(line)
                continue

            processed += 1
            changed = False

            def traverse_and_deslop(data, item_id):
                nonlocal changed
                if isinstance(data, dict):
                    for k, v in data.items():
                        if isinstance(v, str):
                            new_v = remove_slop(v, item_id=item_id)
                            if new_v != v:
                                data[k] = new_v
                                changed = True
                        else:
                            traverse_and_deslop(v, item_id)
                elif isinstance(data, list):
                    for i, v in enumerate(data):
                        if isinstance(v, str):
                            new_v = remove_slop(v, item_id=item_id)
                            if new_v != v:
                                data[i] = new_v
                                changed = True
                        else:
                            traverse_and_deslop(v, item_id)

            record_id = str(record.get("id", processed))
            traverse_and_deslop(record, record_id)

            if changed:
                rewritten += 1

            fout.write(json.dumps(record, ensure_ascii=False) + "\n")

    return {"records_processed": processed, "records_rewritten": rewritten}
