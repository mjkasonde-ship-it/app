"""
Wallet module integration tests.

Runs against a real (in-process) MongoDB via mongomock-motor.
No network calls; payment aggregator is mocked.

Run with:
    pytest backend/tests/test_wallet.py -v
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

# mongomock-motor provides an async-compatible in-memory MongoDB client
from mongomock_motor import AsyncMongoMockClient

from wallet.models import (
    SubAccountCreate,
    FundRequest,
    PayoutRequest,
    SubscriptionTier,
    TransactionStatus,
    CreatePullOrderRequest,
    ApprovePullOrderRequest,
    RejectPullOrderRequest,
)
from wallet.repository import WalletRepositories, ensure_wallet_indexes
from wallet import service as wallet_service


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db():
    """In-memory MongoDB database for each test."""
    client = AsyncMongoMockClient()
    database = client["test_cove"]
    await ensure_wallet_indexes(database)
    return database


@pytest_asyncio.fixture
async def repos(db):
    return WalletRepositories(db)


@pytest_asyncio.fixture
async def company_id():
    return "company_test_001"


@pytest_asyncio.fixture
async def sub_account(repos, company_id):
    """Create a basic sub-account for tests that need one."""
    data = SubAccountCreate(
        company_id=company_id,
        company_name="Test Company Ltd",
        subscription_tier=SubscriptionTier.BASIC,
        currency="ZMW",
    )
    return await wallet_service.create_sub_account(repos, data)


@pytest_asyncio.fixture
async def premium_sub_account(repos):
    """Create a premium sub-account with balance for payout tests."""
    data = SubAccountCreate(
        company_id="company_premium_001",
        company_name="Premium Co",
        subscription_tier=SubscriptionTier.PREMIUM,
        currency="ZMW",
    )
    sa = await wallet_service.create_sub_account(repos, data)
    # Seed the available balance directly for testing
    sa.available_balance = 10000.00
    sa.kyc_verified = True
    sa.aml_cleared = True
    return await repos.sub_accounts.update(sa)


# ---------------------------------------------------------------------------
# Sub-account tests
# ---------------------------------------------------------------------------

class TestSubAccount:
    @pytest.mark.asyncio
    async def test_create_sub_account(self, repos, company_id):
        data = SubAccountCreate(
            company_id=company_id,
            company_name="Acme Ltd",
            subscription_tier=SubscriptionTier.BASIC,
            currency="ZMW",
        )
        sa = await wallet_service.create_sub_account(repos, data)
        assert sa.company_id == company_id
        assert sa.available_balance == 0.0
        assert sa.subscription_tier == SubscriptionTier.BASIC

    @pytest.mark.asyncio
    async def test_duplicate_sub_account_raises(self, repos, sub_account):
        with pytest.raises(ValueError, match="already exists"):
            data = SubAccountCreate(
                company_id=sub_account.company_id,
                company_name="Dupe",
                subscription_tier=SubscriptionTier.BASIC,
                currency="ZMW",
            )
            await wallet_service.create_sub_account(repos, data)

    @pytest.mark.asyncio
    async def test_get_sub_account_by_company(self, repos, sub_account):
        fetched = await repos.sub_accounts.get_by_company_id(sub_account.company_id)
        assert fetched is not None
        assert fetched.id == sub_account.id

    @pytest.mark.asyncio
    async def test_upgrade_tier(self, repos, sub_account):
        upgraded = await wallet_service.upgrade_tier(
            repos, sub_account.company_id, SubscriptionTier.PREMIUM
        )
        assert upgraded.subscription_tier == SubscriptionTier.PREMIUM
        # Premium tier has higher limits
        assert upgraded.daily_payout_limit > sub_account.daily_payout_limit

    @pytest.mark.asyncio
    async def test_get_balance(self, repos, sub_account):
        balance = await wallet_service.get_balance(repos, sub_account.company_id)
        assert balance.available_balance == 0.0
        assert balance.currency == "ZMW"


# ---------------------------------------------------------------------------
# Repository atomic update tests
# ---------------------------------------------------------------------------

class TestRepositoryAtomicUpdates:
    @pytest.mark.asyncio
    async def test_balance_delta_update(self, repos, sub_account):
        """Atomic $inc updates should not lose concurrent writes."""
        updated = await repos.sub_accounts.update_balances(
            sub_account.id,
            available_delta=500.00,
            total_delta=500.00,
        )
        assert updated is not None
        assert updated.available_balance == 500.00

    @pytest.mark.asyncio
    async def test_balance_debit_update(self, repos, sub_account):
        # Fund first
        await repos.sub_accounts.update_balances(sub_account.id, available_delta=1000.0, total_delta=1000.0)
        # Then debit
        updated = await repos.sub_accounts.update_balances(sub_account.id, available_delta=-300.0)
        assert updated.available_balance == 700.0


# ---------------------------------------------------------------------------
# Transaction repository tests
# ---------------------------------------------------------------------------

class TestTransactionRepository:
    @pytest.mark.asyncio
    async def test_create_and_fetch_transaction(self, repos, sub_account):
        from wallet.models import WalletTransaction, TransactionType
        txn = WalletTransaction(
            company_id=sub_account.company_id,
            sub_account_id=sub_account.id,
            type=TransactionType.FUND,
            amount=1000.0,
            fee=20.0,
            net_amount=980.0,
            currency="ZMW",
            description="Test fund",
            status=TransactionStatus.PENDING,
        )
        created = await repos.transactions.create(txn)
        fetched = await repos.transactions.get_by_id(created.id)
        assert fetched is not None
        assert fetched.amount == 1000.0

    @pytest.mark.asyncio
    async def test_list_transactions_by_company(self, repos, sub_account):
        from wallet.models import WalletTransaction, TransactionType
        for i in range(3):
            txn = WalletTransaction(
                company_id=sub_account.company_id,
                sub_account_id=sub_account.id,
                type=TransactionType.FUND,
                amount=float(100 * (i + 1)),
                fee=2.0,
                net_amount=float(100 * (i + 1)) - 2.0,
                currency="ZMW",
                description=f"Fund {i}",
                status=TransactionStatus.COMPLETED,
            )
            await repos.transactions.create(txn)

        txns = await repos.transactions.list_by_company(sub_account.company_id)
        assert len(txns) == 3


# ---------------------------------------------------------------------------
# Idempotency tests
# ---------------------------------------------------------------------------

class TestIdempotency:
    @pytest.mark.asyncio
    async def test_save_and_retrieve(self, repos):
        await repos.idempotency.save("key123", {"result": "ok", "amount": 500})
        cached = await repos.idempotency.get("key123")
        assert cached is not None
        assert cached["amount"] == 500

    @pytest.mark.asyncio
    async def test_missing_key_returns_none(self, repos):
        result = await repos.idempotency.get("nonexistent_key")
        assert result is None


# ---------------------------------------------------------------------------
# Pull order tests
# ---------------------------------------------------------------------------

class TestPullOrders:
    @pytest.mark.asyncio
    async def test_create_pull_order(self, repos, sub_account):
        request = CreatePullOrderRequest(
            client_name="Jane Doe",
            client_email="jane@example.com",
            client_phone="+260977123456",
            amount=500.0,
            currency="ZMW",
            description="Monthly premium collection",
            expiry_hours=48,
        )
        order = await wallet_service.create_pull_order(
            repos, sub_account.company_id, request, "https://api.example.com"
        )
        assert order.company_id == sub_account.company_id
        assert order.amount == 500.0
        assert order.approval_token is not None
        assert order.approval_url is not None

    @pytest.mark.asyncio
    async def test_approve_pull_order(self, repos, sub_account):
        # Create
        create_req = CreatePullOrderRequest(
            client_name="Bob Smith",
            client_email="bob@example.com",
            client_phone="+260977000001",
            amount=200.0,
            currency="ZMW",
            description="Policy payment",
            expiry_hours=24,
        )
        order = await wallet_service.create_pull_order(
            repos, sub_account.company_id, create_req, "https://api.example.com"
        )
        # Approve
        approve_req = ApprovePullOrderRequest(
            approval_token=order.approval_token,
            client_name="Bob Smith",
            client_email="bob@example.com",
        )
        approved = await wallet_service.approve_pull_order(
            repos, approve_req, "127.0.0.1", "pytest/1.0"
        )
        assert approved.status.value == "approved"

        # Audit trail should have one entry
        audit = await repos.pull_orders.list_audit(order.id)
        assert len(audit) == 1
        assert audit[0].action == "approve"

    @pytest.mark.asyncio
    async def test_reject_pull_order(self, repos, sub_account):
        create_req = CreatePullOrderRequest(
            client_name="Alice",
            client_email="alice@example.com",
            client_phone="+260977000002",
            amount=300.0,
            currency="ZMW",
            description="Claim settlement",
            expiry_hours=24,
        )
        order = await wallet_service.create_pull_order(
            repos, sub_account.company_id, create_req, "https://api.example.com"
        )
        reject_req = RejectPullOrderRequest(
            approval_token=order.approval_token,
            client_name="Alice",
            client_email="alice@example.com",
            reason="Amount incorrect",
        )
        rejected = await wallet_service.reject_pull_order(
            repos, reject_req, "127.0.0.1", "pytest/1.0"
        )
        assert rejected.status.value == "rejected"
        assert rejected.rejection_reason == "Amount incorrect"


# ---------------------------------------------------------------------------
# Payout service tests (mocked aggregator)
# ---------------------------------------------------------------------------

class TestPayoutService:
    @pytest.mark.asyncio
    async def test_payout_basic_tier_rejected(self, repos, sub_account):
        """Basic tier sub-accounts cannot initiate payouts."""
        from fastapi import HTTPException
        request = PayoutRequest(
            amount=100.0,
            currency="ZMW",
            bank_code="ZNB",
            account_number="1234567890",
            account_name="Test Payee",
        )
        mock_aggregator = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await wallet_service.initiate_payout(repos, sub_account.company_id, request, mock_aggregator)
        assert exc_info.value.status_code == 403
        assert "Premium" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_payout_insufficient_balance(self, repos, premium_sub_account):
        """Premium tier but no balance should be rejected."""
        from fastapi import HTTPException
        # Zero out balance
        premium_sub_account.available_balance = 0.0
        await repos.sub_accounts.update(premium_sub_account)

        request = PayoutRequest(
            amount=5000.0,
            currency="ZMW",
            bank_code="ZNB",
            account_number="1234567890",
            account_name="Test Payee",
        )
        mock_aggregator = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await wallet_service.initiate_payout(
                repos, premium_sub_account.company_id, request, mock_aggregator
            )
        assert exc_info.value.status_code == 400
        assert "Insufficient" in exc_info.value.detail
