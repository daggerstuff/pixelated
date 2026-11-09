#!/usr/bin/env python3
"""Tests for bias-detection DatabaseService schema isolation."""

import importlib.util
import sys
import types
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def _load_database_service_module():
    """Load database_service without importing bias_detection.app (heavy deps)."""
    if str(SERVICE_ROOT) not in sys.path:
        sys.path.insert(0, str(SERVICE_ROOT))

    module_names = (
        "bias_detection",
        "bias_detection.services",
        "bias_detection.config",
        "bias_detection.models",
        "bias_detection.services.database_service",
    )
    previous_modules = {name: sys.modules.get(name) for name in module_names}

    def restore_modules() -> None:
        for name, module in previous_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module

    try:
        bias_pkg = types.ModuleType("bias_detection")
        bias_pkg.__path__ = [str(SERVICE_ROOT / "bias_detection")]
        sys.modules["bias_detection"] = bias_pkg

        services_pkg = types.ModuleType("bias_detection.services")
        services_pkg.__path__ = [str(SERVICE_ROOT / "bias_detection" / "services")]
        sys.modules["bias_detection.services"] = services_pkg

        def _exec(relative: str, module_name: str):
            path = SERVICE_ROOT / "bias_detection" / relative
            spec = importlib.util.spec_from_file_location(module_name, path)
            if spec is None or spec.loader is None:
                raise RuntimeError(f"Unable to load {module_name} from {path}")
            mod = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = mod
            spec.loader.exec_module(mod)
            return mod

        _exec("config.py", "bias_detection.config")
        _exec("models.py", "bias_detection.models")
        return _exec("services/database_service.py", "bias_detection.services.database_service")
    finally:
        restore_modules()


_db_module = _load_database_service_module()
DatabaseService = _db_module.DatabaseService
BIAS_DETECTION_SCHEMA = _db_module.BIAS_DETECTION_SCHEMA
T_BIAS_ANALYSES = _db_module.T_BIAS_ANALYSES
_qualified_table = _db_module._qualified_table


class DatabaseServiceSchemaTest(unittest.IsolatedAsyncioTestCase):
    async def test_initialize_schema_targets_isolated_postgres_schema(self):
        """Schema DDL must not touch public.bias_analyses owned by the web app."""
        service = DatabaseService()
        executed_sql: list[str] = []

        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(side_effect=executed_sql.append)

        @asynccontextmanager
        async def acquire():
            yield mock_conn

        mock_pool = MagicMock()
        mock_pool.acquire = acquire
        service.pg_pool = mock_pool

        await service._initialize_schema()

        assert len(executed_sql) == 1
        schema_sql = executed_sql[0]

        assert f"CREATE SCHEMA IF NOT EXISTS {BIAS_DETECTION_SCHEMA}" in schema_sql
        assert f"CREATE TABLE IF NOT EXISTS {T_BIAS_ANALYSES}" in schema_sql
        assert f"CREATE INDEX IF NOT EXISTS idx_bd_request_id ON {T_BIAS_ANALYSES}" in schema_sql
        assert "CREATE TABLE IF NOT EXISTS bias_analyses" not in schema_sql
        assert "ON bias_analyses (request_id)" not in schema_sql

    def test_qualified_table_prefixes_schema(self):
        assert _qualified_table("bias_analyses") == "bias_detection.bias_analyses"


if __name__ == "__main__":
    unittest.main()
