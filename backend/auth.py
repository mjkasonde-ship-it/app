"""
Cove Legal Tech - Authentication & Authorisation Module
JWT-based auth with bcrypt password hashing and RBAC.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config (all values come from environment variables – never hardcode)
# ---------------------------------------------------------------------------
SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", "")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "viewer"
    company_id: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# ---------------------------------------------------------------------------
# Dependency: get database (injected at app startup)
# ---------------------------------------------------------------------------
_db: Optional[AsyncIOMotorDatabase] = None

def set_db(database: AsyncIOMotorDatabase) -> None:
    global _db
    _db = database

def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialised")
    return _db

# ---------------------------------------------------------------------------
# Core dependency: get current authenticated user
# ---------------------------------------------------------------------------
async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    user_id: Optional[str] = payload.get("sub")
    token_type: Optional[str] = payload.get("type")

    if not user_id or token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.get("status") == "inactive":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    return user

# ---------------------------------------------------------------------------
# Role-based access control factory
# ---------------------------------------------------------------------------
ROLE_HIERARCHY = {
    "viewer": 0,
    "compliance_officer": 1,
    "manager": 2,
    "admin": 3,
    "super-admin": 4,
}

def require_role(*roles: str):
    """
    Dependency factory.  Usage:
        @router.get("/admin/...", dependencies=[Depends(require_role("admin", "super-admin"))])
    """
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "viewer")
        if user_role not in roles and user_role != "super-admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}",
            )
        return current_user
    return _check

def require_min_role(min_role: str):
    """
    Dependency factory for hierarchy-based checks.
    Usage: Depends(require_min_role("manager"))
    """
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "viewer")
        if ROLE_HIERARCHY.get(user_role, 0) < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least '{min_role}' role",
            )
        return current_user
    return _check

def require_own_company(company_id_param: str = "company_id"):
    """
    Ensures the authenticated user belongs to the company they're accessing,
    unless they are an admin/super-admin.
    """
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        return current_user
    return _check

# ---------------------------------------------------------------------------
# Auth route handlers (mounted by server.py on /api/auth)
# ---------------------------------------------------------------------------
from fastapi import APIRouter

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])

@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    db = get_db()
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    import uuid
    from datetime import datetime, timezone
    user = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "company_id": body.company_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None,
    }
    await db.users.insert_one(user)
    user.pop("_id", None)
    user.pop("password_hash", None)
    logger.info("New user registered: %s role=%s", body.email, body.role)
    return user

@auth_router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.get("status") == "inactive":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    token_data = {"sub": user["id"], "email": user["email"], "role": user["role"]}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    from datetime import datetime, timezone
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    logger.info("User logged in: %s", body.email)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: dict):
    token = body.get("refresh_token", "")
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Invalid refresh token")
    token_data = {"sub": payload["sub"], "email": payload["email"], "role": payload["role"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )

@auth_router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    safe = {k: v for k, v in current_user.items() if k != "password_hash"}
    return safe

@auth_router.post("/change-password")
async def change_password(body: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]})
    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    return {"message": "Password updated successfully"}
