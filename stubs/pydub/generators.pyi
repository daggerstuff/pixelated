from collections.abc import Generator

from _typeshed import Incomplete

from .audio_segment import AudioSegment as AudioSegment
from .utils import (
    db_to_float as db_to_float,
    get_array_type as get_array_type,
    get_frame_width as get_frame_width,
    get_min_max_value as get_min_max_value,
)

class SignalGenerator:
    sample_rate: Incomplete
    bit_depth: Incomplete
    def __init__(self, sample_rate: int = 44100, bit_depth: int = 16) -> None: ...
    def to_audio_segment(self, duration: float = 1000.0, volume: float = 0.0): ...
    def generate(self) -> None: ...

class Sine(SignalGenerator):
    freq: Incomplete
    def __init__(self, freq, **kwargs) -> None: ...
    def generate(self) -> Generator[Incomplete]: ...

class Pulse(SignalGenerator):
    freq: Incomplete
    duty_cycle: Incomplete
    def __init__(self, freq, duty_cycle: float = 0.5, **kwargs) -> None: ...
    def generate(self) -> Generator[Incomplete]: ...

class Square(Pulse):
    def __init__(self, freq, **kwargs) -> None: ...

class Sawtooth(SignalGenerator):
    freq: Incomplete
    duty_cycle: Incomplete
    def __init__(self, freq, duty_cycle: float = 1.0, **kwargs) -> None: ...
    def generate(self) -> Generator[Incomplete]: ...

class Triangle(Sawtooth):
    def __init__(self, freq, **kwargs) -> None: ...

class WhiteNoise(SignalGenerator):
    def generate(self) -> Generator[Incomplete]: ...
