"""Operator CLI for the Modal integration.

Run it through `scripts/devops/modal.sh` (or `make modal-status`), which pins the
uv environment. Every subcommand shells out to the Modal CLI with the current
interpreter, so the SDK used here is always the one `uv` installed:

* `status` — report SDK version, profile, auth and the resolved app/GPU knobs.
  Read-only, safe to run anywhere.
* `check` — run the smoke app on Modal to prove a real round trip.
* `targets` — list the Modal workloads: training, testing, dataset creation and
  embeddings, with the module and accelerator each one uses.
* `embed` / `train` / `test` / `dataset` — run that workload; the remaining
  arguments are forwarded to the app's local entrypoint.
* `deploy` — deploy every deployable app in `infra/modal/apps`.
* `secret-sync` — create/update the Modal secret from local env vars.
* `apps` — list the apps this repo owns.

`status` never prompts and never touches the network when unauthenticated: the
probe (`modal environment list`) fails fast without a token instead of opening a
browser, which is what makes the command usable from CI and from a headless box.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import logging
import os
import subprocess
import sys
from pathlib import Path

from infra.modal.shared.gpu import app_namespace, gpu_type
from infra.modal.shared.workloads import APPS, RUN_TARGETS, WORKLOADS, resolve

REPO_ROOT = Path(__file__).resolve().parents[3]

SCRIPT = "scripts/devops/modal.sh"

#: Secret the apps read at run time; see `secret-sync`.
SECRET_NAME = "pixelated-runtime"

#: Env vars `secret-sync` pushes when they are set locally.
SYNCABLE_ENV_VARS = ("HF_TOKEN", "HUGGINGFACE_HUB_TOKEN", "WANDB_API_KEY")

logger = logging.getLogger(__name__)


def _modal_command(*args: str) -> list[str]:
    """Return a Modal CLI invocation that uses this interpreter's package."""
    return [sys.executable, "-m", "modal", *args]


def _run(*args: str) -> int:
    """Run the Modal CLI in the repo root and return its exit code."""
    return subprocess.run(_modal_command(*args), cwd=REPO_ROOT, check=False).returncode


def _modal_version() -> str:
    """Return the installed Modal SDK version without importing it."""
    try:
        return importlib.metadata.version("modal")
    except importlib.metadata.PackageNotFoundError:
        return "not installed"


def _profile_name() -> str:
    """Return the active Modal CLI profile, or `unset` when there is none."""
    probe = subprocess.run(
        _modal_command("profile", "current"),
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    return probe.stdout.strip() or "unset"


def _authenticated() -> bool:
    """True when the CLI can talk to Modal without asking for credentials."""
    probe = subprocess.run(
        _modal_command("environment", "list"),
        cwd=REPO_ROOT,
        capture_output=True,
        check=False,
        timeout=120,
    )
    return probe.returncode == 0


def command_status(_: argparse.Namespace) -> int:
    """Report whether this checkout can use Modal. Never modifies anything."""
    authenticated = _authenticated()
    logger.info("%-13s %s", "sdk", _modal_version())
    logger.info("%-13s %s", "profile", _profile_name())
    logger.info(
        "%-13s %s",
        "credentials",
        "MODAL_TOKEN_ID/SECRET" if os.environ.get("MODAL_TOKEN_ID") else "~/.modal.toml",
    )
    logger.info("%-13s %s", "namespace", app_namespace())
    logger.info("%-13s %s", "gpu", gpu_type())
    logger.info("%-13s %s", "authenticated", "yes" if authenticated else "no")

    if authenticated:
        logger.info("ready; `%s check` runs a real container", SCRIPT)
        return 0

    logger.warning(
        "Modal is not configured: run `uv run modal setup` (browser login) or set "
        "MODAL_TOKEN_ID and MODAL_TOKEN_SECRET, then re-run this command"
    )
    return 1


def command_check(_: argparse.Namespace) -> int:
    """Run the smoke app on Modal."""
    return _run("run", "-m", "infra.modal.apps.smoke")


def command_deploy(args: argparse.Namespace) -> int:
    """Deploy the repo's apps, stopping at the first failure."""
    targets = tuple(args.app or APPS)
    for target in targets:
        logger.info("deploying %s", target)
        code = _run("deploy", "-m", f"infra.modal.apps.{target}")
        if code != 0:
            logger.error("deploy failed for %s (exit %d)", target, code)
            return code
    logger.info("deployed: %s", ", ".join(targets))
    return 0


def command_secret_sync(args: argparse.Namespace) -> int:
    """Create or update the runtime secret from locally exported env vars.

    Values are handed to the Modal CLI as arguments, matching the documented
    `modal secret create NAME KEY=VALUE` form — run it on a trusted workstation.
    Nothing is logged except the key names.
    """
    selected = [key.strip() for key in args.keys.split(",") if key.strip()]
    keys = selected or [key for key in SYNCABLE_ENV_VARS if os.environ.get(key)]
    if not keys:
        logger.error(
            "no keys selected: export one of %s or pass --keys",
            ", ".join(SYNCABLE_ENV_VARS),
        )
        return 2

    missing = [key for key in keys if not os.environ.get(key)]
    if missing:
        logger.error("not set locally, refusing to sync: %s", ", ".join(missing))
        return 2

    logger.info("syncing %s into modal secret %s", ", ".join(keys), args.name)
    assignments = [f"{key}={os.environ[key]}" for key in keys]
    return _run("secret", "create", args.name, *assignments, "--force")


def command_targets(_: argparse.Namespace) -> int:
    """List the Modal workloads this repo can run."""
    for workload in WORKLOADS.values():
        logger.info(
            "%-8s %-6s %-34s %s",
            workload.name,
            workload.gpu() or "cpu",
            workload.module,
            workload.description,
        )
    return 0


def command_workload(args: argparse.Namespace) -> int:
    """Run one workload, forwarding the remaining arguments to its entrypoint."""
    workload = resolve(args.workload)
    extra = list(getattr(args, "extra", []))
    logger.info("running %s on %s (%s)", workload.name, workload.gpu() or "cpu", workload.module)
    return _run("run", "-m", workload.module, *extra)


def command_apps(_: argparse.Namespace) -> int:
    """List the apps this repo owns and where each module lives."""
    for workload in WORKLOADS.values():
        logger.info("%-8s %s", workload.name, workload.module.replace(".", "/") + ".py")
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the subcommand parser."""
    parser = argparse.ArgumentParser(
        prog=SCRIPT,
        description="Modal compute platform operations for Pixelated Empathy.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    status = subparsers.add_parser("status", help="report Modal configuration")
    status.set_defaults(handler=command_status)

    check = subparsers.add_parser("check", help="run the smoke app on Modal")
    check.set_defaults(handler=command_check)

    targets = subparsers.add_parser("targets", help="list the Modal workloads")
    targets.set_defaults(handler=command_targets)

    for name in RUN_TARGETS:
        workload = WORKLOADS[name]
        runner = subparsers.add_parser(
            name,
            help=workload.description,
            description=f"{workload.description}. Remaining arguments are forwarded to the app.",
        )
        runner.set_defaults(handler=command_workload, workload=name)

    deploy = subparsers.add_parser("deploy", help="deploy the repo apps to Modal")
    deploy.add_argument("--app", action="append", choices=APPS, help="deploy only this app")
    deploy.set_defaults(handler=command_deploy)

    secret_sync = subparsers.add_parser("secret-sync", help="create/update the runtime secret")
    secret_sync.add_argument("--name", default=SECRET_NAME, help=f"secret name (default: {SECRET_NAME})")
    secret_sync.add_argument(
        "--keys",
        default="",
        help=f"comma-separated env vars to push (default: {', '.join(SYNCABLE_ENV_VARS)})",
    )
    secret_sync.set_defaults(handler=command_secret_sync)

    apps = subparsers.add_parser("apps", help="list the repo apps")
    apps.set_defaults(handler=command_apps)

    return parser


def main(argv: list[str] | None = None) -> int:
    """Entry point: parse arguments and dispatch to a subcommand.

    Workload subcommands take no options of their own, so anything argparse does
    not recognise is forwarded verbatim to the app's local entrypoint
    (`train --epochs 2` becomes `modal run -m ...train --epochs 2`).
    """
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = build_parser()
    args, unknown = parser.parse_known_args(argv)
    if unknown:
        if not getattr(args, "workload", None):
            parser.error(f"unrecognized arguments: {' '.join(unknown)}")
        args.extra = unknown
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
