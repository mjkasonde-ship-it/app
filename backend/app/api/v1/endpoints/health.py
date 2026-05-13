"""
Cove Legal Tech - Health Check Endpoints
Deep health probes for Kubernetes, load balancers, and monitoring
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
import structlog

from app.core.config import settings
from app.db.database import db_manager

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check() -> Dict[str, Any]:
    """
    Deep health check including all dependent services.

    Returns 200 if all services healthy, 503 if any degraded.
    Used by load balancers and monitoring systems.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "services": {},
    }

    # Check MongoDB
    try:
        db_health = await db_manager.health_check()
        health_status["services"]["mongodb"] = {
            "status": "healthy" if db_health.get("healthy") else "degraded",
            "details": {
                "version": db_health.get("version"),
                "connections": db_health.get("connections", {}),
            } if db_health.get("healthy") else None,
        }
        if not db_health.get("healthy"):
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["mongodb"] = {
            "status": "unhealthy",
            "error": str(e)[:100],
        }
        health_status["status"] = "degraded"

    # Check LLM API (if configured)
    if settings.EMERGENT_LLM_KEY:
        health_status["services"]["llm"] = {"status": "configured"}
    else:
        health_status["services"]["llm"] = {"status": "not_configured"}

    # Check payment providers (if configured)
    payment_providers = []
    if settings.CGRATE_API_KEY:
        payment_providers.append("cgrate")
    if settings.DPO_COMPANY_TOKEN:
        payment_providers.append("dpo")
    if settings.FLUTTERWAVE_SECRET_KEY:
        payment_providers.append("flutterwave")

    health_status["services"]["payments"] = {
        "status": "configured" if payment_providers else "not_configured",
        "providers": payment_providers,
    }

    # Check S3 (if configured)
    if settings.AWS_ACCESS_KEY_ID:
        health_status["services"]["s3"] = {"status": "configured"}
    else:
        health_status["services"]["s3"] = {"status": "not_configured"}

    # Determine final status
    service_statuses = [s["status"] for s in health_status["services"].values()]
    if any(s == "unhealthy" for s in service_statuses):
        health_status["status"] = "unhealthy"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif any(s == "degraded" for s in service_statuses):
        health_status["status"] = "degraded"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        status_code = status.HTTP_200_OK

    return JSONResponse(content=health_status, status_code=status_code)


@router.get("/ready", tags=["health"])
async def readiness_check() -> Dict[str, Any]:
    """
    Kubernetes-style readiness probe.

    Returns 200 if ready to accept traffic, 503 if not.
    Used by orchestrators to determine pod readiness.
    """
    try:
        # Quick database ping
        await db_manager.client.admin.command("ping")
        return {"ready": True, "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception:
        return JSONResponse(
            content={"ready": False},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@router.get("/live", tags=["health"])
async def liveness_check() -> Dict[str, Any]:
    """
    Kubernetes-style liveness probe.

    Returns 200 if application is alive (not deadlocked).
    Used by orchestrators to restart unresponsive pods.
    """
    return {
        "alive": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pid": __import__("os").getpid(),
    }


@router.get("/metrics", tags=["health"])
async def metrics_check() -> Dict[str, Any]:
    """
    Application metrics for monitoring.

    Returns key operational metrics.
    """
    import psutil
    import platform

    process = psutil.Process()

    metrics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system": {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_total_mb": round(psutil.virtual_memory().total / (1024 * 1024), 2),
            "memory_available_mb": round(psutil.virtual_memory().available / (1024 * 1024), 2),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_usage_percent": psutil.disk_usage("/").percent,
        },
        "process": {
            "pid": process.pid,
            "memory_rss_mb": round(process.memory_info().rss / (1024 * 1024), 2),
            "memory_vms_mb": round(process.memory_info().vms / (1024 * 1024), 2),
            "cpu_percent": process.cpu_percent(interval=0.1),
            "num_threads": process.num_threads(),
            "open_files": len(process.open_files()),
            "connections": len(process.connections()),
        },
    }

    # Add database stats if available
    try:
        db_stats = await db_manager.get_collection_stats()
        metrics["database"] = db_stats
    except Exception:
        metrics["database"] = {"error": "Unable to fetch stats"}

    return metrics
