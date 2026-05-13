"""
Cove Legal Tech - Production Configuration
Enterprise-grade settings for Zambia deployment
"""

import os
import secrets
from pathlib import Path
from typing import List, Optional
from pydantic import BaseSettings, validator, Field


class Settings(BaseSettings):
    """Application settings with validation and security defaults."""

    # ── Environment ──────────────────────────────────────────────────────────
    ENVIRONMENT: str = Field(default="production", regex="^(development|staging|production)$")
    DEBUG: bool = Field(default=False)

    @validator("DEBUG", pre=True, always=True)
    def validate_debug(cls, v, values):
        return values.get("ENVIRONMENT") == "development"

    # ── Database ─────────────────────────────────────────────────────────────
    MONGO_URL: str = Field(..., min_length=10)
    DB_NAME: str = Field(default="cove_db")
    MONGO_MAX_POOL_SIZE: int = Field(default=50, ge=10, le=200)
    MONGO_MIN_POOL_SIZE: int = Field(default=10, ge=1, le=50)
    MONGO_MAX_IDLE_TIME_MS: int = Field(default=60000, ge=1000)
    MONGO_SERVER_SELECTION_TIMEOUT_MS: int = Field(default=5000, ge=1000)

    # ── Authentication ───────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, ge=5, le=1440)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30, ge=1, le=90)

    @validator("JWT_SECRET_KEY")
    def validate_jwt_secret(cls, v):
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        if v in ["changeme", "secret", "password", "admin"]:
            raise ValueError("JWT_SECRET_KEY cannot be a common weak value")
        return v

    # ── CORS ────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = Field(default=["https://app.cove.zm"])

    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @validator("CORS_ORIGINS")
    def validate_cors_no_wildcard_in_prod(cls, v, values):
        if values.get("ENVIRONMENT") == "production" and "*" in v:
            raise ValueError("CORS_ORIGINS cannot contain wildcard in production")
        return v

    # ── Trusted Hosts ──────────────────────────────────────────────────────
    TRUSTED_HOSTS: List[str] = Field(default=["app.cove.zm", "staging.cove.zm"])

    @validator("TRUSTED_HOSTS", pre=True)
    def parse_trusted_hosts(cls, v):
        if isinstance(v, str):
            return [h.strip() for h in v.split(",") if h.strip()]
        return v

    # ── Rate Limiting ──────────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT: str = Field(default="100/minute")
    RATE_LIMIT_AUTH: str = Field(default="20/minute")
    RATE_LIMIT_UPLOAD: str = Field(default="10/minute")

    # ── Request Limits ─────────────────────────────────────────────────────
    MAX_BODY_SIZE_MB: int = Field(default=10, ge=1, le=100)
    MAX_UPLOAD_SIZE_MB: int = Field(default=50, ge=1, le=500)

    # ── AI / LLM ───────────────────────────────────────────────────────────
    EMERGENT_LLM_KEY: Optional[str] = Field(default=None)
    LLM_TIMEOUT_SECONDS: int = Field(default=30, ge=5, le=120)
    LLM_MAX_RETRIES: int = Field(default=3, ge=1, le=5)

    # ── External Services ──────────────────────────────────────────────────
    CGRATE_BASE_URL: Optional[str] = Field(default=None)
    CGRATE_API_KEY: Optional[str] = Field(default=None)
    CGRATE_SECRET: Optional[str] = Field(default=None)

    DPO_BASE_URL: Optional[str] = Field(default=None)
    DPO_COMPANY_TOKEN: Optional[str] = Field(default=None)

    FLUTTERWAVE_SECRET_KEY: Optional[str] = Field(default=None)
    FLUTTERWAVE_PUBLIC_KEY: Optional[str] = Field(default=None)

    # ── AWS S3 ───────────────────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None)
    AWS_REGION: str = Field(default="af-south-1")
    S3_BUCKET_NAME: str = Field(default="cove-vdr-documents")
    S3_PRESIGNED_URL_EXPIRY: int = Field(default=3600, ge=300, le=86400)

    # ── Sentry ─────────────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = Field(default=None)
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1, ge=0.0, le=1.0)
    SENTRY_ENVIRONMENT: str = Field(default="production")

    # ── Logging ────────────────────────────────────────────────────────────
    LOG_LEVEL: str = Field(default="INFO", regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    LOG_FORMAT: str = Field(default="json", regex="^(json|console)$")

    # ── Security ───────────────────────────────────────────────────────────
    SECURE_HEADERS_ENABLED: bool = Field(default=True)
    HSTS_MAX_AGE: int = Field(default=31536000, ge=0)
    HSTS_INCLUDE_SUBDOMAINS: bool = Field(default=True)
    HSTS_PRELOAD: bool = Field(default=True)

    # ── Zambia-Specific ──────────────────────────────────────────────────
    OFFLINE_MODE_ENABLED: bool = Field(default=False)
    LOW_BANDWIDTH_OPTIMIZATION: bool = Field(default=True)
    DEFAULT_CURRENCY: str = Field(default="ZMW")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()


def generate_secure_secret(length: int = 32) -> str:
    """Generate a cryptographically secure secret."""
    return secrets.token_hex(length)


def get_cors_origins() -> List[str]:
    """Get validated CORS origins."""
    return settings.CORS_ORIGINS


def get_trusted_hosts() -> List[str]:
    """Get validated trusted hosts."""
    return settings.TRUSTED_HOSTS
