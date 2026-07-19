#!/usr/bin/env bash
# Example: Scan a file for slop
# Usage: bash scan-example.sh

set -e

echo "--- Scanning for slop ---"
deslop scan examples/sample.jsonl

echo ""
echo "--- Cleaning the file ---"
deslop clean examples/sample.jsonl -o cleaned.jsonl

echo ""
echo "--- Comparing ---"
echo "Original lines: $(wc -l < examples/sample.jsonl)"
echo "Cleaned lines:  $(wc -l < cleaned.jsonl)"
