"""Role-Based Access Control dependencies.

Implements the RBAC hierarchy from ADR-001:

    super_admin > institution_admin > manager > educator > learner
"""

from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum

from fastapi import HTTPException, status


class UserRole(StrEnum):
    """Enumerated user roles with hierarchy level."""

    SUPER_ADMIN = "super_admin"
    INSTITUTION_ADMIN = "institution_admin"
    MANAGER = "manager"
    EDUCATOR = "educator"
    LEARNER = "learner"

    @property
    def level(self) -> int:
        return _ROLE_LEVELS[self]


# Hierarchy: higher number = more privileges
_ROLE_LEVELS: dict[UserRole, int] = {
    UserRole.LEARNER: 0,
    UserRole.EDUCATOR: 10,
    UserRole.MANAGER: 20,
    UserRole.INSTITUTION_ADMIN: 30,
    UserRole.SUPER_ADMIN: 99,
}


def role_at_least(minimum_role: UserRole) -> Callable:
    """Dependency factory: require a minimum role level.

    Usage:
        @router.get("/admin")
        async def admin_endpoint(user: dict = Depends(role_at_least(UserRole.INSTITUTION_ADMIN))):
            ...
    """

    async def _role_checker(current_user: dict) -> dict:
        user_role = UserRole(current_user.get("role", "learner"))
        if user_role.level < minimum_role.level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role at least '{minimum_role.value}', got '{user_role.value}'",
            )
        return current_user

    return _role_checker


def require_role(*roles: UserRole) -> Callable:
    """Dependency factory: require one of the specified roles exactly.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            user: dict = Depends(require_role(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN))
        ):
            ...
    """
    allowed_roles = set(roles)

    async def _role_checker(current_user: dict) -> dict:
        user_role = UserRole(current_user.get("role", "learner"))
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {[r.value for r in roles]}, got '{user_role}'",
            )
        return current_user

    return _role_checker


def same_tenant_or_super_admin(target_tenant_id: str) -> Callable:
    """Dependency factory: ensure user belongs to the target tenant (or is super_admin).

    Usage:
        @router.get("/institutions/{institution_id}")
        async def get_institution(
            institution_id: str,
            user: dict = Depends(same_tenant_or_super_admin(institution_id)),
        ):
            ...
    """

    async def _tenant_checker(current_user: dict) -> dict:
        user_role = current_user.get("role", "learner")
        user_tenant = current_user.get("tenant_id")
        if user_role != "super_admin" and user_tenant != target_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-tenant access denied",
            )
        return current_user

    return _tenant_checker
