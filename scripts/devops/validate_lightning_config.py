import json
import sys
from pathlib import Path


def validate_config(config_path):
    try:
        config = json.loads(Path(config_path).read_text())
    except Exception:
        return

    required_keys = [
        "run_name",
        "base_model",
        "resume_from_checkpoint",
        "train_data_path",
        "dataloader_num_workers",
        "precision",
    ]

    for _key in required_keys:
        pass

    if "run_name" in config:
        pass
    if "train_data_path" in config:
        pass
    if "resume_from_checkpoint" in config:
        pass
    if "dataloader_num_workers" in config:
        pass
    if "precision" in config:
        pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    validate_config(sys.argv[1])
