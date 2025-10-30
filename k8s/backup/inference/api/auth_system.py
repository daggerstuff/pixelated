#!/usr/bin/env python3
"""
Pixelated Empathy AI - API Authentication System
Task 1.1: Implement API Authentication System

Enterprise-grade authentication system with JWT tokens, user management, and role-based access control.
"""

import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List, Any
from enum import Enum
from pydantic import BaseModel, EmailStr, Field
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import json
import os
from pathlib import Path
import sqlite3
import hashlib
import time

logger = logging.getLogger(__name__)

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
REFRESH_TOKEN_EXPIRATION_DAYS = 30

class UserRole(str, Enum):
    """User roles for role-based access control"""
    ADMIN = "admin"
    RESEARCHER = "researcher"
    DEVELOPER = "developer"
    CLINICIAN = "clinician"
    USER = "user"
    READONLY = "readonly"

class Permission(str, Enum):
    """System permissions"""
    READ_DATASETS = "read_datasets"
    WRITE_DATASETS = "write_datasets"
    DELETE_DATASETS = "delete_datasets"
    READ_CONVERSATIONS = "read_conversations"
    WRITE_CONVERSATIONS = "write_conversations"
    DELETE_CONVERSATIONS = "delete_conversations"
    ADMIN_USERS = "admin_users"
    SYSTEM_CONFIG = "system_config"
    EXPORT_DATA = "export_data"
    CLINICAL_ACCESS = "clinical_access"

# Role-based permissions mapping
ROLE_PERMISSIONS = {
    UserRole.ADMIN: [p for p in Permission],  # All permissions
    UserRole.RESEARCHER: [
        Permission.READ_DATASETS,
        Permission.READ_CONVERSATIONS,
        Permission.EXPORT_DATA
    ],
    UserRole.DEVELOPER: [
        Permission.READ_DATASETS,
        Permission.WRITE_DATASETS,
        Permission.READ_CONVERSATIONS,
        Permission.WRITE_CONVERSATIONS,
        Permission.SYSTEM_CONFIG
    ],
    UserRole.CLINICIAN: [
        Permission.READ_DATASETS,
        Permission.READ_CONVERSATIONS,
        Permission.CLINICAL_ACCESS
    ],
    UserRole.USER: [
        Permission.READ_CONVERSATIONS
    ],
    UserRole.READONLY: [
        Permission.READ_DATASETS,
        Permission.READ_CONVERSATIONS
    ]
}

class UserCreate(BaseModel):
    """User creation model"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., max_length=100)
    role: UserRole = UserRole.USER
    organization: Optional[str] = Field(None, max_length=100)

class UserLogin(BaseModel):
    """User login model"""
    username: str
    password: str

class UserResponse(BaseModel):
    """User response model (without sensitive data)"""
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    organization: Optional[str]
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]

class TokenResponse(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

class RefreshTokenRequest(BaseModel):
    """Refresh token request model"""
    refresh_token: str

class User:
    """User data model"""
    def __init__(self, id: int, username: str, email: str, password_hash: str,
                 full_name: str, role: UserRole, organization: Optional[str] = None,
                 is_active: bool = True, created_at: Optional[datetime] = None,
                 last_login: Optional[datetime] = None):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.full_name = full_name
        self.role = role
        self.organization = organization
        self.is_active = is_active
        self.created_at = created_at or datetime.now(timezone.utc)
        self.last_login = last_login

    def to_dict(self) -> Dict[str, Any]:
        """Convert user to dictionary"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role.value,
            "organization": self.organization,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None
        }

    def has_permission(self, permission: Permission) -> bool:
        """Check if user has specific permission"""
        return permission in ROLE_PERMISSIONS.get(self.role, [])

class AuthenticationSystem:
    """Enterprise-grade authentication system"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize authentication system"""
        self.db_path = db_path or str(Path(__file__).parent / "auth.db")
        self.security = HTTPBearer()
        self._init_database()
        self._create_default_admin()
    
    def _init_database(self):
        """Initialize SQLite database for user management"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    organization TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    failed_login_attempts INTEGER DEFAULT 0,
                    locked_until TIMESTAMP
                )
            """)
            
            # Create refresh tokens table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_revoked BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            # Create audit log table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS auth_audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    success BOOLEAN NOT NULL,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.commit()
            conn.close()
            logger.info("Authentication database initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize authentication database: {e}")
            raise
    
    def _create_default_admin(self):
        """Create default admin user if none exists"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if admin user exists
            cursor.execute("SELECT COUNT(*) FROM users WHERE role = ?", (UserRole.ADMIN.value,))
            admin_count = cursor.fetchone()[0]
            
            if admin_count == 0:
                # Create default admin user
                admin_password = os.getenv("ADMIN_PASSWORD", "admin123!")
                password_hash = self._hash_password(admin_password)
                
                cursor.execute("""
                    INSERT INTO users (username, email, password_hash, full_name, role, organization)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    "admin",
                    "admin@pixelated-empathy.ai",
                    password_hash,
                    "System Administrator",
                    UserRole.ADMIN.value,
                    "Pixelated Empathy AI"
                ))
                
                conn.commit()
                logger.info("Default admin user created successfully")
                logger.warning(f"Default admin password: {admin_password}")
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to create default admin user: {e}")
            raise
    
    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    
    def _generate_jwt_token(self, user: User) -> str:
        """Generate JWT access token"""
        payload = {
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
            "permissions": [p.value for p in ROLE_PERMISSIONS.get(user.role, [])],
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
        }
        
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    def _generate_refresh_token(self, user: User) -> str:
        """Generate refresh token"""
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRATION_DAYS)
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                VALUES (?, ?, ?)
            """, (user.id, token_hash, expires_at))
            
            conn.commit()
            conn.close()
            
            return token
            
        except Exception as e:
            logger.error(f"Failed to store refresh token: {e}")
            raise
    
    def _log_auth_event(self, user_id: Optional[int], action: str, success: bool,
                       ip_address: Optional[str] = None, user_agent: Optional[str] = None,
                       details: Optional[str] = None):
        """Log authentication event for audit purposes"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO auth_audit_log (user_id, action, ip_address, user_agent, success, details)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, action, ip_address, user_agent, success, details))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to log auth event: {e}")
    
    def create_user(self, user_data: UserCreate) -> User:
        """Create new user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if username or email already exists
            cursor.execute("""
                SELECT COUNT(*) FROM users WHERE username = ? OR email = ?
            """, (user_data.username, user_data.email))
            
            if cursor.fetchone()[0] > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username or email already exists"
                )
            
            # Hash password
            password_hash = self._hash_password(user_data.password)
            
            # Insert user
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, full_name, role, organization)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                user_data.username,
                user_data.email,
                password_hash,
                user_data.full_name,
                user_data.role.value,
                user_data.organization
            ))
            
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            # Create user object
            user = User(
                id=user_id,
                username=user_data.username,
                email=user_data.email,
                password_hash=password_hash,
                full_name=user_data.full_name,
                role=user_data.role,
                organization=user_data.organization
            )
            
            self._log_auth_event(user_id, "USER_CREATED", True)
            logger.info(f"User created successfully: {user_data.username}")
            
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
    
    def authenticate_user(self, username: str, password: str,
                         ip_address: Optional[str] = None,
                         user_agent: Optional[str] = None) -> Optional[User]:
        """Authenticate user with username and password"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get user data
            cursor.execute("""
                SELECT id, username, email, password_hash, full_name, role, organization,
                       is_active, created_at, last_login, failed_login_attempts, locked_until
                FROM users WHERE username = ?
            """, (username,))
            
            user_data = cursor.fetchone()
            
            if not user_data:
                self._log_auth_event(None, "LOGIN_FAILED", False, ip_address, user_agent, "User not found")
                return None
            
            user_id, username, email, password_hash, full_name, role, organization, \
            is_active, created_at, last_login, failed_attempts, locked_until = user_data
            
            # Check if account is locked
            if locked_until:
                locked_until_dt = datetime.fromisoformat(locked_until.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) < locked_until_dt:
                    self._log_auth_event(user_id, "LOGIN_FAILED", False, ip_address, user_agent, "Account locked")
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail="Account is temporarily locked due to failed login attempts"
                    )
            
            # Check if account is active
            if not is_active:
                self._log_auth_event(user_id, "LOGIN_FAILED", False, ip_address, user_agent, "Account inactive")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is inactive"
                )
            
            # Verify password
            if not self._verify_password(password, password_hash):
                # Increment failed login attempts
                failed_attempts += 1
                locked_until_new = None
                
                if failed_attempts >= 5:
                    # Lock account for 30 minutes after 5 failed attempts
                    locked_until_new = datetime.now(timezone.utc) + timedelta(minutes=30)
                
                cursor.execute("""
                    UPDATE users SET failed_login_attempts = ?, locked_until = ?
                    WHERE id = ?
                """, (failed_attempts, locked_until_new, user_id))
                
                conn.commit()
                conn.close()
                
                self._log_auth_event(user_id, "LOGIN_FAILED", False, ip_address, user_agent, "Invalid password")
                return None
            
            # Reset failed login attempts and update last login
            cursor.execute("""
                UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = ?
                WHERE id = ?
            """, (datetime.now(timezone.utc), user_id))
            
            conn.commit()
            conn.close()
            
            # Create user object
            user = User(
                id=user_id,
                username=username,
                email=email,
                password_hash=password_hash,
                full_name=full_name,
                role=UserRole(role),
                organization=organization,
                is_active=is_active,
                created_at=datetime.fromisoformat(created_at.replace('Z', '+00:00')),
                last_login=datetime.now(timezone.utc)
            )
            
            self._log_auth_event(user_id, "LOGIN_SUCCESS", True, ip_address, user_agent)
            logger.info(f"User authenticated successfully: {username}")
            
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return None
    
    def login(self, login_data: UserLogin, ip_address: Optional[str] = None,
              user_agent: Optional[str] = None) -> TokenResponse:
        """Login user and return tokens"""
        user = self.authenticate_user(
            login_data.username,
            login_data.password,
            ip_address,
            user_agent
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Generate tokens
        access_token = self._generate_jwt_token(user)
        refresh_token = self._generate_refresh_token(user)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=JWT_EXPIRATION_HOURS * 3600,
            user=UserResponse(**user.to_dict())
        )
    
    def verify_token(self, credentials: HTTPAuthorizationCredentials) -> User:
        """Verify JWT token and return user"""
        try:
            payload = jwt.decode(
                credentials.credentials,
                JWT_SECRET_KEY,
                algorithms=[JWT_ALGORITHM]
            )
            
            user_id = int(payload.get("sub"))
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            # Get user from database
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, username, email, password_hash, full_name, role, organization,
                       is_active, created_at, last_login
                FROM users WHERE id = ? AND is_active = TRUE
            """, (user_id,))
            
            user_data = cursor.fetchone()
            conn.close()
            
            if not user_data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            user_id, username, email, password_hash, full_name, role, organization, \
            is_active, created_at, last_login = user_data
            
            return User(
                id=user_id,
                username=username,
                email=email,
                password_hash=password_hash,
                full_name=full_name,
                role=UserRole(role),
                organization=organization,
                is_active=is_active,
                created_at=datetime.fromisoformat(created_at.replace('Z', '+00:00')),
                last_login=datetime.fromisoformat(last_login.replace('Z', '+00:00')) if last_login else None
            )
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed"
            )
    
    def refresh_access_token(self, refresh_request: RefreshTokenRequest) -> TokenResponse:
        """Refresh access token using refresh token"""
        try:
            token_hash = hashlib.sha256(refresh_request.refresh_token.encode()).hexdigest()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Verify refresh token
            cursor.execute("""
                SELECT rt.user_id, rt.expires_at, rt.is_revoked,
                       u.username, u.email, u.password_hash, u.full_name, u.role, u.organization,
                       u.is_active, u.created_at, u.last_login
                FROM refresh_tokens rt
                JOIN users u ON rt.user_id = u.id
                WHERE rt.token_hash = ? AND rt.is_revoked = FALSE
            """, (token_hash,))
            
            result = cursor.fetchone()
            
            if not result:
                conn.close()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            user_id, expires_at, is_revoked, username, email, password_hash, \
            full_name, role, organization, is_active, created_at, last_login = result
            
            # Check if token is expired
            expires_at_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expires_at_dt:
                conn.close()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Refresh token has expired"
                )
            
            # Check if user is active
            if not is_active:
                conn.close()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is inactive"
                )
            
            # Revoke old refresh token
            cursor.execute("""
                UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = ?
            """, (token_hash,))
            
            conn.commit()
            conn.close()
            
            # Create user object
            user = User(
                id=user_id,
                username=username,
                email=email,
                password_hash=password_hash,
                full_name=full_name,
                role=UserRole(role),
                organization=organization,
                is_active=is_active,
                created_at=datetime.fromisoformat(created_at.replace('Z', '+00:00')),
                last_login=datetime.fromisoformat(last_login.replace('Z', '+00:00')) if last_login else None
            )
            
            # Generate new tokens
            access_token = self._generate_jwt_token(user)
            new_refresh_token = self._generate_refresh_token(user)
            
            self._log_auth_event(user_id, "TOKEN_REFRESHED", True)
            
            return TokenResponse(
                access_token=access_token,
                refresh_token=new_refresh_token,
                expires_in=JWT_EXPIRATION_HOURS * 3600,
                user=UserResponse(**user.to_dict())
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token refresh failed"
            )
    
    def logout(self, refresh_token: str, user_id: int):
        """Logout user by revoking refresh token"""
        try:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE refresh_tokens SET is_revoked = TRUE 
                WHERE token_hash = ? AND user_id = ?
            """, (token_hash, user_id))
            
            conn.commit()
            conn.close()
            
            self._log_auth_event(user_id, "LOGOUT", True)
            logger.info(f"User logged out successfully: {user_id}")
            
        except Exception as e:
            logger.error(f"Logout failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Logout failed"
            )
    
    def require_permission(self, permission: Permission):
        """Dependency to require specific permission"""
        def permission_checker(user: User = Depends(self.get_current_user)) -> User:
            if not user.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission required: {permission.value}"
                )
            return user
        return permission_checker
    
    def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())) -> User:
        """Get current authenticated user"""
        return self.verify_token(credentials)

# Global authentication system instance
auth_system = AuthenticationSystem()

# Convenience functions for FastAPI dependencies
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())) -> User:
    """Get current authenticated user (FastAPI dependency)"""
    return auth_system.get_current_user(credentials)

def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require admin role (FastAPI dependency)"""
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user

def require_permission(permission: Permission):
    """Require specific permission (FastAPI dependency factory)"""
    return auth_system.require_permission(permission)

if __name__ == "__main__":
    # Test the authentication system
    auth = AuthenticationSystem()
    print("Authentication system initialized successfully")
    print(f"Database path: {auth.db_path}")
    print("Default admin user created (if not exists)")
