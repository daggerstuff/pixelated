from __future__ import annotations

import importlib.util
import os
import time
from pathlib import Path

SCRIPT_PATH = (
    Path(os.environ.get("PIXELATED_ROOT", str(Path(__file__).parent.parent.parent)))
    / ".agent"
    / "internal"
    / "scripts"
    / "execute_dual_storage_copy_jobs.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "dual_storage_copy_executor",
        SCRIPT_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module from {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_build_execution_queue_filters_by_target_and_skips_blocked_jobs() -> None:
    module = _load_module()
    copy_plan = {
        "jobs": [
            {
                "name": "final_dataset",
                "local_job": {
                    "blocked": False,
                    "command": ["rclone", "copy", "src", "dst"],
                },
                "s3_job": {
                    "command": ["s3cmd", "sync", "dst/", "s3://pixel-data/final_dataset/"],
                },
            },
            {
                "name": "compiled_dataset",
                "local_job": {
                    "blocked": True,
                    "blocked_reason": "storage_plan_materialization_dry_run",
                    "command": ["rclone", "copy", "src2", "dst2"],
                },
                "s3_job": {
                    "command": ["s3cmd", "sync", "dst2/", "s3://pixel-data/compiled_dataset/"],
                },
            },
        ],
    }

    queue = module.build_execution_queue(copy_plan=copy_plan, target="both")

    assert [item["job_name"] for item in queue] == [
        "final_dataset",
        "final_dataset",
    ]
    assert [item["stage"] for item in queue] == ["local", "s3"]
    assert queue[1]["depends_on"] == "local_stage"


def test_build_execution_queue_local_target_never_adds_s3_jobs() -> None:
    module = _load_module()
    copy_plan = {
        "jobs": [
            {
                "name": "final_dataset",
                "local_job": {
                    "blocked": False,
                    "command": ["rclone", "copy", "src", "dst"],
                },
                "s3_job": {
                    "command": ["s3cmd", "sync", "dst/", "s3://pixel-data/final_dataset/"],
                },
            }
        ],
    }

    queue = module.build_execution_queue(copy_plan=copy_plan, target="local")

    assert queue == [
        {
            "job_name": "final_dataset",
            "stage": "local",
            "command": ["rclone", "copy", "src", "dst"],
        }
    ]


def test_build_execution_queue_skips_s3_when_local_source_is_not_present() -> None:
    module = _load_module()
    copy_plan = {
        "jobs": [
            {
                "name": "final_dataset",
                "local_path": "/tmp/definitely-missing-pixelated-source",
                "local_job": None,
                "s3_job": {
                    "command": [
                        "s3cmd",
                        "sync",
                        "/tmp/definitely-missing-pixelated-source/",
                        "s3://pixel-data/final_dataset/",
                    ],
                },
            }
        ],
    }

    queue = module.build_execution_queue(copy_plan=copy_plan, target="s3")

    assert queue == []


def test_build_execution_queue_skips_s3_when_local_directory_is_empty(tmp_path: Path) -> None:
    module = _load_module()
    empty_dir = tmp_path / "staged-empty"
    empty_dir.mkdir()
    copy_plan = {
        "jobs": [
            {
                "name": "final_dataset",
                "local_path": str(empty_dir),
                "local_job": None,
                "s3_job": {
                    "command": ["s3cmd", "sync", f"{empty_dir}/", "s3://pixel-data/final_dataset/"],
                },
            }
        ],
    }

    queue = module.build_execution_queue(copy_plan=copy_plan, target="s3")

    assert queue == []


def test_execute_queue_dry_run_reports_commands_without_running() -> None:
    module = _load_module()
    queue = [
        {
            "job_name": "final_dataset",
            "stage": "local",
            "command": ["rclone", "copy", "src", "dst"],
        },
        {
            "job_name": "final_dataset",
            "stage": "s3",
            "depends_on": "local_stage",
            "command": ["s3cmd", "sync", "dst/", "s3://pixel-data/final_dataset/"],
        },
    ]

    results = module.execute_queue(queue=queue, execute=False)

    assert [result["status"] for result in results] == ["dry_run", "dry_run"]
    assert results[0]["command"] == ["rclone", "copy", "src", "dst"]
    assert results[1]["command"] == [
        "s3cmd",
        "sync",
        "dst/",
        "s3://pixel-data/final_dataset/",
    ]


def test_execute_queue_runs_jobs_in_parallel_when_execute_enabled() -> None:
    module = _load_module()
    queue = [
        {
            "job_name": "job1",
            "stage": "local",
            "command": ["cmd", "one"],
        },
        {
            "job_name": "job2",
            "stage": "local",
            "command": ["cmd", "two"],
        },
        {
            "job_name": "job3",
            "stage": "s3",
            "command": ["cmd", "three"],
        },
        {
            "job_name": "job4",
            "stage": "s3",
            "command": ["cmd", "four"],
        },
    ]

    def runner(command: list[str]):
        time.sleep(0.05)
        return {
            "returncode": 0,
            "stdout": "ok",
            "stderr": "",
        }

    started = time.perf_counter()
    results = module.execute_queue(
        queue=queue,
        execute=True,
        runner=runner,
        max_workers=4,
    )
    elapsed = time.perf_counter() - started

    assert len(results) == 4
    assert all(result["status"] == "success" for result in results)
    assert elapsed < 0.15


def test_execute_queue_respects_local_before_s3_dependency() -> None:
    module = _load_module()
    queue = [
        {
            "job_name": "final_dataset",
            "stage": "local",
            "command": ["rclone", "copy", "src", "dst"],
        },
        {
            "job_name": "final_dataset",
            "stage": "s3",
            "depends_on": "local_stage",
            "command": ["s3cmd", "sync", "dst/", "s3://pixel-data/final_dataset/"],
        },
    ]
    events: list[tuple[str, str]] = []

    def runner(command: list[str]):
        stage = "s3" if command[0] == "s3cmd" else "local"
        events.append(("start", stage))
        time.sleep(0.01)
        events.append(("end", stage))
        return {
            "returncode": 0,
            "stdout": "ok",
            "stderr": "",
        }

    results = module.execute_queue(
        queue=queue,
        execute=True,
        runner=runner,
        max_workers=2,
    )

    assert [result["status"] for result in results] == ["success", "success"]
    assert events == [
        ("start", "local"),
        ("end", "local"),
        ("start", "s3"),
        ("end", "s3"),
    ]


def test_execute_queue_starts_s3_after_its_local_job_without_waiting_for_all_locals() -> None:
    module = _load_module()
    queue = [
        {
            "job_name": "job1",
            "stage": "local",
            "command": ["rclone", "copy", "src1", "dst1"],
        },
        {
            "job_name": "job1",
            "stage": "s3",
            "depends_on": "local_stage",
            "command": ["s3cmd", "sync", "dst1/", "s3://pixel-data/job1/"],
        },
        {
            "job_name": "job2",
            "stage": "local",
            "command": ["rclone", "copy", "src2", "dst2"],
        },
        {
            "job_name": "job2",
            "stage": "s3",
            "depends_on": "local_stage",
            "command": ["s3cmd", "sync", "dst2/", "s3://pixel-data/job2/"],
        },
    ]
    events: list[str] = []

    def runner(command: list[str]):
        label = command[-1]
        events.append(f"start:{label}")
        if label == "dst1":
            time.sleep(0.01)
        elif label == "dst2":
            time.sleep(0.05)
        events.append(f"end:{label}")
        return {
            "returncode": 0,
            "stdout": "ok",
            "stderr": "",
        }

    results = module.execute_queue(
        queue=queue,
        execute=True,
        runner=runner,
        max_workers=2,
    )

    assert len(results) == 4
    assert events.index("start:s3://pixel-data/job1/") < events.index("end:dst2")


def test_execute_queue_skips_s3_when_local_stage_fails() -> None:
    module = _load_module()
    queue = [
        {
            "job_name": "final_dataset",
            "stage": "local",
            "command": ["rclone", "copy", "src", "dst"],
        },
        {
            "job_name": "final_dataset",
            "stage": "s3",
            "depends_on": "local_stage",
            "command": ["s3cmd", "sync", "dst/", "s3://pixel-data/final_dataset/"],
        },
    ]

    def runner(command: list[str]):
        if command[0] == "rclone":
            return {"returncode": 1, "stdout": "", "stderr": "local failed"}
        return {"returncode": 0, "stdout": "ok", "stderr": ""}

    results = module.execute_queue(
        queue=queue,
        execute=True,
        runner=runner,
        max_workers=2,
    )

    assert results == [
        {
            "job_name": "final_dataset",
            "stage": "local",
            "status": "failed",
            "returncode": 1,
            "command": ["rclone", "copy", "src", "dst"],
            "stdout": "",
            "stderr": "local failed",
        }
    ]


def test_execute_queue_runs_s3_only_jobs_when_local_content_is_already_staged() -> None:
    module = _load_module()
    queue = [
        {
            "job_name": "final_dataset",
            "stage": "s3",
            "depends_on": "local_stage",
            "command": ["s3cmd", "sync", "dst/", "s3://pixel-data/final_dataset/"],
        }
    ]

    def runner(command: list[str]):
        return {"returncode": 0, "stdout": "ok", "stderr": ""}

    results = module.execute_queue(
        queue=queue,
        execute=True,
        runner=runner,
        max_workers=1,
    )

    assert results == [
        {
            "job_name": "final_dataset",
            "stage": "s3",
            "status": "success",
            "returncode": 0,
            "command": ["s3cmd", "sync", "dst/", "s3://pixel-data/final_dataset/"],
            "stdout": "ok",
            "stderr": "",
        }
    ]
