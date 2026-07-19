# Changelog

All notable changes to deslop will be documented in this file.

## [0.2.0] - 2025-01-XX

### Added

- YAML custom rules support
- Ollama integration for LLM-based rewriting
- Rich terminal output with color-coded density
- Progress bars for file scanning
- Verbose mode (`-v`) for detailed output

### Changed

- CLI uses `argparse` with subcommands (scan/clean/ollama)
- Scanner calculates density as percentage
- Engine uses Zipf-weighted replacement pools

## [0.1.0] - 2025-01-XX

### Added

- Initial release
- Basic slop detection and removal
- JSON/JSONL file support
- Rich console output
