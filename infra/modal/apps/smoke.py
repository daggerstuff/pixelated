"""Smoke app: the cheapest way to prove Modal works for this repo.

    uv run modal run -m infra.modal.apps.smoke

Runs one short CPU container, reports what the sandbox looks like, and checks
that the container can reach the network. No GPU, no model download, no repo
secrets — a few seconds of compute, so it is safe to run from CI, from a fresh
checkout, or as the first step after `modal setup`.
"""

from __future__ import annotations

import logging
import os
import platform
import sys
import urllib.request

import modal
from infra.modal.shared.gpu import app_name, gpu_type

APP_NAME = app_name("smoke")

image = modal.Image.debian_slim(python_version="3.12")

app = modal.App(APP_NAME)

logger = logging.getLogger(__name__)


@app.function(image=image, timeout=300)
def probe() -> dict[str, str]:
    """Run inside the container and report what the sandbox looks like."""
    try:
        with urllib.request.urlopen("https://modal.com", timeout=10) as response:
            network = f"modal.com -> HTTP {response.status}"
    except OSError as error:
        network = f"modal.com -> error: {error}"
    return {
        "app": APP_NAME,
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "cpus": str(os.cpu_count() or 0),
        "network": network,
    }


@app.local_entrypoint()
def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger.info("app=%s gpu=%s (override with PIXELATED_MODAL_GPU)", APP_NAME, gpu_type())
    for key, value in probe.remote().items():
        logger.info("%-9s %s", key, value)
