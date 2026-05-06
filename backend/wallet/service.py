"""
CoveSmartWallet – Service Layer
Business logic lives here; routes stay thin.

Rules:
  * Never import motor / pymongo directly – all DB access via repository.
  * Atomic balance mutations use MongoDB multi-document transactions
    (session passed through from caller where needed).
  * Every public method is async.
  * Domain errors raise ValueError; transport errors raise HTTPException
    inside the router, never here.
"""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import HTTPException

from .models import (
    SubAccount,
    SubAccountCreate,
    WalletTransaction,
    WalletBalance,
    FundRequest,
    PayoutRequest,
    TransferRequest,
    LinkBankRequest,
    LinkedBankAccount,
    LedgerEntry,
    WebhookConfig,
    PullOrder,
    PullOrderApprovalAudit,
    PullOrderStatus,
    TransactionType,
    TransactionStatus,
    BankAccountStatus,
    SubscriptionTier,
    TIER_CONFIG,
    CreatePullOrderRequest,
    ApprovePullOrderRequest,
    RejectPullOrderRequest,
)
from .repository import WalletRepositories
from .adapters import PaymentAggregator

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sub-account service
# ---------------------------------------------------------------------------

async def create_sub_account(repos: WalletRepositories, data: SubAccountCreate) -> SubAccount:
    """Provision a new sub-account for a company."""
    existing = await repos.sub_accounts.get_by_company_id(data.company_id)
    if existing:
        raise ValueError(f"Sub-account already exists for company {data.company_id}")

    tier_config = TIER_CONFIG[data.subscription_tier]
    sub_account = SubAccount(
        company_id=data.company_id,
        company_name=data.company_name,
        subscription_tier=data.subscription_tier,
        currency=data.currency,
        daily_payout_limit=tier_config["daily_payout_limit"],
        monthly_payout_limit=tier_config["monthly_payout_limit"],
    )
    return await repos.sub_accounts.create(sub_account)


async def get_sub_account_or_404(repos: WalletRepositories, company_id: str) -> SubAccount:
    sa = await repos.sub_accounts.get_by_company_id(company_id)
    if not sa:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    return sa


async def upgrade_tier(
    repos: WalletRepositories, company_id: str, tier: SubscriptionTier
) -> SubAccount:
    sub_account = await get_sub_account_or_404(repos, company_id)
    tier_config = TIER_CONFIG[tier]
    sub_account.subscription_tier = tier
    sub_account.daily_payout_limit = tier_config["daily_payout_limit"]
    sub_account.monthly_payout_limit = tier_config["monthly_payout_limit"]
    sub_account.updated_at = datetime.utcnow()
    return await repos.sub_accounts.update(sub_account)


async def get_balance(repos: WalletRepositories, company_id: str) -> WalletBalance:
    sa = await get_sub_account_or_404(repos, company_id)
    tier_config = TIER_CONFIG[sa.subscription_tier]
    return WalletBalance(
        company_id=company_id,
        available_balance=sa.available_balance,
        pending_balance=sa.pending_balance,
        total_balance=sa.total_balance,
        currency=sa.currency,
        subscription_tier=sa.subscription_tier.value,
        daily_payout_remaining=max(0.0, sa.daily_payout_limit - sa.daily_payout_used),
        monthly_payout_remaining=max(0.0, sa.monthly_payout_limit - sa.monthly_payout_used),
        last_updated=sa.updated_at,
    )


# ---------------------------------------------------------------------------
# Funding service
# ---------------------------------------------------------------------------

async def initiate_fund(
    repos: WalletRepositories,
    company_id: str,
    request: FundRequest,
    aggregator: PaymentAggregator,
    base_url: str,
) -> dict:
    """Initiate a deposit via payment aggregator.  Returns PaymentLinkResponse data."""

    # Idempotency check
    if request.idempotency_key:
        cached = await repos.idempotency.get(request.idempotency_key)
        if cached:
            log.info("fund.idempotency_hit key=%s", request.idempotency_key)
            return cached

    sa = await get_sub_account_or_404(repos, company_id)
    tier_config = TIER_CONFIG[sa.subscription_tier]
    fee = round(request.amount * tier_config["fee_percentage"] / 100, 2)
    net_amount = round(request.amount - fee, 2)

    txn = WalletTransaction(
        company_id=company_id,
        sub_account_id=sa.id,
        type=TransactionType.FUND,
        amount=request.amount,
        fee=fee,
        net_amount=net_amount,
        currency=request.currency,
        description=request.description or "Wallet funding",
        customer_email=request.customer_email,
        status=TransactionStatus.PENDING,
    )

    callback_url = request.callback_url or f"{base_url}/wallet/webhook/payment/{txn.id}"
    result = await aggregator.create_payment(
        amount=request.amount,
        currency=request.currency,
        reference=txn.reference,
        customer_email=request.customer_email,
        callback_url=callback_url,
    )

    if not result.get("success"):
        txn.status = TransactionStatus.FAILED
        txn.provider_response = result
        await repos.transactions.create(txn)
        raise HTTPException(status_code=502, detail=f"Payment initiation failed: {result.get('error')}")

    txn.provider = result.get("provider")
    txn.provider_response = result.get("data")
    txn.status = TransactionStatus.PENDING
    await repos.transactions.create(txn)

    # Ledger: pending credit
    await _append_ledger(repos, txn, "credit", "pending", net_amount, sa.pending_balance + net_amount)

    # Optimistic pending balance update
    await repos.sub_accounts.update_balances(sa.id, pending_delta=net_amount)

    response = {
        "transaction_id": txn.id,
        "payment_url": result.get("data", {}).get("payment_url", ""),
        "reference": txn.reference,
        "amount": txn.amount,
        "currency": txn.currency,
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "provider": txn.provider or "",
    }

    if request.idempotency_key:
        await repos.idempotency.save(request.idempotency_key, response)

    return response


# ---------------------------------------------------------------------------
# Webhook / payment confirmation
# ---------------------------------------------------------------------------

async def handle_payment_webhook(
    repos: WalletRepositories,
    transaction_id: str,
    payload: dict,
) -> dict:
    txn = await repos.transactions.get_by_id(transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.status in (TransactionStatus.COMPLETED, TransactionStatus.FAILED):
        return {"status": txn.status.value, "message": "Already processed"}

    event_type = payload.get("event", "")
    if "success" in event_type or payload.get("status") == "successful":
        sa = await repos.sub_accounts.get_by_id(txn.sub_account_id)
        if sa:
            # Move from pending → available using atomic $inc
            await repos.sub_accounts.update_balances(
                sa.id,
                available_delta=txn.net_amount,
                pending_delta=-txn.net_amount,
                total_delta=txn.net_amount,
            )
            await _append_ledger(
                repos, txn, "credit", "completed", txn.net_amount,
                sa.available_balance + txn.net_amount
            )
        txn.status = TransactionStatus.COMPLETED
        txn.completed_at = datetime.utcnow()
        txn.provider_response = payload
    else:
        txn.status = TransactionStatus.FAILED
        txn.provider_response = payload

    await repos.transactions.update(txn)
    log.info("webhook.processed txn=%s status=%s", transaction_id, txn.status.value)
    return {"status": txn.status.value}


# ---------------------------------------------------------------------------
# Payout service
# ---------------------------------------------------------------------------

async def initiate_payout(
    repos: WalletRepositories,
    company_id: str,
    request: PayoutRequest,
    aggregator: PaymentAggregator,
) -> dict:
    """Initiate a payout.  Returns TransactionResponse data."""
    if request.idempotency_key:
        cached = await repos.idempotency.get(request.idempotency_key)
        if cached:
            return cached

    sa = await get_sub_account_or_404(repos, company_id)

    if sa.subscription_tier != SubscriptionTier.PREMIUM:
        raise HTTPException(
            status_code=403,
            detail="Payouts require Premium tier. Please upgrade.",
        )
    if not sa.kyc_verified or not sa.aml_cleared:
        raise HTTPException(status_code=403, detail="KYC/AML verification required for payouts")
    if request.amount > sa.available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: {sa.available_balance} {sa.currency}",
        )
    if sa.daily_payout_used + request.amount > sa.daily_payout_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Daily payout limit exceeded. Remaining: {sa.daily_payout_limit - sa.daily_payout_used}",
        )
    if sa.monthly_payout_used + request.amount > sa.monthly_payout_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Monthly payout limit exceeded.",
        )

    tier_config = TIER_CONFIG[sa.subscription_tier]
    fee = round(request.amount * tier_config["fee_percentage"] / 100, 2)
    net_amount = round(request.amount - fee, 2)

    txn = WalletTransaction(
        company_id=company_id,
        sub_account_id=sa.id,
        type=TransactionType.PAYOUT,
        amount=request.amount,
        fee=fee,
        net_amount=net_amount,
        currency=request.currency,
        description=request.narration or "Wallet payout",
        status=TransactionStatus.PROCESSING,
    )

    # Reserve funds atomically before calling the aggregator
    await repos.sub_accounts.update_balances(
        sa.id,
        available_delta=-request.amount,
        daily_payout_delta=request.amount,
        monthly_payout_delta=request.amount,
    )
    await repos.transactions.create(txn)
    await _append_ledger(repos, txn, "debit", "processing", request.amount, sa.available_balance - request.amount)

    result = await aggregator.initiate_payout(
        amount=net_amount,
        currency=request.currency,
        bank_code=request.bank_code,
        account_number=request.account_number,
        account_name=request.account_name,
        reference=txn.reference,
        narration=request.narration,
    )

    if not result.get("success"):
        # Reverse the reservation
        await repos.sub_accounts.update_balances(
            sa.id,
            available_delta=request.amount,
            daily_payout_delta=-request.amount,
            monthly_payout_delta=-request.amount,
        )
        await repos.transactions.update_status(txn.id, TransactionStatus.FAILED, provider_response=result)
        raise HTTPException(status_code=502, detail=f"Payout failed: {result.get('error')}")

    updated_txn = await repos.transactions.update_status(
        txn.id,
        TransactionStatus.COMPLETED,
        provider=result.get("provider"),
        provider_response=result.get("data"),
        completed_at=datetime.utcnow(),
    )

    response = {
        "id": txn.id,
        "type": txn.type.value,
        "amount": txn.amount,
        "fee": txn.fee,
        "net_amount": txn.net_amount,
        "currency": txn.currency,
        "status": TransactionStatus.COMPLETED.value,
        "reference": txn.reference,
        "provider": result.get("provider"),
        "created_at": txn.created_at,
        "completed_at": datetime.utcnow(),
    }
    if request.idempotency_key:
        await repos.idempotency.save(request.idempotency_key, response)
    return response


# ---------------------------------------------------------------------------
# Bank account service
# ---------------------------------------------------------------------------

async def link_bank_account(
    repos: WalletRepositories,
    company_id: str,
    request: LinkBankRequest,
    aggregator: PaymentAggregator,
) -> LinkedBankAccount:
    sa = await get_sub_account_or_404(repos, company_id)

    result = await aggregator.verify_bank_account(
        bank_code=request.bank_code,
        account_number=request.account_number,
    )

    status = BankAccountStatus.VERIFIED if result.get("success") else BankAccountStatus.FAILED

    account = LinkedBankAccount(
        sub_account_id=sa.id,
        company_id=company_id,
        bank_code=request.bank_code,
        bank_name=result.get("bank_name", request.bank_code),
        account_number_masked=f"****{request.account_number[-4:]}",
        account_number_encrypted=request.account_number,  # Encrypt in production with KMS
        account_name=result.get("account_name", request.account_name),
        status=status,
        verified_at=datetime.utcnow() if status == BankAccountStatus.VERIFIED else None,
    )
    return await repos.bank_accounts.create(account)


# ---------------------------------------------------------------------------
# Ledger helper (private)
# ---------------------------------------------------------------------------

async def _append_ledger(
    repos: WalletRepositories,
    txn: WalletTransaction,
    direction: str,
    state: str,
    amount: float,
    balance_after: float,
) -> LedgerEntry:
    entry = LedgerEntry(
        sub_account_id=txn.sub_account_id,
        transaction_id=txn.id,
        type=txn.type,
        direction=direction,
        state=state,
        amount=amount,
        balance_after=balance_after,
        currency=txn.currency,
        description=txn.description,
        reference=txn.reference,
    )
    return await repos.ledger.create(entry)


# ---------------------------------------------------------------------------
# Pull order service
# ---------------------------------------------------------------------------

async def create_pull_order(
    repos: WalletRepositories,
    company_id: str,
    request: CreatePullOrderRequest,
    base_url: str,
) -> PullOrder:
    sa = await get_sub_account_or_404(repos, company_id)
    approval_token = secrets.token_urlsafe(32)
    order = PullOrder(
        company_id=company_id,
        sub_account_id=sa.id,
        client_name=request.client_name,
        client_email=request.client_email,
        client_phone=request.client_phone,
        amount=request.amount,
        currency=request.currency,
        description=request.description,
        approval_token=approval_token,
        approval_url=f"{base_url}/wallet/pull-approval?token={approval_token}",
        expires_at=datetime.utcnow() + timedelta(hours=request.expiry_hours or 48),
    )
    return await repos.pull_orders.create(order)


async def approve_pull_order(
    repos: WalletRepositories,
    request: ApprovePullOrderRequest,
    client_ip: str,
    user_agent: str,
) -> PullOrder:
    order = await repos.pull_orders.get_by_token(request.approval_token)
    if not order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    if order.status != PullOrderStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail=f"Pull order status is {order.status.value}")
    if order.expires_at and datetime.utcnow() > order.expires_at:
        order.status = PullOrderStatus.EXPIRED
        await repos.pull_orders.update(order)
        raise HTTPException(status_code=400, detail="Pull order has expired")

    audit = PullOrderApprovalAudit(
        pull_order_id=order.id,
        company_id=order.company_id,
        action="approve",
        client_name=request.client_name,
        client_email=request.client_email,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    await repos.pull_orders.add_audit(audit)

    order.status = PullOrderStatus.APPROVED
    order.approved_at = datetime.utcnow()
    order.approved_by = request.client_name
    order.approval_ip = client_ip
    order.updated_at = datetime.utcnow()
    return await repos.pull_orders.update(order)


async def reject_pull_order(
    repos: WalletRepositories,
    request: RejectPullOrderRequest,
    client_ip: str,
    user_agent: str,
) -> PullOrder:
    order = await repos.pull_orders.get_by_token(request.approval_token)
    if not order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    if order.status != PullOrderStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail=f"Pull order status is {order.status.value}")

    audit = PullOrderApprovalAudit(
        pull_order_id=order.id,
        company_id=order.company_id,
        action="reject",
        client_name=request.client_name,
        client_email=request.client_email,
        ip_address=client_ip,
        user_agent=user_agent,
        rejection_reason=request.reason,
    )
    await repos.pull_orders.add_audit(audit)

    order.status = PullOrderStatus.REJECTED
    order.rejected_at = datetime.utcnow()
    order.rejected_by = request.client_name
    order.rejection_reason = request.reason
    order.updated_at = datetime.utcnow()
    return await repos.pull_orders.update(order)


async def execute_pull_order(
    repos: WalletRepositories,
    pull_order_id: str,
    aggregator: PaymentAggregator,
) -> PullOrder:
    order = await repos.pull_orders.get_by_id(pull_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    if order.status != PullOrderStatus.APPROVED:
        raise HTTPException(status_code=400, detail=f"Pull order must be approved. Status: {order.status.value}")

    sa = await repos.sub_accounts.get_by_id(order.sub_account_id)
    if not sa:
        raise HTTPException(status_code=404, detail="Sub-account not found")

    order.status = PullOrderStatus.PROCESSING
    order.updated_at = datetime.utcnow()
    await repos.pull_orders.update(order)

    # In production, call aggregator.initiate_direct_debit(...)
    # For now, simulate success
    order.status = PullOrderStatus.COMPLETED
    order.executed_at = datetime.utcnow()
    order.provider = "cgrate"
    order.provider_reference = f"DD-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{order.id[:8]}"
    order.updated_at = datetime.utcnow()
    await repos.pull_orders.update(order)

    # Credit sub-account
    tier_config = TIER_CONFIG[sa.subscription_tier]
    fee = round(order.amount * tier_config["fee_percentage"] / 100, 2)
    net = round(order.amount - fee, 2)

    txn = WalletTransaction(
        company_id=order.company_id,
        sub_account_id=sa.id,
        type=TransactionType.FUND,
        amount=order.amount,
        fee=fee,
        net_amount=net,
        currency=order.currency,
        description=f"Pull order: {order.description}",
        status=TransactionStatus.COMPLETED,
        provider=order.provider,
        completed_at=datetime.utcnow(),
    )
    await repos.transactions.create(txn)
    await repos.sub_accounts.update_balances(sa.id, available_delta=net, total_delta=net)
    await _append_ledger(repos, txn, "credit", "completed", net, sa.available_balance + net)

    return order


async def cancel_pull_order(repos: WalletRepositories, pull_order_id: str, company_id: str) -> PullOrder:
    order = await repos.pull_orders.get_by_id(pull_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    if order.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not your pull order")
    if order.status in (PullOrderStatus.COMPLETED, PullOrderStatus.PROCESSING):
        raise HTTPException(status_code=400, detail=f"Cannot cancel pull order with status {order.status.value}")

    order.status = PullOrderStatus.REJECTED
    order.updated_at = datetime.utcnow()
    return await repos.pull_orders.update(order)
