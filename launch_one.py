"""Launch a single experiment pair. Usage: python launch_one.py <exp_id>"""
import asyncio
import os
import sys
import time
import traceback

# Load .env
with open(".env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            os.environ[key] = val.strip().strip("'").strip('"')

EXP_MAP = {
    "1": ("experiments.config_experiment_1", "run_exp_1"),
    "2": ("experiments.config_experiments_2_4_5_6", "run_exp_2"),
    "3": ("experiments.config_experiment_3", "run_exp_3"),
    "4": ("experiments.config_experiments_2_4_5_6", "run_exp_4"),
    "5": ("experiments.config_experiments_2_4_5_6", "run_exp_5"),
    "6": ("experiments.config_experiments_2_4_5_6", "run_exp_6"),
}


async def main():
    exp_id = sys.argv[1] if len(sys.argv) > 1 else "1"
    if exp_id not in EXP_MAP:
        print(f"Unknown experiment: {exp_id}. Available: {list(EXP_MAP.keys())}")
        sys.exit(1)

    module_name, fn_name = EXP_MAP[exp_id]
    mod = __import__(module_name, fromlist=[fn_name])
    fn = getattr(mod, fn_name)

    t0 = time.time()
    print(f"[{time.strftime('%H:%M:%S')}] Starting Exp #{exp_id}...", flush=True)
    try:
        model_a, model_b = await fn()
        print(f"[{time.strftime('%H:%M:%S')}] Exp #{exp_id} COMPLETE in {time.time()-t0:.0f}s", flush=True)
        print(f"  A: {model_a.model.name} tags={model_a.tags}", flush=True)
        print(f"  B: {model_b.model.name} tags={model_b.tags}", flush=True)
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Exp #{exp_id} FAILED in {time.time()-t0:.0f}s", flush=True)
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
