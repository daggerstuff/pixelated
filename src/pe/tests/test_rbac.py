"""Tests for RBAC module."""

import asyncio

import pytest
from fastapi import HTTPException

from src.pe.core.rbac import UserRole, require_role, role_at_least, same_tenant_or_super_admin


class TestRBAC:
    """Verify role hierarchy and enforcement."""

    def test_role_levels(self) -> None:
        """Higher roles should have higher level values."""
        assert UserRole.LEARNER.level < UserRole.EDUCATOR.level
        assert UserRole.EDUCATOR.level < UserRole.MANAGER.level
        assert UserRole.MANAGER.level < UserRole.INSTITUTION_ADMIN.level
        assert UserRole.INSTITUTION_ADMIN.level < UserRole.SUPER_ADMIN.level

    def test_role_at_least_passes(self) -> None:
        """Should pass when role meets minimum."""
        checker = role_at_least(UserRole.EDUCATOR)
        result = asyncio.run(checker({"role": "manager", "tenant_id": "t1", "user_id": "u1"}))
        assert result["role"] == "manager"

    def test_role_at_least_fails(self) -> None:
        """Should raise when role below minimum."""
        checker = role_at_least(UserRole.INSTITUTION_ADMIN)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(checker({"role": "learner", "tenant_id": "t1", "user_id": "u1"}))
        assert exc.value.status_code == 403

    def test_require_role_passes(self) -> None:
        """Should pass when role is in allowed set."""
        checker = require_role(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
        result = asyncio.run(checker({"role": "institution_admin", "tenant_id": "t1", "user_id": "u1"}))
        assert result["role"] == "institution_admin"

    def test_require_role_fails(self) -> None:
        """Should raise when role not in allowed set."""
        checker = require_role(UserRole.SUPER_ADMIN)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(checker({"role": "manager", "tenant_id": "t1", "user_id": "u1"}))
        assert exc.value.status_code == 403

    def test_same_tenant_or_super_admin_passes_for_same_tenant(self) -> None:
        """Should pass when user belongs to the target tenant."""
        checker = same_tenant_or_super_admin("t1")
        result = asyncio.run(checker({"role": "learner", "tenant_id": "t1", "user_id": "u1"}))
        assert result["tenant_id"] == "t1"
