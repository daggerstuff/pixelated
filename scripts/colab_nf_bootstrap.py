#!/usr/bin/env python3
"""Colab bootstrap for the +50k edge/nightmare run (Stage 3).

Untars the uploaded ``ai/`` tree, installs Ollama, pulls a local generation
model, and runs the Stage-3 generator against the local vLLM endpoint
(``VLLM_URL``). Needs a GPU for the 12B model.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tarfile
import threading
import time
import urllib.request
from typing import Any

try:
    import weave
except ImportError:
    weave = None

try:
    from langsmith.run_trees import RunTree
except ImportError:
    RunTree = None

ENV_FILE = "/content/nf_env"
TARBALL = "/content/nf_code.tar.gz"
OUTPUT_DIR = "/content/output"
AI_DIR = "/content/ai"

OLLAMA_TAR_ZST = "https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst"

# Crash-persistence: periodically mirror the local output dir to a durable
# remote via rclone. The target is env-configurable so a writable S3 remote (or
# gdrive) can be supplied in the uploaded env; see ``configure_rclone``.
UPLOAD_INTERVAL_SECONDS = 300


def sh(cmd: str) -> None:
    print("+", cmd, flush=True)
    subprocess.run(cmd, shell=True, check=True)


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    with open(ENV_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k] = v
    return env


def install_ollama() -> None:
    """Install Ollama. Primary: official script. Fallback: GitHub tar.zst.

    Verified: ``ollama.com/install.sh`` returns 200 and the amd64 CUDA asset is
    ``ollama-linux-amd64.tar.zst`` under the ``latest`` release tag.
    """
    if shutil.which("ollama"):
        return
    try:
        sh("curl -fsSL https://ollama.com/install.sh | sh")
        return
    except subprocess.CalledProcessError:
        print("install.sh failed; falling back to GitHub tar.zst", flush=True)

    zst = "/tmp/ollama-linux-amd64.tar.zst"
    tar = "/tmp/ollama-linux-amd64.tar"
    sh(f"curl -fL -o {zst} '{OLLAMA_TAR_ZST}'")
    sh(f"{sys.executable} -m pip install -q zstandard")

    # Decompress .zst -> .tar in Python (no zstd binary on Colab).
    import zstandard

    # Stream the frame: the release tarball is compressed without a content-size
    # hint, so the one-shot decompressor raises ZstdError ("could not determine
    # content size in frame header").
    with open(zst, "rb") as src, open(tar, "wb") as dst:
        zstandard.ZstdDecompressor().copy_stream(src, dst)

    # Extract the FULL tarball (not just bin/ollama) so the bundled
    # lib/ollama/cuda_v12 CUDA libs are present.
    sh(f"tar -C /usr/local -xf {tar}")

    # Point Ollama at its bundled CUDA libs and the first GPU.
    os.environ["LD_LIBRARY_PATH"] = "/usr/local/lib/ollama:" + os.environ.get("LD_LIBRARY_PATH", "")
    os.environ["CUDA_VISIBLE_DEVICES"] = "0"
    os.environ["PATH"] = "/usr/local/bin:" + os.environ.get("PATH", "")


def install_rclone() -> None:
    """Install rclone on the Colab VM (needed for periodic durable uploads)."""
    if shutil.which("rclone"):
        return
    sh("curl -fsSL https://rclone.org/install.sh | sudo bash")


def configure_rclone(cfg: dict[str, str]) -> str:
    """Configure an rclone remote from the uploaded env; return the remote name.

    Accepted forms:
    * ``RCLONE_CONF`` — full rclone.conf text (covers gdrive or S3 uniformly).
    * ``S3_*`` — endpoint/access/secret/bucket, turned into an ``[s3]`` remote.
    """
    conf_dir = os.path.expanduser("~/.config/rclone")
    os.makedirs(conf_dir, exist_ok=True)

    conf = cfg.get("RCLONE_CONF", "").strip()
    if conf:
        with open(os.path.join(conf_dir, "rclone.conf"), "w", encoding="utf-8") as f:
            f.write(conf.rstrip() + "\n")
        return cfg.get("NF_UPLOAD_REMOTE", "gdrive").strip()

    # Cloudflare R2 S3-compatible endpoint (preferred path for large/incremental
    # uploads when R2 S3 creds are present).
    r2_endpoint = cfg.get("R2_ENDPOINT", "").strip()
    r2_access = cfg.get("R2_ACCESS_KEY_ID", "").strip()
    r2_secret = cfg.get("R2_SECRET_ACCESS_KEY", "").strip()
    r2_bucket = cfg.get("R2_BUCKET", "").strip()
    if r2_endpoint and r2_access and r2_secret and r2_bucket:
        with open(os.path.join(conf_dir, "rclone.conf"), "w", encoding="utf-8") as f:
            f.write(
                "[r2]\n"
                "type = s3\n"
                "provider = Cloudflare\n"
                f"access_key_id = {r2_access}\n"
                f"secret_access_key = {r2_secret}\n"
                f"endpoint = {r2_endpoint}\n"
                "region = auto\n"
            )
        return "r2"

    endpoint = cfg.get("S3_ENDPOINT", "").strip()
    access = cfg.get("S3_ACCESS_KEY", "").strip()
    secret = cfg.get("S3_SECRET_KEY", "").strip()
    bucket = cfg.get("S3_BUCKET", "").strip()
    if endpoint and access and secret and bucket:
        region = cfg.get("S3_REGION", "nyc1").strip()
        with open(os.path.join(conf_dir, "rclone.conf"), "w", encoding="utf-8") as f:
            f.write(
                "[s3]\n"
                "type = s3\n"
                "provider = Other\n"
                f"endpoint = {endpoint}\n"
                f"region = {region}\n"
                "force_path_style = true\n"
                f"access_key_id = {access}\n"
                f"secret_access_key = {secret}\n"
            )
        return "s3"
    return cfg.get("NF_UPLOAD_REMOTE", "gdrive").strip()


def resolve_upload_target(cfg: dict[str, str]) -> tuple[str, str, int]:
    remote = cfg.get("NF_UPLOAD_REMOTE", "gdrive").strip()
    path = cfg.get("NF_UPLOAD_PATH", "pixeldata/colab_nf_output").strip()
    interval = int(cfg.get("NF_UPLOAD_INTERVAL", str(UPLOAD_INTERVAL_SECONDS)))
    return remote, path, interval


def _rclone_upload(remote: str, path: str, output_dir: str) -> None:
    """Incremental mirror of the output dir to ``remote:path`` (idempotent)."""
    try:
        subprocess.run(
            ["rclone", "copy", output_dir, f"{remote}:{path}"],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception as e:  # pragma: no cover - network path
        print(f"upload failed: {e}", flush=True)


def _upload_once(cfg: dict[str, str], remote: str, path: str, output_dir: str) -> None:
    """Mirror output to the durable target: R2 S3 via rclone, else the configured remote."""
    r2_bucket = cfg.get("R2_BUCKET", "").strip()
    r2_s3 = bool(
        cfg.get("R2_ACCESS_KEY_ID", "").strip()
        and cfg.get("R2_SECRET_ACCESS_KEY", "").strip()
        and cfg.get("R2_ENDPOINT", "").strip()
        and r2_bucket
    )
    if r2_s3:
        prefix = cfg.get("R2_PREFIX", "colab_nf_output").strip()
        _rclone_upload("r2", f"{r2_bucket}/{prefix}", output_dir)
    else:
        _rclone_upload(remote, path, output_dir)


def _periodic_upload_loop(
    cfg: dict[str, str],
    remote: str,
    path: str,
    output_dir: str,
    interval: int,
    stop: threading.Event,
) -> None:
    """Daemon thread: mirror output every ``interval`` seconds until stopped."""
    while not stop.wait(interval):
        _upload_once(cfg, remote, path, output_dir)


def init_observability(cfg: dict[str, str]) -> Any:
    """Init Weave + LangSmith from the uploaded env; return a LangSmith RunTree or None.

    Credentials are read from ``cfg`` (the ``/content/nf_env`` upload) and exported to
    ``os.environ`` so the generation subprocess inherits them too.
    """
    langsmith_key = cfg.get("LANGSMITH_API_KEY", "").strip()
    project = cfg.get("LANGSMITH_PROJECT", "clinical-nf-generation").strip()
    langsmith_workspace = cfg.get("LANGSMITH_WORKSPACE_ID", "").strip()
    if langsmith_key:
        os.environ["LANGSMITH_API_KEY"] = langsmith_key
        os.environ["LANGSMITH_TRACING_V2"] = "true"
        os.environ["LANGSMITH_PROJECT"] = project
        if langsmith_workspace:
            os.environ["LANGSMITH_WORKSPACE_ID"] = langsmith_workspace

    wandb_key = cfg.get("WANDB_API_KEY", "").strip()
    if wandb_key:
        os.environ["WANDB_API_KEY"] = wandb_key

    if wandb_key and weave is not None:
        try:
            weave.init(cfg.get("WANDB_PROJECT", "pixelated-empathy-kan28"))
        except Exception as e:
            print(f"weave.init skipped: {e}", flush=True)

    if langsmith_key and RunTree is not None:
        try:
            tree = RunTree(
                name="colab-edge-nightmare-50k",
                run_type="chain",
                project_name=project,
                inputs={
                    "target": cfg.get("TARGET", "50000"),
                    "model": cfg.get("LOCAL_MODEL", "gurubot/wayfarer-2-12B"),
                    "backend": "vllm",
                },
            )
            tree.post()
            return tree
        except Exception as e:
            print(f"LangSmith RunTree skipped: {e}", flush=True)
    return None


def main() -> int:
    cfg = load_env()
    tree = init_observability(cfg)
    local_model = cfg.get("LOCAL_MODEL", "gurubot/wayfarer-2-12B")
    vllm_url = cfg.get("VLLM_URL", "http://localhost:11434")
    target = cfg.get("TARGET", "50000")

    tarfile.open(TARBALL).extractall("/content")
    sh(f"{sys.executable} -m pip install -q aiohttp langsmith weave")

    install_ollama()
    proc = subprocess.Popen(
        ["ollama", "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Wait for the server to bind before pulling — `ollama pull` is a client that
    # talks to localhost:11434 and otherwise races the server startup.
    for _ in range(60):
        try:
            urllib.request.urlopen("http://localhost:11434/api/version", timeout=1)
            break
        except Exception:
            time.sleep(1)
    sh(f"ollama pull {local_model}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.environ["NF_BACKEND"] = "vllm"
    os.environ["VLLM_URL"] = vllm_url
    os.environ["NF_MODEL"] = local_model
    os.environ["NF_OUTPUT_DIR"] = OUTPUT_DIR

    # Crash-persistence: mirror output to a durable remote every N seconds so a
    # killed/restarted VM doesn't lose the whole run. Best-effort — generation
    # proceeds even if the upload remote is unreachable or unwritable.
    remote, upload_path, interval = resolve_upload_target(cfg)
    install_rclone()
    upload_remote = configure_rclone(cfg)
    if upload_remote:
        remote = upload_remote
    stop_upload = threading.Event()
    upload_thread = threading.Thread(
        target=_periodic_upload_loop,
        args=(cfg, remote, upload_path, OUTPUT_DIR, interval, stop_upload),
        daemon=True,
    )
    upload_thread.start()

    # Wait for the local OpenAI-compatible endpoint to come up before generating.
    for _ in range(180):
        try:
            urllib.request.urlopen(f"{vllm_url}/v1/models", timeout=1)
            break
        except Exception:
            time.sleep(1)
    else:
        print("WARNING: Ollama endpoint not reachable; proceeding anyway", flush=True)

    gen_cmd = [sys.executable, "-m", "training.build_edge_and_nightmare_dataset", "--target", target]
    # Optional hard cap for smoke/dry runs: stops generation once NF_LIMIT records
    # are reached (the generator's own --limit flag).
    limit = cfg.get("NF_LIMIT", "").strip()
    if limit:
        gen_cmd += ["--limit", limit]
    r = subprocess.run(
        gen_cmd,
        cwd=AI_DIR,
        env={**os.environ, "PYTHONPATH": AI_DIR},
    )
    if tree is not None and hasattr(tree, "end"):
        try:
            tree.end(outputs={"returncode": r.returncode})
            tree.patch()
        except Exception as e:
            print(f"LangSmith RunTree end skipped: {e}", flush=True)

    # Final flush before teardown: never trash the instance until output is off it.
    stop_upload.set()
    upload_thread.join(timeout=30)
    _upload_once(cfg, remote, upload_path, OUTPUT_DIR)
    proc.terminate()
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
