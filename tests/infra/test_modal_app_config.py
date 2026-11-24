"""Offline checks for the Modal integration in `infra/modal`.

Nothing here needs a Modal account, a token, or network access: these tests pin
the parts that break silently — app naming, accelerator/env resolution, the
workload registry behind the CLI targets, canonical row handling, the input
parsing the apps do client-side, and the operator CLI's argument wiring.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import pytest

from infra.modal.apps import batch_embed, dataset, smoke, test_suite, train
from infra.modal.ops import cli
from infra.modal.shared import gpu, paths, rows, workloads


def test_app_names_are_namespaced(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PIXELATED_MODAL_NAMESPACE", raising=False)
    assert gpu.app_name("smoke") == "pixelated-smoke"

    monkeypatch.setenv("PIXELATED_MODAL_NAMESPACE", "acme")
    assert gpu.app_name("smoke") == "acme-smoke"


def test_namespace_falls_back_when_blank(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIXELATED_MODAL_NAMESPACE", "   ")
    assert gpu.app_namespace() == gpu.DEFAULT_NAMESPACE


def test_apps_bind_their_modal_app_to_that_name() -> None:
    assert smoke.app.name == smoke.APP_NAME
    assert batch_embed.app.name == batch_embed.APP_NAME
    assert smoke.APP_NAME.endswith("-smoke")
    assert batch_embed.APP_NAME.endswith("-embed")


def test_gpu_type_defaults_to_a_single_l4(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PIXELATED_MODAL_GPU", raising=False)
    assert gpu.gpu_type() == "L4"


def test_gpu_type_accepts_any_modal_spec(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIXELATED_MODAL_GPU", "H100:2")
    assert gpu.gpu_type() == "H100:2"

    monkeypatch.setenv("PIXELATED_MODAL_GPU", " ")
    assert gpu.gpu_type() == gpu.DEFAULT_GPU


def test_read_inputs_splits_pipe_separated_texts() -> None:
    assert batch_embed._read_inputs(texts="first| second |", dataset="") == [
        "first",
        "second",
    ]


def test_read_inputs_accepts_jsonl_rows(tmp_path) -> None:
    source = tmp_path / "rows.jsonl"
    source.write_text(
        "\n".join(
            [
                json.dumps({"text": "first"}),
                "",
                json.dumps({"content": "second"}),
                "  plain third  ",
            ]
        ),
        encoding="utf-8",
    )

    assert batch_embed._read_inputs(texts="", dataset=str(source)) == [
        "first",
        "second",
        "plain third",
    ]


def test_read_inputs_merges_both_sources(tmp_path) -> None:
    source = tmp_path / "rows.jsonl"
    source.write_text(json.dumps({"text": "from file"}), encoding="utf-8")

    assert batch_embed._read_inputs(texts="from flag", dataset=str(source)) == [
        "from flag",
        "from file",
    ]


def test_read_inputs_rejects_missing_dataset(tmp_path) -> None:
    with pytest.raises(FileNotFoundError, match="dataset not found"):
        batch_embed._read_inputs(texts="", dataset=str(tmp_path / "absent.jsonl"))


def test_modal_command_uses_the_running_interpreter() -> None:
    assert cli._modal_command("run", "-m", "app") == [
        sys.executable,
        "-m",
        "modal",
        "run",
        "-m",
        "app",
    ]


def test_status_exits_nonzero_when_unauthenticated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cli, "_authenticated", lambda: False)
    assert cli.command_status(argparse.Namespace()) == 1


def test_status_exits_zero_when_authenticated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli, "_authenticated", lambda: True)
    assert cli.command_status(argparse.Namespace()) == 0


def test_deploy_parser_defaults_to_every_app() -> None:
    args = cli.build_parser().parse_args(["deploy"])
    assert args.handler is cli.command_deploy
    assert args.app is None
    assert tuple(args.app or cli.APPS) == cli.APPS


def test_deploy_parser_accepts_a_single_app() -> None:
    args = cli.build_parser().parse_args(["deploy", "--app", "smoke"])
    assert args.app == ["smoke"]


def test_secret_sync_refuses_keys_missing_locally(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("HF_TOKEN", raising=False)
    args = argparse.Namespace(name="pixelated-runtime", keys="HF_TOKEN")
    assert cli.command_secret_sync(args) == 2


def test_secret_sync_refuses_an_empty_selection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for key in cli.SYNCABLE_ENV_VARS:
        monkeypatch.delenv(key, raising=False)
    args = argparse.Namespace(name="pixelated-runtime", keys="")
    assert cli.command_secret_sync(args) == 2


# ── Workload registry ───────────────────────────────────


def test_registry_exposes_the_option_targets() -> None:
    assert set(workloads.RUN_TARGETS) == {"embed", "train", "test", "dataset"}
    for name in workloads.RUN_TARGETS:
        workload = workloads.WORKLOADS[name]
        assert workload.module.startswith("infra.modal.apps.")
        assert workload.timeout > 0
        assert workload.description


def test_training_and_testing_targets_use_the_documented_accelerators(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PIXELATED_MODAL_GPU", raising=False)
    monkeypatch.delenv("PIXELATED_MODAL_TRAIN_GPU", raising=False)

    assert workloads.resolve("train").gpu() == "A100"
    assert workloads.resolve("test").gpu() is None
    assert workloads.resolve("dataset").gpu() is None


def test_shared_gpu_override_beats_the_workload_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PIXELATED_MODAL_TRAIN_GPU", raising=False)
    monkeypatch.setenv("PIXELATED_MODAL_GPU", "H100")
    assert workloads.resolve("train").gpu() == "H100"


def test_workload_specific_gpu_override_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIXELATED_MODAL_GPU", "H100")
    monkeypatch.setenv("PIXELATED_MODAL_TRAIN_GPU", "A100:2")
    assert workloads.resolve("train").gpu() == "A100:2"


def test_unknown_workload_error_lists_the_choices() -> None:
    with pytest.raises(KeyError, match="unknown workload 'nope'"):
        workloads.resolve("nope")


def test_only_smoke_and_embed_are_deployable() -> None:
    assert workloads.APPS == ("smoke", "batch_embed")


# ── Canonical rows ──────────────────────────────────────


def test_normalize_row_keeps_chat_messages() -> None:
    row = rows.normalize_row({"messages": [{"role": " user ", "content": " hi "}]})
    assert row == {"messages": [{"role": "user", "content": "hi"}]}


def test_normalize_row_drops_unusable_messages() -> None:
    row = rows.normalize_row({"messages": [{"role": "", "content": "x"}, {"role": "assistant", "content": "ok"}]})
    assert row == {"messages": [{"role": "assistant", "content": "ok"}]}


def test_normalize_row_collapses_text_keys() -> None:
    assert rows.normalize_row({"content": " plain "}) == {"text": "plain"}
    assert rows.normalize_row({"text": "   "}) is None
    assert rows.normalize_row("bare string") is None


def test_parse_jsonl_skips_blanks_and_reports_bad_lines() -> None:
    assert rows.parse_jsonl('\n{"text": "a"}\n\n{"text": "b"}\n') == [{"text": "a"}, {"text": "b"}]

    with pytest.raises(ValueError, match="line 2: invalid JSON"):
        rows.parse_jsonl('{"text": "a"}\nnot json\n')


def test_dedupe_keeps_first_seen_order() -> None:
    assert rows.dedupe([{"text": "a"}, {"text": "b"}, {"text": "a"}]) == [{"text": "a"}, {"text": "b"}]


def test_render_text_handles_chat_and_plain_rows() -> None:
    chat = {
        "messages": [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]
    }
    assert rows.render_text(chat) == "user: hi\nassistant: hello"
    assert rows.render_text({"text": " plain "}) == "plain"


def test_filter_min_chars_drops_short_rows() -> None:
    assert rows.filter_min_chars([{"text": "short"}, {"text": "a much longer row"}], 10) == [
        {"text": "a much longer row"}
    ]


def test_split_rows_is_deterministic_and_keeps_a_train_row() -> None:
    corpus = [{"text": f"row {index}"} for index in range(10)]

    first_train, first_val = rows.split_rows(corpus, val_fraction=0.2, seed=7)
    assert (first_train, first_val) == rows.split_rows(corpus, val_fraction=0.2, seed=7)
    assert len(first_val) == 2
    assert len(first_train) == 8

    assert rows.split_rows(corpus, val_fraction=0.0) == (corpus, [])
    assert rows.split_rows(corpus[:1], val_fraction=0.5) == (corpus[:1], [])


def test_split_rows_rejects_an_impossible_fraction() -> None:
    with pytest.raises(ValueError, match="val_fraction"):
        rows.split_rows([], val_fraction=1.0)


def test_write_jsonl_round_trips(tmp_path: Path) -> None:
    destination = tmp_path / "nested" / "rows.jsonl"

    assert rows.write_jsonl([{"text": "a"}, {"text": "b"}], destination) == 2
    assert rows.read_rows(destination) == [{"text": "a"}, {"text": "b"}]

    with pytest.raises(FileNotFoundError, match="dataset not found"):
        rows.read_rows(tmp_path / "absent.jsonl")


# ── Container paths ─────────────────────────────────────


def test_paths_resolve_relative_inputs_against_the_repo() -> None:
    assert paths.resolve_repo_path("dataset/final_dataset.jsonl") == Path("/root/repo/dataset/final_dataset.jsonl")
    assert paths.resolve_repo_path("/datasets/in.jsonl") == Path("/datasets/in.jsonl")


def test_paths_resolve_relative_outputs_into_the_volume() -> None:
    assert paths.resolve_volume_path("out", "/datasets") == Path("/datasets/out")
    assert paths.resolve_volume_path("/training/runs/x", "/datasets") == Path("/training/runs/x")


# ── Dataset workload ────────────────────────────────────


def test_build_corpus_dedupes_filters_and_splits(tmp_path: Path) -> None:
    source = tmp_path / "input.jsonl"
    source.write_text(
        "\n".join(
            [
                json.dumps({"text": "a long enough row"}),
                json.dumps({"text": "a long enough row"}),
                json.dumps({"text": "tiny"}),
                json.dumps({"messages": [{"role": "user", "content": "hello there"}]}),
            ]
        ),
        encoding="utf-8",
    )

    manifest = dataset.build_corpus([source], tmp_path / "out", val_fraction=0.5, seed=3, min_chars=5)

    assert manifest["rows"] == {"read": 4, "kept": 2, "dropped": 2, "train": 1, "val": 1}
    assert (tmp_path / "out" / "train.jsonl").is_file()
    assert (tmp_path / "out" / "val.jsonl").is_file()
    assert (tmp_path / "out" / "manifest.json").is_file()
    assert manifest["outputs"]["train"]["sha256"]


def test_dataset_paths_default_into_the_repo_and_volume() -> None:
    assert dataset.resolve_input("dataset/final_dataset.jsonl") == Path("/root/repo/dataset/final_dataset.jsonl")
    assert dataset.resolve_output("out") == Path("/datasets/out")
    assert dataset.resolve_output("/tmp/out") == Path("/tmp/out")


# ── Training workload ───────────────────────────────────


def test_output_name_slugs_the_model() -> None:
    assert train.output_name("Qwen/Qwen2.5-0.5B-Instruct") == "runs/qwen2-5-0-5b-instruct"
    assert train.output_name("local-model") == "runs/local-model"


def test_training_texts_renders_and_drops_empty_rows() -> None:
    texts = train.training_texts(
        [
            {"text": "plain"},
            {"text": "   "},
            {"messages": [{"role": "user", "content": "hi"}]},
        ]
    )
    assert texts == ["plain", "user: hi"]


# ── Testing workload ────────────────────────────────────


def test_pytest_command_pins_the_no_cache_flag() -> None:
    assert test_suite.pytest_command(["tests/infra"], ["-x"]) == [
        "-m",
        "pytest",
        "tests/infra",
        "-q",
        "-p",
        "no:cacheprovider",
        "-x",
    ]


def test_tail_keeps_the_last_lines() -> None:
    assert test_suite._tail("\n".join(f"line {index}" for index in range(5)), limit=2) == "line 3\nline 4"


# ── CLI wiring for the workload targets ─────────────────


def test_parser_exposes_every_run_target() -> None:
    parser = cli.build_parser()
    for name in workloads.RUN_TARGETS:
        args = parser.parse_args([name])
        assert args.handler is cli.command_workload
        assert args.workload == name


def test_workload_commands_forward_their_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, ...]] = []
    monkeypatch.setattr(cli, "_run", lambda *args: calls.append(args) or 0)

    assert cli.main(["train", "--dataset", "x", "--epochs", "2"]) == 0
    assert calls == [("run", "-m", "infra.modal.apps.train", "--dataset", "x", "--epochs", "2")]


def test_non_workload_commands_reject_unknown_flags() -> None:
    with pytest.raises(SystemExit) as exit_info:
        cli.main(["status", "--bogus"])
    assert exit_info.value.code == 2


def test_targets_and_apps_commands_report_every_workload(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO):
        assert cli.command_targets(argparse.Namespace()) == 0
        assert cli.command_apps(argparse.Namespace()) == 0

    reported = "\n".join(record.getMessage() for record in caplog.records)
    for workload in workloads.WORKLOADS.values():
        assert workload.module in reported
