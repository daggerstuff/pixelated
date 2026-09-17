"""Marker making ``src`` a package for mypy.

pe modules import each other as ``src.pe.*`` (matching the runtime
PYTHONPATH layout), but strict mypy derives module names by walking up
from each target until a missing ``__init__.py``. Without this marker,
apps/web/src was the boundary — targets got names like ``pe.core.*``
while imports said ``src.pe.*``, and with ``ignore_missing_imports`` the
mismatch silently resolved every cross-module import as ``Any``,
vacating most of the strict check (see scripts/ci/python-typecheck.sh).
Inert for the JS toolchain: nothing imports ``src`` at runtime except
the test harness, which already uses this layout.
"""
