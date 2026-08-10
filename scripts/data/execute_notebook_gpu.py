import logging
import os

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def main():
    logger.info("⚡ Executing L40s GPU vLLM High-Throughput Dataset Generation Job...")
    script_path = "scripts/data/pixelated_edge_cases_vllm_l40s.py"
    cmd = f"uv run data-designer create {script_path} --num-records 100000 --dataset-name pixelated_edge_cases_100k --artifact-path /data/vivi/pixelated/artifacts --resume if_possible"
    os.system(cmd)


if __name__ == "__main__":
    main()
