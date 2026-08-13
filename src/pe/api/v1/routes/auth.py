"""Authentication and user management API routes.

Implements:
- User registration (institution admin invites users)
- Login (email_hash lookup, bcrypt verify, JWT generation)
- Token refresh with rotation
- User profile management
"""

from __future__ import annotations

import hashlib
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.pe.config import settings
from src.pe.core.dependencies import get_current_user, get_db_session, get_rls_session
from src.pe.core.rbac import UserRole, require_role, role_at_least
from src.pe.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


# ── Schemas ───────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    tenant_id: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserCreateRequest(BaseModel):
    email: str = Field(..., description="User email address")
    display_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.LEARNER


class UserResponse(BaseModel):
    id: str
    email_hash: str
    display_name: str
    role: str
    is_active: bool
    last_login_at: str | None = None


class InstitutionCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    institution_type: str = Field(default="medical_school")
    subscription_tier: str = Field(default="starter")
    max_seats: int = Field(default=10, ge=1, le=10000)


class InstitutionResponse(BaseModel):
    id: str
    name: str
    slug: str
    institution_type: str
    subscription_tier: str
    max_seats: int
    is_active: bool
    created_at: str


class ApiKeyCreateRequest(BaseModel):
    label: str = Field(..., max_length=255)
    role: UserRole = UserRole.MANAGER


class ApiKeyResponse(BaseModel):
    id: str
    key_prefix: str
    label: str | None
    role: str
    full_key: str | None = None  # Only returned on creation
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────


def _hash_email(email: str) -> str:
    """SHA-256 hash of email for lookups (not PHI)."""
    return hashlib.sha256(email.lower().encode("utf-8")).hexdigest()


def _derive_aes_key() -> bytes:
    """Derive a 32-byte AES-256 key from the configured ENCRYPTION_KEY.

    If ENCRYPTION_KEY is a valid 64-char hex string, it is decoded directly.
    Otherwise (e.g. the insecure default in dev), it is SHA-256 hashed to
    produce a deterministic 32-byte key.
    """
    raw = settings.ENCRYPTION_KEY.encode("utf-8")
    if len(raw) == 64 and all(c in b"0123456789abcdefABCDEF" for c in raw):
        return bytes.fromhex(raw.decode())
    return hashlib.sha256(raw).digest()


def _encrypt_email(email: str, _key: str | None = None) -> bytes:
    """Encrypt an email address using AES-256-GCM.

    Returns ``nonce (12 bytes) || ciphertext || tag (16 bytes)``.
    The ``_key`` parameter is retained for backward-compatibility but ignored;
    the encryption key is sourced from ``settings.ENCRYPTION_KEY``.
    """
    aesgcm = AESGCM(_derive_aes_key())
    nonce = secrets.token_bytes(12)
    ct = aesgcm.encrypt(nonce, email.encode("utf-8"), None)
    return nonce + ct


def _decrypt_email(ciphertext: bytes, _key: str | None = None) -> str:
    """Decrypt an email ciphertext produced by :func:`_encrypt_email`.

    Raises ``ValueError`` if the key does not match or the ciphertext is corrupt.
    """
    if len(ciphertext) < 28:  # 12-byte nonce + 16-byte tag minimum
        raise ValueError("ciphertext too short to contain nonce and tag")
    aesgcm = AESGCM(_derive_aes_key())
    nonce, ct = ciphertext[:12], ciphertext[12:]
    return aesgcm.decrypt(nonce, ct, None).decode("utf-8")


# ── Auth Endpoints ────────────────────────────────────────────────


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Authenticate user and return JWT tokens.

    Looks up user by email_hash, verifies password with bcrypt,
    and returns access + refresh tokens.
    """
    email_hash = _hash_email(request.email)

    result = await session.execute(
        text("""
            SELECT id, institution_id, password_hash, display_name, role, is_active
            FROM pe.users WHERE email_hash = :email_hash
        """),
        {"email_hash": email_hash},
    )
    user = result.fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id, tenant_id, password_hash, _display_name, role, is_active = user

    if not is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    if not verify_password(request.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Generate tokens
    access_token = create_access_token(
        user_id=str(user_id),
        tenant_id=str(tenant_id),
        role=role,
        email_hash=email_hash,
    )
    refresh_token = create_refresh_token(
        user_id=str(user_id),
        tenant_id=str(tenant_id),
    )

    # Store refresh token hash
    refresh_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    await session.execute(
        text("UPDATE pe.users SET refresh_token_hash = :hash, last_login_at = NOW() WHERE id = :id"),
        {"hash": refresh_hash, "id": user_id},
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user_id),
        role=role,
        tenant_id=str(tenant_id),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    request: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Refresh an access token using a valid refresh token.

    Implements token rotation: old refresh token is invalidated,
    new access + refresh tokens are issued.
    """
    payload = decode_refresh_token(request.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload["sub"]
    tenant_id = payload["tenant_id"]

    # Verify stored hash matches
    refresh_hash = hashlib.sha256(request.refresh_token.encode()).hexdigest()
    result = await session.execute(
        text("SELECT refresh_token_hash FROM pe.users WHERE id = :id AND is_active = TRUE"),
        {"id": user_id},
    )
    stored_hash = result.scalar()

    if not stored_hash or stored_hash != refresh_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    # Get user role
    result = await session.execute(
        text("SELECT role FROM pe.users WHERE id = :id"),
        {"id": user_id},
    )
    role = result.scalar()
    assert role is not None
    # Issue new tokens (rotation)
    new_access = create_access_token(
        user_id=str(user_id),
        tenant_id=str(tenant_id),
        role=role,
    )
    new_refresh = create_refresh_token(
        user_id=str(user_id),
        tenant_id=str(tenant_id),
    )

    # Rotate: store new refresh hash, invalidate old
    new_refresh_hash = hashlib.sha256(new_refresh.encode()).hexdigest()
    await session.execute(
        text("UPDATE pe.users SET refresh_token_hash = :hash WHERE id = :id"),
        {"hash": new_refresh_hash, "id": user_id},
    )

    return RefreshResponse(
        access_token=new_access,
        refresh_token=new_refresh,
    )


# ── User Management Endpoints ─────────────────────────────────────


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(role_at_least(UserRole.INSTITUTION_ADMIN)),
):
    """Create a new user within the current tenant.

    Institution admins can create users in their own tenant.
    """
    tenant_id = current_user["tenant_id"]
    email_hash = _hash_email(request.email)

    # Check for duplicate email
    result = await session.execute(
        text("SELECT id FROM pe.users WHERE email_hash = :hash"),
        {"hash": email_hash},
    )
    if result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # Create user
    password_hash = hash_password(request.password)
    encrypted_email = _encrypt_email(request.email)

    result = await session.execute(
        text("""
            INSERT INTO pe.users (institution_id, email_ciphertext, email_hash,
                                   display_name, password_hash, role)
            VALUES (:tenant_id, :email_cipher, :email_hash,
                    :display_name, :password_hash, :role)
            RETURNING id, email_hash, display_name, role, is_active, last_login_at
        """),
        {
            "tenant_id": tenant_id,
            "email_cipher": encrypted_email,
            "email_hash": email_hash,
            "display_name": request.display_name,
            "password_hash": password_hash,
            "role": request.role.value,
        },
    )
    user = result.fetchone()
    assert user is not None

    return UserResponse(
        id=str(user[0]),
        email_hash=user[1],
        display_name=user[2],
        role=user[3],
        is_active=user[4],
        last_login_at=str(user[5]) if user[5] else None,
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(role_at_least(UserRole.MANAGER)),
):
    """List all users in the current tenant."""
    tenant_id = current_user["tenant_id"]

    result = await session.execute(
        text("""
            SELECT id, email_hash, display_name, role, is_active, last_login_at
            FROM pe.users
            WHERE institution_id = :tenant_id
            ORDER BY created_at DESC
        """),
        {"tenant_id": tenant_id},
    )
    users = result.fetchall()

    return [
        UserResponse(
            id=str(u[0]),
            email_hash=u[1],
            display_name=u[2],
            role=u[3],
            is_active=u[4],
            last_login_at=str(u[5]) if u[5] else None,
        )
        for u in users
    ]


@router.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(get_current_user),
):
    """Get the current user's profile."""
    user_id = current_user["user_id"]

    result = await session.execute(
        text("""
            SELECT id, email_hash, display_name, role, is_active, last_login_at
            FROM pe.users WHERE id = :id
        """),
        {"id": user_id},
    )
    user = result.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(user[0]),
        email_hash=user[1],
        display_name=user[2],
        role=user[3],
        is_active=user[4],
        last_login_at=str(user[5]) if user[5] else None,
    )


# ── Institution Management (Super Admin only) ─────────────────────


@router.post("/institutions", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
async def create_institution(
    request: InstitutionCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _current_user: dict = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    """Create a new institution/tenant. Super admin only."""
    result = await session.execute(
        text("""
            INSERT INTO pe.institutions (name, slug, institution_type, subscription_tier, max_seats)
            VALUES (:name, :slug, :type, :tier, :seats)
            RETURNING id, name, slug, institution_type, subscription_tier, max_seats, is_active, created_at
        """),
        {
            "name": request.name,
            "slug": request.slug,
            "type": request.institution_type,
            "tier": request.subscription_tier,
            "seats": request.max_seats,
        },
    )
    inst = result.fetchone()
    assert inst is not None

    return InstitutionResponse(
        id=str(inst[0]),
        name=inst[1],
        slug=inst[2],
        institution_type=inst[3],
        subscription_tier=inst[4],
        max_seats=inst[5],
        is_active=inst[6],
        created_at=str(inst[7]),
    )


@router.get("/institutions", response_model=list[InstitutionResponse])
async def list_institutions(
    session: AsyncSession = Depends(get_db_session),
    _current_user: dict = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    """List all institutions. Super admin only."""
    result = await session.execute(
        text("""
            SELECT id, name, slug, institution_type, subscription_tier, max_seats, is_active, created_at
            FROM pe.institutions ORDER BY created_at DESC
        """),
    )
    institutions = result.fetchall()

    return [
        InstitutionResponse(
            id=str(i[0]),
            name=i[1],
            slug=i[2],
            institution_type=i[3],
            subscription_tier=i[4],
            max_seats=i[5],
            is_active=i[6],
            created_at=str(i[7]),
        )
        for i in institutions
    ]


# ── API Key Management ────────────────────────────────────────────


@router.post("/api-keys", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    request: ApiKeyCreateRequest,
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(role_at_least(UserRole.MANAGER)),
):
    """Create an API key for programmatic access."""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["user_id"]

    # Generate key
    raw_key = f"pe_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:8]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    result = await session.execute(
        text("""
            INSERT INTO pe.api_keys (institution_id, key_prefix, key_hash, label, role, created_by)
            VALUES (:tenant_id, :prefix, :hash, :label, :role, :created_by)
            RETURNING id, key_prefix, label, role, created_at
        """),
        {
            "tenant_id": tenant_id,
            "prefix": key_prefix,
            "hash": key_hash,
            "label": request.label,
            "role": request.role.value,
            "created_by": user_id,
        },
    )
    key = result.fetchone()
    assert key is not None

    return ApiKeyResponse(
        id=str(key[0]),
        key_prefix=key[1],
        label=key[2],
        role=key[3],
        full_key=raw_key,  # Only returned once
        created_at=str(key[4]),
    )


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(role_at_least(UserRole.MANAGER)),
):
    """List API keys for the current tenant."""
    tenant_id = current_user["tenant_id"]

    result = await session.execute(
        text("""
            SELECT id, key_prefix, label, role, created_at
            FROM pe.api_keys
            WHERE institution_id = :tenant_id AND is_active = TRUE
            ORDER BY created_at DESC
        """),
        {"tenant_id": tenant_id},
    )
    keys = result.fetchall()

    return [
        ApiKeyResponse(
            id=str(k[0]),
            key_prefix=k[1],
            label=k[2],
            role=k[3],
            created_at=str(k[4]),
        )
        for k in keys
    ]


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(role_at_least(UserRole.INSTITUTION_ADMIN)),
):
    """Revoke an API key (soft delete)."""
    result = await session.execute(
        text("UPDATE pe.api_keys SET is_active = FALSE WHERE id = :id AND institution_id = :tenant"),
        {"id": key_id, "tenant": current_user["tenant_id"]},
    )
    if getattr(result, "rowcount", 0) == 0:
        raise HTTPException(status_code=404, detail="API key not found")
