"""
Cove Legal Tech - Security Middleware
Enterprise-grade security headers and request validation
"""

import uuid
import re
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Callable

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add comprehensive security headers to all responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # XSS protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "accelerometer=(), gyroscope=(), magnetometer=(), "
            "payment=(), usb=(), vr=()"
        )

        # Content Security Policy
        nonce = str(uuid.uuid4())
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'nonce-{nonce}'; "
            "style-src 'self' 'nonce-{nonce}' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob:; "
            "connect-src 'self' https://api.cove.zm wss://api.cove.zm; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "upgrade-insecure-requests;"
        ).format(nonce=nonce)

        # HSTS (only in production with HTTPS)
        if settings.ENVIRONMENT == "production":
            hsts_value = f"max-age={settings.HSTS_MAX_AGE}"
            if settings.HSTS_INCLUDE_SUBDOMAINS:
                hsts_value += "; includeSubDomains"
            if settings.HSTS_PRELOAD:
                hsts_value += "; preload"
            response.headers["Strict-Transport-Security"] = hsts_value

        # Request ID for tracing
        request_id = str(uuid.uuid4())
        response.headers["X-Request-ID"] = request_id

        # Remove server fingerprinting headers
        response.headers.pop("Server", None)
        response.headers.pop("X-Powered-By", None)

        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Limit request body sizes to prevent DoS."""

    def __init__(self, app, max_body_size: int = None, max_upload_size: int = None):
        super().__init__(app)
        self.max_body_size = max_body_size or (settings.MAX_BODY_SIZE_MB * 1024 * 1024)
        self.max_upload_size = max_upload_size or (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            size = int(content_length)
            is_upload = any(path in request.url.path for path in ["/vdr/upload", "/documents/upload"])
            max_size = self.max_upload_size if is_upload else self.max_body_size

            if size > max_size:
                raise HTTPException(
                    status_code=413,
                    detail=f"Request body too large. Maximum allowed: {max_size // 1024 // 1024}MB"
                )

        return await call_next(request)


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """Sanitize common attack vectors in request data."""

    # Patterns to detect common injection attempts
    SQL_INJECTION_PATTERNS = [
        r"((SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION).*(FROM|INTO|TABLE|DATABASE))",
        r"(--|#|\/\*|\*\/)",
        r"(OR\s+\d+\s*=\s*\d+)",
        r"(AND\s+\d+\s*=\s*\d+)",
    ]

    XSS_PATTERNS = [
        r"<script[^>]*>[\s\S]*?</script>",
        r"javascript:",
        r"on\w+\s*=",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check query parameters
        for key, values in request.query_params.multi_items():
            if self._contains_threats(values):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid characters detected in request parameters"
                )

        return await call_next(request)

    def _contains_threats(self, value: str) -> bool:
        if not isinstance(value, str):
            return False

        for pattern in self.SQL_INJECTION_PATTERNS + self.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True

        return False


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Log all requests for audit trail."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        import structlog
        logger = structlog.get_logger("audit")

        start_time = __import__("time").time()

        response = await call_next(request)

        duration = __import__("time").time() - start_time

        # Log sensitive endpoints with full detail
        if any(path in request.url.path for path in ["/auth", "/api/v1/wallet", "/api/v1/payments"]):
            logger.info(
                "api_request",
                method=request.method,
                path=str(request.url.path),
                status_code=response.status_code,
                duration_ms=round(duration * 1000, 2),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                request_id=response.headers.get("X-Request-ID"),
            )

        return response
