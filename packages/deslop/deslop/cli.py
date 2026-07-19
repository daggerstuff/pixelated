import argparse
import json
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Deslop: AI Corpus Deslopping CLI")
    parser.add_argument("input_file", type=Path, help="Path to the input JSON/JSONL dataset")
    parser.add_argument("--mode", choices=["scan", "clean", "ollama"], default="scan", help="Action to perform")
    parser.add_argument(
        "--output", type=Path, help="Path to save the cleaned dataset (required for clean/ollama mode if not in-place)"
    )
    parser.add_argument("--in-place", action="store_true", help="Modify the input file in place")
    parser.add_argument("--endpoint", type=str, default="http://127.0.0.1:11434", help="Ollama API endpoint")
    parser.add_argument("--model", type=str, default="llama3.2", help="Ollama model to use for regen")

    args = parser.parse_args()
    input_file: Path = args.input_file

    if not input_file.is_file():
        sys.stdout.write(json.dumps({"error": f"File not found: {input_file}"}) + "\n")
        sys.exit(1)

    if args.mode in ["clean", "ollama"] and not args.output and not args.in_place:
        sys.stdout.write(json.dumps({"error": f"Must specify --output or --in-place for {args.mode} mode"}) + "\n")
        sys.exit(1)

    try:
        if args.mode == "scan":
            from deslop.scanner import scan_file

            report = scan_file(input_file)
            report["success"] = True
            sys.stdout.write(json.dumps(report) + "\n")

        elif args.mode == "clean":
            from deslop.engine import apply_deslop_to_file

            out_path = args.output if args.output else input_file.with_suffix(".tmp")
            report = apply_deslop_to_file(input_file, out_path)

            if args.in_place and not args.output:
                out_path.replace(input_file)

            report["success"] = True
            sys.stdout.write(json.dumps(report) + "\n")

        elif args.mode == "ollama":
            from deslop.regen import regen_file_with_ollama

            out_path = args.output if args.output else input_file.with_suffix(".tmp")
            report = regen_file_with_ollama(input_file, out_path, endpoint=args.endpoint, model=args.model)

            if args.in_place and not args.output:
                out_path.replace(input_file)

            report["success"] = True
            sys.stdout.write(json.dumps(report) + "\n")

    except Exception as exc:
        sys.stdout.write(json.dumps({"error": str(exc)}) + "\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
