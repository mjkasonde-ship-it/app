"""
Cove Legal Tech - Production Application Entry Point
Enterprise-grade FastAPI with comprehensive security and operational features
"""

import os
import signal
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.db.database import db_manager
from app.middleware.security import (
    SecurityHeadersMiddleware,
    RequestSizeLimitMiddleware,
    InputSanitizationMiddleware,
    AuditLogMiddleware,
)

# Import routers
from app.api.v1.endpoints import (
    auth,
    companies,
    obligations,
    users,
    wallet,
    regfiling,
    vdr,
    ai,
    notifications,
    health,
    analytics,
)

# Configure logging
logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=getattr(__import__("logging"), settings.LOG_LEVEL),
)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        (
            structlog.dev.ConsoleRenderer()
            if settings.LOG_FORMAT == "console"
            else structlog.processors.JSONRenderer()
        ),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(__import__("logging"), settings.LOG_LEVEL)
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger(__name__)


# ============================================================================
# Graceful Shutdown Handler
# ============================================================================
def setup_signal_handlers():
    """Setup handlers for graceful shutdown."""

    def handle_signal(signum, frame):
        sig_name = signal.Signals(signum).name
        logger.info(f"{sig_name} received, initiating graceful shutdown...")
        # The lifespan context manager handles actual cleanup
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    # Ignore SIGPIPE (broken pipe from client disconnect)
    signal.signal(signal.SIGPIPE, signal.SIG_IGN)


# ============================================================================
# Lifespan Manager
# ============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle with proper initialization and cleanup."""

    # ── Startup ────────────────────────────────────────────────────────────
    logger.info(
        "application_starting",
        environment=settings.ENVIRONMENT,
        version="1.0.0",
    )

    try:
        # Connect to database
        await db_manager.connect()

        # Create indexes
        await db_manager.create_indexes()

        # Verify database health
        health = await db_manager.health_check()
        if not health.get("healthy", False):
            raise RuntimeError(f"Database health check failed: {health}")

        logger.info(
            "application_started",
            database_status="healthy",
            indexes_created=True,
        )

    except Exception as e:
        logger.error("application_startup_failed", error=str(e))
        raise

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("application_shutting_down")

    try:
        await db_manager.disconnect()
        logger.info("application_shutdown_complete")
    except Exception as e:
        logger.error("application_shutdown_error", error=str(e))


# ============================================================================
# Application Factory
# ============================================================================
def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""

    setup_signal_handlers()

    app = FastAPI(
        title="Cove Legal Tech API",
        description="Zambian Regulatory Compliance Management Platform",
        version="1.0.0",
        docs_url="/api/docs" if settings.ENVIRONMENT == "development" else None,
        redoc_url="/api/redoc" if settings.ENVIRONMENT == "development" else None,
        openapi_url="/api/openapi.json" if settings.ENVIRONMENT == "development" else None,
        lifespan=lifespan,
    )

    # ── Rate Limiter ─────────────────────────────────────────────────────
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[settings.RATE_LIMIT_DEFAULT],
        storage_uri="memory://",  # Use Redis in production: "redis://localhost:6379"
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Middleware (order matters - first added = first executed) ─────────

    # 1. GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # 2. Trusted Host validation
    if settings.TRUSTED_HOSTS and settings.TRUSTED_HOSTS != ["*"]:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.TRUSTED_HOSTS,
        )

    # 3. CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Request-ID",
            "X-Company-ID",
        ],
        expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
        max_age=600,
    )

    # 4. Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # 5. Request size limits
    app.add_middleware(
        RequestSizeLimitMiddleware,
        max_body_size=settings.MAX_BODY_SIZE_MB * 1024 * 1024,
        max_upload_size=settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    )

    # 6. Input sanitization
    app.add_middleware(InputSanitizationMiddleware)

    # 7. Audit logging
    app.add_middleware(AuditLogMiddleware)

    # ── API Routers ────────────────────────────────────────────────────────
    api_v1 = "/api/v1"

    app.include_router(health.router, prefix=api_v1, tags=["health"])
    app.include_router(auth.router, prefix=api_v1, tags=["authentication"])
    app.include_router(companies.router, prefix=api_v1, tags=["companies"])
    app.include_router(obligations.router, prefix=api_v1, tags=["obligations"])
    app.include_router(users.router, prefix=api_v1, tags=["users"])
    app.include_router(wallet.router, prefix=api_v1, tags=["wallet"])
    app.include_router(regfiling.router, prefix=api_v1, tags=["regulatory-filings"])
    app.include_router(vdr.router, prefix=api_v1, tags=["vdr"])
    app.include_router(ai.router, prefix=api_v1, tags=["ai"])
    app.include_router(notifications.router, prefix=api_v1, tags=["notifications"])
    app.include_router(analytics.router, prefix=api_v1, tags=["analytics"])

    # ── Global Exception Handlers ────────────────────────────────────────

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Handle unhandled exceptions without leaking sensitive information."""
        request_id = request.headers.get("X-Request-ID", "unknown")

        logger.error(
            "unhandled_exception",
            error_type=type(exc).__name__,
            error=str(exc)[:200],
            path=str(request.url.path),
            method=request.method,
            request_id=request_id,
            client_ip=request.client.host if request.client else None,
        )

        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "request_id": request_id,
                "type": "internal_error",
            },
        )

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        """Handle 404s with structured response."""
        return JSONResponse(
            status_code=404,
            content={
                "detail": "Resource not found",
                "path": str(request.url.path),
                "type": "not_found",
            },
        )

    return app


# Create the application instance
app = create_application()
