from __future__ import annotations

import subprocess
from pathlib import Path

from faster_whisper import WhisperModel

FFMPEG_TIMEOUT_S = 1800

_model_cache: dict[str, WhisperModel] = {}


def convert_to_wav(src: Path, dst: Path) -> None:
    cmd = ["ffmpeg", "-nostdin", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", "-vn", str(dst)]
    subprocess.run(cmd, check=True, capture_output=True, timeout=FFMPEG_TIMEOUT_S)


def get_model(name: str) -> WhisperModel:
    if name not in _model_cache:
        _model_cache[name] = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=4)
    return _model_cache[name]


def transcribe(path: Path, model_name: str) -> str:
    """Convert media to 16kHz mono wav and transcribe with faster-whisper."""
    wav_path = path.with_name(path.name + ".16k.wav")
    try:
        convert_to_wav(path, wav_path)
        model = get_model(model_name)
        segments, _info = model.transcribe(str(wav_path))
        return " ".join(segment.text.strip() for segment in segments).strip()
    finally:
        wav_path.unlink(missing_ok=True)
