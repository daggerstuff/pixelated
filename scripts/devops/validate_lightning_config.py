import json
import sys
from pathlib import Path


def validate_config(config_path):
    try:
        config = json.loads(Path(config_path).read_text())
    except Exception as e:
        print(f"FAIL::config_read::{str(e)}")
        return

    required_keys = [
        "run_name",
        "base_model",
        "resume_from_checkpoint",
        "train_data_path",
        "dataloader_num_workers",
        "precision",
    ]

    for key in required_keys:
        print(f"KEY::{key}::{key in config}")

    if "run_name" in config:
        print(f"VALUE::run_name::{config['run_name']}")
    if "train_data_path" in config:
        print(f"VALUE::train_data_path::{config['train_data_path']}")
    if "resume_from_checkpoint" in config:
        print(f"VALUE::resume_from_checkpoint::{config['resume_from_checkpoint']}")
    if "dataloader_num_workers" in config:
        print(f"VALUE::dataloader_num_workers::{config['dataloader_num_workers']}")
    if "precision" in config:
        print(f"VALUE::precision::{config['precision']}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("FAIL::args::Missing config path")
        sys.exit(1)
    validate_config(sys.argv[1])
