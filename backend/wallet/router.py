"""
CoveSmartWallet – FastAPI Router
Thin HTTP adapter: validate input, call service, return response.

Rules:
  * Every route requires authentication via get_current_user.
  * Manager-only routes additionally use require_min_role("manager").
  * No business logic here – delegate entirely to wallet.service.
  * DB dependency injected via get_db from server lifespan.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from auth import get_current_user, require_min_role, TokenData
from .models import (
    SubAccountCreate,
    SubAccount,
    WalletBalance,
    FundRequest,
    PayoutRequest,
    TransferRequest,
    LinkBankRequest,
    SubscriptionTier,
    CreatePullOrderRequest,
    ApprovePullOrderRequest,
    RejectPullOrderRequest,
    TransactionResponse,
    PaymentLinkResponse,
)
from .repository import WalletRepositories
from .adapters import PaymentAggregator
from . import service as wallet_service
import os

wallet_router = APIRouter(prefix="/wallet", tags=["Wallet"])


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

async def get_repos(request: Request) -> WalletRepositories:
    """Inject repository bundle from the app-level Motor database."""
    db: AsyncIOMotorDatabase = request.app.state.db
    return WalletRepositories(db)


def get_aggregator() -> PaymentAggregator:
    config = {
        "CGRATE_BASE_URL": os.environ.get("CGRATE_BASE_URL", ""),
        "CGRATE_API_KEY": os.environ.get("CGRATE_API_KEY", ""),
        "DPO_COMPANY_TOKEN": os.environ.get("DPO_COMPANY_TOKEN", ""),
        "DPO_BASE_URL": os.environ.get("DPO_BASE_URL", "https://secure.3gdirectpay.com"),
        "FLW_SECRET_KEY": os.environ.get("FLW_SECRET_KEY", ""),
        "FLW_PUBLIC_KEY": os.environ.get("FLW_PUBLIC_KEY", ""),
    }
    return PaymentAggregator(config)


def base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


# ---------------------------------------------------------------------------
# Sub-account endpoints
# ---------------------------------------------------------------------------

@wallet_router.post("/sub-accounts", response_model=SubAccount)
async def create_sub_account(
    data: SubAccountCreate,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    """Create a sub-account for a company. Requires authentication."""
    try:
        return await wallet_service.create_sub_account(repos, data)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail=str(exc))


@wallet_router.get("/sub-accounts/{company_id}", response_model=SubAccount)
async def get_company_sub_account(
    company_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    return await wallet_service.get_sub_account_or_404(repos, company_id)


@wallet_router.patch("/sub-accounts/{company_id}/tier")
async def upgrade_subscription_tier(
    company_id: str,
    tier: SubscriptionTier,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(require_min_role("manager")),
):
    """Upgrade subscription tier. Manager-only."""
    return await wallet_service.upgrade_tier(repos, company_id, tier)


@wallet_router.get("/balance/{company_id}", response_model=WalletBalance)
async def get_balance(
    company_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    return await wallet_service.get_balance(repos, company_id)


# ---------------------------------------------------------------------------
# Funding
# ---------------------------------------------------------------------------

@wallet_router.post("/fund/{company_id}", response_model=PaymentLinkResponse)
async def initiate_fund(
    company_id: str,
    request: FundRequest,
    req: Request,
    repos: WalletRepositories = Depends(get_repos),
    aggregator: PaymentAggregator = Depends(get_aggregator),
    current_user: TokenData = Depends(get_current_user),
):
    result = await wallet_service.initiate_fund(
        repos, company_id, request, aggregator, base_url(req)
    )
    return result


@wallet_router.post("/webhook/payment/{transaction_id}")
async def payment_webhook(
    transaction_id: str,
    req: Request,
    repos: WalletRepositories = Depends(get_repos),
):
    """Payment provider webhook – no auth (called by payment providers)."""
    payload = await req.json()
    return await wallet_service.handle_payment_webhook(repos, transaction_id, payload)


# ---------------------------------------------------------------------------
# Payouts
# ---------------------------------------------------------------------------

@wallet_router.post("/payout/{company_id}", response_model=TransactionResponse)
async def initiate_payout(
    company_id: str,
    request: PayoutRequest,
    repos: WalletRepositories = Depends(get_repos),
    aggregator: PaymentAggregator = Depends(get_aggregator),
    current_user: TokenData = Depends(require_min_role("manager")),
):
    """Initiate a payout. Manager-only."""
    result = await wallet_service.initiate_payout(repos, company_id, request, aggregator)
    return result


# ---------------------------------------------------------------------------
# Bank accounts
# ---------------------------------------------------------------------------

@wallet_router.post("/bank-accounts/{company_id}/link")
async def link_bank_account(
    company_id: str,
    request: LinkBankRequest,
    repos: WalletRepositories = Depends(get_repos),
    aggregator: PaymentAggregator = Depends(get_aggregator),
    current_user: TokenData = Depends(get_current_user),
):
    return await wallet_service.link_bank_account(repos, company_id, request, aggregator)


@wallet_router.get("/bank-accounts/{company_id}")
async def list_bank_accounts(
    company_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    accounts = await repos.bank_accounts.list_by_company(company_id)
    return {"bank_accounts": [a.model_dump() for a in accounts]}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@wallet_router.get("/transactions/{company_id}")
async def list_transactions(
    company_id: str,
    limit: int = Query(default=50, le=200),
    skip: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None),
    txn_type: Optional[str] = Query(default=None),
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    transactions = await repos.transactions.list_by_company(
        company_id, limit=limit, skip=skip, status=status, txn_type=txn_type
    )
    return {"total": len(transactions), "transactions": [t.model_dump() for t in transactions]}


@wallet_router.get("/transactions/{company_id}/{transaction_id}")
async def get_transaction(
    company_id: str,
    transaction_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    from fastapi import HTTPException
    txn = await repos.transactions.get_by_id(transaction_id)
    if not txn or txn.company_id != company_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


# ---------------------------------------------------------------------------
# Subscription info
# ---------------------------------------------------------------------------

@wallet_router.get("/subscription/{company_id}")
async def get_subscription_info(
    company_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    from .models import TIER_CONFIG
    sa = await wallet_service.get_sub_account_or_404(repos, company_id)
    tier_config = TIER_CONFIG[sa.subscription_tier]
    return {
        "company_id": company_id,
        "current_tier": sa.subscription_tier.value,
        "features": tier_config["features"],
        "limits": {
            "daily_payout_limit": tier_config["daily_payout_limit"],
            "monthly_payout_remaining": max(0.0, sa.monthly_payout_limit - sa.monthly_payout_used),
            "daily_payout_remaining": max(0.0, sa.daily_payout_limit - sa.daily_payout_used),
        },
        "fee_percentage": tier_config["fee_percentage"],
        "api_access": tier_config["api_access"],
        "upgrade_available": sa.subscription_tier.value == "basic",
    }


# ---------------------------------------------------------------------------
# Pull order endpoints
# ---------------------------------------------------------------------------

@wallet_router.post("/pull-orders/{company_id}/create")
async def create_pull_order(
    company_id: str,
    request: CreatePullOrderRequest,
    req: Request,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    order = await wallet_service.create_pull_order(repos, company_id, request, base_url(req))
    return order.model_dump()


@wallet_router.get("/pull-orders/{company_id}")
async def list_pull_orders(
    company_id: str,
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
    skip: int = Query(default=0, ge=0),
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    orders = await repos.pull_orders.list_by_company(company_id, status=status, limit=limit, skip=skip)
    return {"total": len(orders), "pull_orders": [o.model_dump() for o in orders]}


@wallet_router.get("/pull-orders/detail/{pull_order_id}")
async def get_pull_order_detail(
    pull_order_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    from fastapi import HTTPException
    order = await repos.pull_orders.get_by_id(pull_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    audit_trail = await repos.pull_orders.list_audit(pull_order_id)
    return {
        "pull_order": order.model_dump(),
        "audit_trail": [a.model_dump() for a in audit_trail],
    }


@wallet_router.get("/pull-approval")
async def get_pull_approval_details(
    token: str,
    repos: WalletRepositories = Depends(get_repos),
):
    """Public endpoint – client views pull request before approving/rejecting."""
    from fastapi import HTTPException
    order = await repos.pull_orders.get_by_token(token)
    if not order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    return {
        "id": order.id,
        "company_id": order.company_id,
        "amount": order.amount,
        "currency": order.currency,
        "description": order.description,
        "status": order.status.value,
        "expires_at": order.expires_at,
        "created_at": order.created_at,
    }


@wallet_router.post("/pull-orders/approve")
async def approve_pull_order(
    request: ApprovePullOrderRequest,
    req: Request,
    repos: WalletRepositories = Depends(get_repos),
):
    """Public endpoint – client approves a pull order via token."""
    client_ip = req.headers.get("x-forwarded-for", req.client.host if req.client else "unknown")
    user_agent = req.headers.get("user-agent", "unknown")
    order = await wallet_service.approve_pull_order(repos, request, client_ip, user_agent)
    return {"status": order.status.value, "message": "Pull order approved"}


@wallet_router.post("/pull-orders/reject")
async def reject_pull_order(
    request: RejectPullOrderRequest,
    req: Request,
    repos: WalletRepositories = Depends(get_repos),
):
    """Public endpoint – client rejects a pull order via token."""
    client_ip = req.headers.get("x-forwarded-for", req.client.host if req.client else "unknown")
    user_agent = req.headers.get("user-agent", "unknown")
    order = await wallet_service.reject_pull_order(repos, request, client_ip, user_agent)
    return {"status": order.status.value, "message": "Pull order rejected"}


@wallet_router.post("/pull-orders/{pull_order_id}/execute")
async def execute_pull_order(
    pull_order_id: str,
    repos: WalletRepositories = Depends(get_repos),
    aggregator: PaymentAggregator = Depends(get_aggregator),
    current_user: TokenData = Depends(require_min_role("manager")),
):
    """Execute an approved pull order. Manager-only."""
    order = await wallet_service.execute_pull_order(repos, pull_order_id, aggregator)
    return order.model_dump()


@wallet_router.post("/pull-orders/{pull_order_id}/cancel")
async def cancel_pull_order(
    pull_order_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(get_current_user),
):
    order = await wallet_service.cancel_pull_order(repos, pull_order_id, current_user.company_id)
    return {"status": order.status.value, "message": "Pull order cancelled"}


@wallet_router.get("/pull-orders/{company_id}/audit")
async def get_pull_order_audit(
    company_id: str,
    repos: WalletRepositories = Depends(get_repos),
    current_user: TokenData = Depends(require_min_role("manager")),
):
    """Get all audit records for a company's pull orders. Manager-only."""
    orders = await repos.pull_orders.list_by_company(company_id, limit=500)
    all_audits = []
    for order in orders:
        audits = await repos.pull_orders.list_audit(order.id)
        all_audits.extend([a.model_dump() for a in audits])
    return {"total": len(all_audits), "audit_records": all_audits}
