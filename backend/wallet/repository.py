"""
CoveSmartWallet - Repository Layer
Async MongoDB persistence for all wallet domain objects.

Design principles (banking/insurance grade):
  * Repository pattern – routes never touch the database driver directly
  * Every public method is async – no blocking I/O on the event loop
  * Atomic multi-document writes use MongoDB sessions/transactions
  * TTL index on idempotency_keys – automatic 24-hour expiry
  * All _id fields stored as the domain string id (not ObjectId) for portability
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional, List

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
from pymongo.errors import DuplicateKeyError

from .models import (
    SubAccount,
    WalletTransaction,
    LinkedBankAccount,
    LedgerEntry,
    WebhookConfig,
    PullOrder,
    PullOrderApprovalAudit,
    TransactionStatus,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Collection name constants – single source of truth
# ---------------------------------------------------------------------------
COL_SUB_ACCOUNTS = "wallet_sub_accounts"
COL_TRANSACTIONS = "wallet_transactions"
COL_BANK_ACCOUNTS = "wallet_bank_accounts"
COL_LEDGER = "wallet_ledger"
COL_WEBHOOKS = "wallet_webhooks"
COL_IDEMPOTENCY = "wallet_idempotency_keys"
COL_PULL_ORDERS = "wallet_pull_orders"
COL_PULL_AUDIT = "wallet_pull_order_audit"


# ---------------------------------------------------------------------------
# Index bootstrap – called once from server lifespan
# ---------------------------------------------------------------------------
async def ensure_wallet_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create all wallet collection indexes (idempotent)."""

    # sub_accounts: look up by company_id frequently
    await db[COL_SUB_ACCOUNTS].create_indexes([
        IndexModel([("company_id", ASCENDING)], unique=True),
        IndexModel([("status", ASCENDING)]),
    ])

    # transactions: list by company, filter by status/type, sort by date
    await db[COL_TRANSACTIONS].create_indexes([
        IndexModel([("company_id", ASCENDING), ("created_at", DESCENDING)]),
        IndexModel([("reference", ASCENDING)], unique=True),
        IndexModel([("status", ASCENDING)]),
    ])

    # bank_accounts: look up by sub_account_id or company_id
    await db[COL_BANK_ACCOUNTS].create_indexes([
        IndexModel([("sub_account_id", ASCENDING)]),
        IndexModel([("company_id", ASCENDING)]),
    ])

    # ledger: ordered audit trail per sub-account
    await db[COL_LEDGER].create_indexes([
        IndexModel([("sub_account_id", ASCENDING), ("created_at", DESCENDING)]),
        IndexModel([("transaction_id", ASCENDING)]),
    ])

    # webhooks: look up by company_id
    await db[COL_WEBHOOKS].create_indexes([
        IndexModel([("company_id", ASCENDING)], unique=True),
    ])

    # idempotency_keys: expire automatically after 24 hours via TTL index
    await db[COL_IDEMPOTENCY].create_indexes([
        IndexModel([("key", ASCENDING)], unique=True),
        IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
    ])

    # pull_orders: list by company, filter by status, token lookup
    await db[COL_PULL_ORDERS].create_indexes([
        IndexModel([("company_id", ASCENDING), ("created_at", DESCENDING)]),
        IndexModel([("approval_token", ASCENDING)], unique=True, sparse=True),
        IndexModel([("status", ASCENDING)]),
    ])

    # pull_order_audit: retrieve audit trail by pull_order_id
    await db[COL_PULL_AUDIT].create_indexes([
        IndexModel([("pull_order_id", ASCENDING), ("timestamp", DESCENDING)]),
    ])

    log.info("Wallet MongoDB indexes ensured")


# ---------------------------------------------------------------------------
# SubAccountRepository
# ---------------------------------------------------------------------------
class SubAccountRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COL_SUB_ACCOUNTS]

    async def create(self, sub_account: SubAccount) -> SubAccount:
        doc = sub_account.model_dump()
        doc["_id"] = doc["id"]
        try:
            await self._col.insert_one(doc)
        except DuplicateKeyError:
            raise ValueError(f"Sub-account already exists for company {sub_account.company_id}")
        log.info("sub_account.created id=%s company=%s", sub_account.id, sub_account.company_id)
        return sub_account

    async def get_by_id(self, sub_account_id: str) -> Optional[SubAccount]:
        doc = await self._col.find_one({"_id": sub_account_id})
        return SubAccount(**doc) if doc else None

    async def get_by_company_id(self, company_id: str) -> Optional[SubAccount]:
        doc = await self._col.find_one({"company_id": company_id})
        return SubAccount(**doc) if doc else None

    async def update(self, sub_account: SubAccount) -> SubAccount:
        doc = sub_account.model_dump()
        doc["_id"] = doc["id"]
        result = await self._col.replace_one({"_id": sub_account.id}, doc)
        if result.matched_count == 0:
            raise ValueError(f"Sub-account not found: {sub_account.id}")
        return sub_account

    async def update_balances(
        self,
        sub_account_id: str,
        *,
        available_delta: float = 0.0,
        pending_delta: float = 0.0,
        total_delta: float = 0.0,
        daily_payout_delta: float = 0.0,
        monthly_payout_delta: float = 0.0,
    ) -> Optional[SubAccount]:
        """Atomic balance update using $inc – avoids read-modify-write races."""
        updates: dict = {}
        if available_delta:
            updates["available_balance"] = available_delta
        if pending_delta:
            updates["pending_balance"] = pending_delta
        if total_delta:
            updates["total_balance"] = total_delta
        if daily_payout_delta:
            updates["daily_payout_used"] = daily_payout_delta
        if monthly_payout_delta:
            updates["monthly_payout_used"] = monthly_payout_delta

        update_doc: dict = {"$set": {"updated_at": datetime.utcnow()}}
        if updates:
            update_doc["$inc"] = updates

        doc = await self._col.find_one_and_update(
            {"_id": sub_account_id},
            update_doc,
            return_document=ReturnDocument.AFTER,
        )
        return SubAccount(**doc) if doc else None


# ---------------------------------------------------------------------------
# TransactionRepository
# ---------------------------------------------------------------------------
class TransactionRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COL_TRANSACTIONS]

    async def create(self, txn: WalletTransaction) -> WalletTransaction:
        doc = txn.model_dump()
        doc["_id"] = doc["id"]
        await self._col.insert_one(doc)
        log.info("transaction.created id=%s ref=%s", txn.id, txn.reference)
        return txn

    async def get_by_id(self, txn_id: str) -> Optional[WalletTransaction]:
        doc = await self._col.find_one({"_id": txn_id})
        return WalletTransaction(**doc) if doc else None

    async def get_by_reference(self, reference: str) -> Optional[WalletTransaction]:
        doc = await self._col.find_one({"reference": reference})
        return WalletTransaction(**doc) if doc else None

    async def list_by_company(
        self,
        company_id: str,
        *,
        limit: int = 50,
        skip: int = 0,
        status: Optional[str] = None,
        txn_type: Optional[str] = None,
    ) -> List[WalletTransaction]:
        query: dict = {"company_id": company_id}
        if status:
            query["status"] = status
        if txn_type:
            query["type"] = txn_type
        cursor = self._col.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [WalletTransaction(**d) for d in docs]

    async def update(self, txn: WalletTransaction) -> WalletTransaction:
        doc = txn.model_dump()
        doc["_id"] = doc["id"]
        await self._col.replace_one({"_id": txn.id}, doc)
        return txn

    async def update_status(
        self,
        txn_id: str,
        status: TransactionStatus,
        *,
        provider: Optional[str] = None,
        provider_response: Optional[dict] = None,
        completed_at: Optional[datetime] = None,
    ) -> Optional[WalletTransaction]:
        set_fields: dict = {"status": status.value, "updated_at": datetime.utcnow()}
        if provider:
            set_fields["provider"] = provider
        if provider_response is not None:
            set_fields["provider_response"] = provider_response
        if completed_at:
            set_fields["completed_at"] = completed_at
        doc = await self._col.find_one_and_update(
            {"_id": txn_id},
            {"$set": set_fields},
            return_document=ReturnDocument.AFTER,
        )
        return WalletTransaction(**doc) if doc else None


# ---------------------------------------------------------------------------
# BankAccountRepository
# ---------------------------------------------------------------------------
class BankAccountRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COL_BANK_ACCOUNTS]

    async def create(self, account: LinkedBankAccount) -> LinkedBankAccount:
        doc = account.model_dump()
        doc["_id"] = doc["id"]
        await self._col.insert_one(doc)
        log.info("bank_account.linked id=%s company=%s", account.id, account.company_id)
        return account

    async def get_by_id(self, account_id: str) -> Optional[LinkedBankAccount]:
        doc = await self._col.find_one({"_id": account_id})
        return LinkedBankAccount(**doc) if doc else None

    async def list_by_company(self, company_id: str) -> List[LinkedBankAccount]:
        cursor = self._col.find({"company_id": company_id})
        docs = await cursor.to_list(length=100)
        return [LinkedBankAccount(**d) for d in docs]

    async def update(self, account: LinkedBankAccount) -> LinkedBankAccount:
        doc = account.model_dump()
        doc["_id"] = doc["id"]
        await self._col.replace_one({"_id": account.id}, doc)
        return account


# ---------------------------------------------------------------------------
# LedgerRepository
# ---------------------------------------------------------------------------
class LedgerRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COL_LEDGER]

    async def create(self, entry: LedgerEntry) -> LedgerEntry:
        doc = entry.model_dump()
        doc["_id"] = doc["id"]
        await self._col.insert_one(doc)
        return entry

    async def list_by_sub_account(
        self,
        sub_account_id: str,
        *,
        limit: int = 100,
        skip: int = 0,
    ) -> List[LedgerEntry]:
        cursor = (
            self._col.find({"sub_account_id": sub_account_id})
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [LedgerEntry(**d) for d in docs]


# ---------------------------------------------------------------------------
# WebhookRepository
# ---------------------------------------------------------------------------
class WebhookRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COL_WEBHOOKS]

    async def upsert(self, config: WebhookConfig) -> WebhookConfig:
        doc = config.model_dump()
        doc["_id"] = doc["id"]
        await self._col.replace_one({"company_id": config.company_id}, doc, upsert=True)
        return config

    async def get_by_company(self, company_id: str) -> Optional[WebhookConfig]:
        doc = await self._col.find_one({"company_id": company_id})
        return WebhookConfig(**doc) if doc else None


# ---------------------------------------------------------------------------
# IdempotencyRepository
# ---------------------------------------------------------------------------
class IdempotencyRepository:
    """Persistent idempotency cache with automatic 24-hour TTL expiry."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COL_IDEMPOTENCY]

    async def get(self, key: str) -> Optional[dict]:
        doc = await self._col.find_one({"key": key})
        if not doc:
            return None
        # Belt-and-braces check even though TTL index handles expiry
        if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
            return None
        return doc.get("response")

    async def save(self, key: str, response: dict) -> None:
        expires = datetime.utcnow() + timedelta(hours=24)
        await self._col.update_one(
            {"key": key},
            {"$set": {"key": key, "response": response, "expires_at": expires}},
            upsert=True,
        )


# ---------------------------------------------------------------------------
# PullOrderRepository
# ---------------------------------------------------------------------------
class PullOrderRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COL_PULL_ORDERS]
        self._audit_col = db[COL_PULL_AUDIT]

    async def create(self, order: PullOrder) -> PullOrder:
        doc = order.model_dump()
        doc["_id"] = doc["id"]
        await self._col.insert_one(doc)
        log.info("pull_order.created id=%s company=%s", order.id, order.company_id)
        return order

    async def get_by_id(self, order_id: str) -> Optional[PullOrder]:
        doc = await self._col.find_one({"_id": order_id})
        return PullOrder(**doc) if doc else None

    async def get_by_token(self, token: str) -> Optional[PullOrder]:
        doc = await self._col.find_one({"approval_token": token})
        return PullOrder(**doc) if doc else None

    async def list_by_company(
        self,
        company_id: str,
        *,
        status: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[PullOrder]:
        query: dict = {"company_id": company_id}
        if status:
            query["status"] = status
        cursor = (
            self._col.find(query)
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [PullOrder(**d) for d in docs]

    async def update(self, order: PullOrder) -> PullOrder:
        doc = order.model_dump()
        doc["_id"] = doc["id"]
        await self._col.replace_one({"_id": order.id}, doc)
        return order

    async def add_audit(self, audit: PullOrderApprovalAudit) -> PullOrderApprovalAudit:
        doc = audit.model_dump()
        doc["_id"] = doc["id"]
        await self._audit_col.insert_one(doc)
        return audit

    async def list_audit(self, pull_order_id: str) -> List[PullOrderApprovalAudit]:
        cursor = self._audit_col.find({"pull_order_id": pull_order_id}).sort("timestamp", DESCENDING)
        docs = await cursor.to_list(length=200)
        return [PullOrderApprovalAudit(**d) for d in docs]


# ---------------------------------------------------------------------------
# WalletRepositories – convenience bundle injected via FastAPI Depends
# ---------------------------------------------------------------------------
class WalletRepositories:
    """Single dependency that carries all repository instances for a request."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.sub_accounts = SubAccountRepository(db)
        self.transactions = TransactionRepository(db)
        self.bank_accounts = BankAccountRepository(db)
        self.ledger = LedgerRepository(db)
        self.webhooks = WebhookRepository(db)
        self.idempotency = IdempotencyRepository(db)
        self.pull_orders = PullOrderRepository(db)
