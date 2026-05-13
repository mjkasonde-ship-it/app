"""
Cove Legal Tech - Database Layer
MongoDB with connection pooling, health checks, and Zambia-optimized settings
"""

import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


class DatabaseManager:
    """Manages MongoDB connections with health monitoring."""

    _instance: Optional["DatabaseManager"] = None
    _client: Optional[AsyncIOMotorClient] = None
    _db: Optional[AsyncIOMotorDatabase] = None
    _lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def connect(self) -> None:
        """Initialize database connection with pooling."""
        if self._client is not None:
            return

        async with self._lock:
            if self._client is not None:
                return

            try:
                self._client = AsyncIOMotorClient(
                    settings.MONGO_URL,
                    maxPoolSize=settings.MONGO_MAX_POOL_SIZE,
                    minPoolSize=settings.MONGO_MIN_POOL_SIZE,
                    maxIdleTimeMS=settings.MONGO_MAX_IDLE_TIME_MS,
                    serverSelectionTimeoutMS=settings.MONGO_SERVER_SELECTION_TIMEOUT_MS,
                    heartbeatFrequencyMS=10000,
                    retryWrites=True,
                    w="majority",
                    readPreference="primaryPreferred",
                )

                self._db = self._client[settings.DB_NAME]

                # Verify connection
                await self._client.admin.command("ping")
                logger.info(
                    "mongodb_connected",
                    database=settings.DB_NAME,
                    max_pool_size=settings.MONGO_MAX_POOL_SIZE,
                )

            except (ConnectionFailure, ServerSelectionTimeoutError) as e:
                logger.error("mongodb_connection_failed", error=str(e))
                raise RuntimeError(f"Cannot connect to MongoDB: {e}") from e

    async def disconnect(self) -> None:
        """Gracefully close database connection."""
        if self._client is not None:
            self._client.close()
            self._client = None
            self._db = None
            logger.info("mongodb_disconnected")

    async def health_check(self) -> Dict[str, Any]:
        """Deep health check including connection status."""
        if self._client is None:
            return {"status": "disconnected", "healthy": False}

        try:
            # Check server status
            server_status = await self._client.admin.command("serverStatus")

            # Check connection pool
            pool_stats = server_status.get("connections", {})

            # Check replication status (if applicable)
            repl_status = await self._client.admin.command("replSetGetStatus").get("ok", 0) if "replicaSet" in settings.MONGO_URL else None

            return {
                "status": "healthy",
                "healthy": True,
                "version": server_status.get("version", "unknown"),
                "uptime_seconds": server_status.get("uptime", 0),
                "connections": {
                    "current": pool_stats.get("current", 0),
                    "available": pool_stats.get("available", 0),
                    "total_created": pool_stats.get("totalCreated", 0),
                },
                "replica_set": repl_status is not None,
            }
        except Exception as e:
            logger.error("mongodb_health_check_failed", error=str(e))
            return {"status": f"unhealthy: {str(e)}", "healthy": False}

    @property
    def client(self) -> AsyncIOMotorClient:
        if self._client is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._client

    @property
    def db(self) -> AsyncIOMotorDatabase:
        if self._db is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._db

    async def create_indexes(self) -> None:
        """Create all required indexes for performance and security."""
        db = self.db

        # Companies collection
        await db.companies.create_index("id", unique=True, background=True)
        await db.companies.create_index("name", background=True)
        await db.companies.create_index("industry", background=True)
        await db.companies.create_index("created_at", background=True)

        # Users collection
        await db.users.create_index("id", unique=True, background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index("company_id", background=True)
        await db.users.create_index("role", background=True)

        # Obligations collection
        await db.obligations.create_index("id", unique=True, background=True)
        await db.obligations.create_index("company_id", background=True)
        await db.obligations.create_index("due_date", background=True)
        await db.obligations.create_index("status", background=True)
        await db.obligations.create_index([("company_id", 1), ("status", 1)], background=True)
        await db.obligations.create_index([("company_id", 1), ("due_date", 1)], background=True)

        # Audit logs collection
        await db.audit_logs.create_index("id", unique=True, background=True)
        await db.audit_logs.create_index("entity_id", background=True)
        await db.audit_logs.create_index("entity_type", background=True)
        await db.audit_logs.create_index("timestamp", background=True)
        await db.audit_logs.create_index([("timestamp", -1)], background=True)
        await db.audit_logs.create_index("user_id", background=True)

        # Notifications collection
        await db.activity_notifications.create_index("id", unique=True, background=True)
        await db.activity_notifications.create_index("company_id", background=True)
        await db.activity_notifications.create_index([("created_at", -1)], background=True)
        await db.activity_notifications.create_index("user_id", background=True)

        # VDR documents collection
        await db.vdr_documents.create_index("id", unique=True, background=True)
        await db.vdr_documents.create_index("company_id", background=True)
        await db.vdr_documents.create_index("category", background=True)
        await db.vdr_documents.create_index([("company_id", 1), ("category", 1)], background=True)

        # Wallet transactions collection
        await db.wallet_transactions.create_index("id", unique=True, background=True)
        await db.wallet_transactions.create_index("wallet_id", background=True)
        await db.wallet_transactions.create_index([("wallet_id", 1), ("created_at", -1)], background=True)

        # Regulatory filings collection
        await db.regulatory_filings.create_index("id", unique=True, background=True)
        await db.regulatory_filings.create_index("company_id", background=True)
        await db.regulatory_filings.create_index("status", background=True)
        await db.regulatory_filings.create_index([("company_id", 1), ("due_date", 1)], background=True)

        logger.info("mongodb_indexes_created")

    async def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics for all collections."""
        stats = {}
        db = self.db

        collections = await db.list_collection_names()
        for collection in collections:
            try:
                coll_stats = await db.command("collStats", collection)
                stats[collection] = {
                    "document_count": coll_stats.get("count", 0),
                    "size_mb": round(coll_stats.get("size", 0) / (1024 * 1024), 2),
                    "avg_document_size_kb": round(coll_stats.get("avgObjSize", 0) / 1024, 2),
                    "index_count": len(coll_stats.get("indexSizes", {})),
                }
            except Exception:
                stats[collection] = {"error": "Failed to get stats"}

        return stats


# Global instance
db_manager = DatabaseManager()


async def get_db() -> AsyncIOMotorDatabase:
    """Dependency for FastAPI to get database instance."""
    return db_manager.db
