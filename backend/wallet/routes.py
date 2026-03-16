"""
CoveSmartWallet - API Routes
Wallet management, funding, payouts, and transactions
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio
import hashlib
import os
import logging

from .models import (
    SubAccount, SubAccountCreate, WalletTransaction, WalletBalance,
    FundRequest, PayoutRequest, TransferRequest, LinkBankRequest,
    LinkedBankAccount, LedgerEntry, WebhookConfig, WebhookEvent,
    TransactionType, TransactionStatus, SubscriptionTier, BankAccountStatus,
    PaymentLinkResponse, TransactionResponse, TIER_CONFIG,
    PullOrder, PullOrderStatus, PullOrderApprovalAudit,
    CreatePullOrderRequest, ApprovePullOrderRequest, RejectPullOrderRequest
)
from .adapters import PaymentAggregator
from fastapi import Request
from ws import manager as ws_manager

logger = logging.getLogger(__name__)

wallet_router = APIRouter(prefix="/wallet", tags=["Wallet"])

# Initialize payment aggregator with config from environment
def get_payment_aggregator():
    config = {
        "CGRATE_MERCHANT_ID": os.environ.get("CGRATE_MERCHANT_ID", ""),
        "CGRATE_API_KEY": os.environ.get("CGRATE_API_KEY", ""),
        "CGRATE_API_SECRET": os.environ.get("CGRATE_API_SECRET", ""),
        "DPO_COMPANY_TOKEN": os.environ.get("DPO_COMPANY_TOKEN", ""),
        "DPO_SERVICE_TYPE": os.environ.get("DPO_SERVICE_TYPE", ""),
        "FLW_SECRET_KEY": os.environ.get("FLW_SECRET_KEY", ""),
        "FLW_PUBLIC_KEY": os.environ.get("FLW_PUBLIC_KEY", ""),
    }
    return PaymentAggregator(config)


# In-memory storage for demo (replace with MongoDB in production)
MASTER_WALLET_ID = "mw_cove_master_001"
sub_accounts_db = {}
transactions_db = {}
bank_accounts_db = {}
ledger_db = []
webhooks_db = {}
idempotency_cache = {}
pull_orders_db = {}
pull_order_audit_db = []


def get_sub_account(company_id: str) -> Optional[SubAccount]:
    """Get sub-account by company ID"""
    for sa in sub_accounts_db.values():
        if sa.company_id == company_id:
            return sa
    return None


def check_idempotency(key: str) -> Optional[dict]:
    """Check if request was already processed"""
    if key and key in idempotency_cache:
        cached = idempotency_cache[key]
        if datetime.utcnow() - cached["timestamp"] < timedelta(hours=24):
            return cached["response"]
    return None


def save_idempotency(key: str, response: dict):
    """Save response for idempotency"""
    if key:
        idempotency_cache[key] = {
            "response": response,
            "timestamp": datetime.utcnow()
        }


def create_ledger_entry(txn: WalletTransaction, entry_type: str, 
                       account_type: str, amount: float, balance_after: float):
    """Create double-entry ledger record"""
    entry = LedgerEntry(
        transaction_id=txn.id,
        sub_account_id=txn.sub_account_id,
        entry_type=entry_type,
        account_type=account_type,
        debit=amount if entry_type == "debit" else 0,
        credit=amount if entry_type == "credit" else 0,
        balance_after=balance_after,
        description=f"{txn.type.value}: {txn.description or txn.reference}"
    )
    ledger_db.append(entry)
    return entry


# =========================
# SUB-ACCOUNT ENDPOINTS
# =========================

@wallet_router.post("/sub-accounts", response_model=SubAccount)
async def create_sub_account(data: SubAccountCreate):
    """Create a new sub-account for a company"""
    # Check if company already has sub-account
    existing = get_sub_account(data.company_id)
    if existing:
        raise HTTPException(status_code=400, detail="Company already has a wallet sub-account")
    
    # Set limits based on tier
    tier_config = TIER_CONFIG[data.subscription_tier]
    
    sub_account = SubAccount(
        master_wallet_id=MASTER_WALLET_ID,
        company_id=data.company_id,
        company_name=data.company_name,
        subscription_tier=data.subscription_tier,
        currency=data.currency,
        daily_payout_limit=tier_config["daily_payout_limit"],
        monthly_payout_limit=tier_config["monthly_payout_limit"]
    )
    
    sub_accounts_db[sub_account.id] = sub_account
    logger.info(f"Created sub-account {sub_account.id} for company {data.company_id}")
    
    return sub_account


@wallet_router.get("/sub-accounts/{company_id}", response_model=SubAccount)
async def get_company_sub_account(company_id: str):
    """Get sub-account for a company"""
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    return sub_account


@wallet_router.patch("/sub-accounts/{company_id}/tier")
async def upgrade_subscription_tier(company_id: str, tier: SubscriptionTier):
    """Upgrade subscription tier (Basic → Premium)"""
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    tier_config = TIER_CONFIG[tier]
    sub_account.subscription_tier = tier
    sub_account.daily_payout_limit = tier_config["daily_payout_limit"]
    sub_account.monthly_payout_limit = tier_config["monthly_payout_limit"]
    sub_account.updated_at = datetime.utcnow()
    
    return {"message": f"Upgraded to {tier.value} tier", "sub_account": sub_account}


# =========================
# BALANCE ENDPOINTS
# =========================

@wallet_router.get("/balance/{company_id}", response_model=WalletBalance)
async def get_wallet_balance(company_id: str):
    """Get wallet balance for a company"""
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    tier_config = TIER_CONFIG[sub_account.subscription_tier]
    
    return WalletBalance(
        sub_account_id=sub_account.id,
        company_id=company_id,
        available_balance=sub_account.available_balance,
        pending_balance=sub_account.pending_balance,
        reserved_balance=sub_account.reserved_balance,
        currency=sub_account.currency,
        subscription_tier=sub_account.subscription_tier.value,
        daily_payout_remaining=max(0, sub_account.daily_payout_limit - sub_account.daily_payout_used),
        monthly_payout_remaining=max(0, sub_account.monthly_payout_limit - sub_account.monthly_payout_used),
        last_updated=sub_account.updated_at
    )


# =========================
# FUNDING ENDPOINTS
# =========================

@wallet_router.post("/fund/{company_id}", response_model=PaymentLinkResponse)
async def initiate_funding(
    company_id: str, 
    request: FundRequest,
    background_tasks: BackgroundTasks
):
    """
    Initiate wallet funding (receive payment from client)
    Available for all tiers
    """
    # Check idempotency
    if request.idempotency_key:
        cached = check_idempotency(request.idempotency_key)
        if cached:
            return cached
    
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    # Create transaction record
    tier_config = TIER_CONFIG[sub_account.subscription_tier]
    fee = request.amount * (tier_config["fee_percentage"] / 100)
    
    txn = WalletTransaction(
        sub_account_id=sub_account.id,
        company_id=company_id,
        type=TransactionType.FUND,
        amount=request.amount,
        currency=request.currency,
        fee=fee,
        net_amount=request.amount - fee,
        description=request.description or "Wallet Funding",
        idempotency_key=request.idempotency_key,
        balance_before=sub_account.available_balance
    )
    
    # Get callback URL
    callback_url = request.callback_url or f"https://cove.zm/api/wallet/webhook/payment/{txn.id}"
    
    # Call payment aggregator
    aggregator = get_payment_aggregator()
    result = await aggregator.create_payment(
        amount=request.amount,
        currency=request.currency,
        reference=txn.reference,
        customer_email=request.customer_email,
        callback_url=callback_url
    )
    
    if not result.get("success"):
        txn.status = TransactionStatus.FAILED
        txn.provider_response = result
        transactions_db[txn.id] = txn
        raise HTTPException(status_code=502, detail=f"Payment initiation failed: {result.get('error')}")
    
    # Update transaction with provider info
    txn.provider = result.get("provider")
    txn.provider_response = result.get("data")
    txn.status = TransactionStatus.PENDING
    transactions_db[txn.id] = txn
    
    # Add pending balance
    sub_account.pending_balance += txn.net_amount
    sub_account.updated_at = datetime.utcnow()
    
    # Create ledger entry
    create_ledger_entry(txn, "credit", "pending", txn.net_amount, sub_account.pending_balance)
    
    response = PaymentLinkResponse(
        transaction_id=txn.id,
        payment_url=result.get("data", {}).get("payment_url", result.get("data", {}).get("link", "")),
        reference=txn.reference,
        amount=request.amount,
        currency=request.currency,
        expires_at=datetime.utcnow() + timedelta(hours=1),
        provider=txn.provider
    )
    
    # Save for idempotency
    save_idempotency(request.idempotency_key, response.model_dump())
    
    return response


@wallet_router.post("/webhook/payment/{transaction_id}")
async def payment_webhook(transaction_id: str, payload: dict):
    """
    Webhook endpoint for payment provider callbacks
    Updates transaction status and balances
    """
    txn = transactions_db.get(transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    sub_account = sub_accounts_db.get(txn.sub_account_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    # Verify payment with provider
    aggregator = get_payment_aggregator()
    verification = await aggregator.verify_payment(
        transaction_id=payload.get("transaction_id") or payload.get("tx_ref"),
        provider=txn.provider
    )
    
    if verification.get("success"):
        # Move from pending to available
        sub_account.pending_balance -= txn.net_amount
        sub_account.available_balance += txn.net_amount
        sub_account.last_activity = datetime.utcnow()
        
        txn.status = TransactionStatus.COMPLETED
        txn.completed_at = datetime.utcnow()
        txn.balance_after = sub_account.available_balance
        
        # Create ledger entries
        create_ledger_entry(txn, "debit", "pending", txn.net_amount, sub_account.pending_balance)
        create_ledger_entry(txn, "credit", "available", txn.net_amount, sub_account.available_balance)
        
        logger.info(f"Payment {transaction_id} completed. New balance: {sub_account.available_balance}")
    else:
        txn.status = TransactionStatus.FAILED
        sub_account.pending_balance -= txn.net_amount
        
        create_ledger_entry(txn, "debit", "pending", txn.net_amount, sub_account.pending_balance)
    
    txn.provider_response = verification
    txn.updated_at = datetime.utcnow()
    
    return {"status": txn.status.value}


# =========================
# PAYOUT ENDPOINTS (PREMIUM ONLY)
# =========================

@wallet_router.post("/payout/{company_id}", response_model=TransactionResponse)
async def initiate_payout(
    company_id: str,
    request: PayoutRequest,
    background_tasks: BackgroundTasks
):
    """
    Execute payout to bank account
    PREMIUM TIER ONLY
    """
    # Check idempotency
    if request.idempotency_key:
        cached = check_idempotency(request.idempotency_key)
        if cached:
            return cached
    
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    # Check tier
    if sub_account.subscription_tier != SubscriptionTier.PREMIUM:
        raise HTTPException(
            status_code=403, 
            detail="Payouts require Premium tier subscription. Please upgrade to access this feature."
        )
    
    # Check KYC/AML
    if not sub_account.kyc_verified or not sub_account.aml_cleared:
        raise HTTPException(status_code=403, detail="KYC/AML verification required for payouts")
    
    # Check balance
    if request.amount > sub_account.available_balance:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient balance. Available: {sub_account.available_balance} {sub_account.currency}"
        )
    
    # Check daily limit
    if sub_account.daily_payout_used + request.amount > sub_account.daily_payout_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Daily payout limit exceeded. Remaining: {sub_account.daily_payout_limit - sub_account.daily_payout_used}"
        )
    
    # Check monthly limit
    if sub_account.monthly_payout_used + request.amount > sub_account.monthly_payout_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Monthly payout limit exceeded. Remaining: {sub_account.monthly_payout_limit - sub_account.monthly_payout_used}"
        )
    
    # Calculate fee
    tier_config = TIER_CONFIG[sub_account.subscription_tier]
    fee = request.amount * (tier_config["fee_percentage"] / 100)
    
    # Create transaction
    txn = WalletTransaction(
        sub_account_id=sub_account.id,
        company_id=company_id,
        type=TransactionType.PAYOUT,
        amount=request.amount,
        currency=request.currency,
        fee=fee,
        net_amount=request.amount - fee,
        description=request.narration or "Wallet Payout",
        recipient_bank_code=request.bank_code,
        recipient_account_number=request.account_number,
        recipient_account_name=request.account_name,
        idempotency_key=request.idempotency_key,
        balance_before=sub_account.available_balance
    )
    
    # Reserve funds
    sub_account.available_balance -= request.amount
    sub_account.reserved_balance += request.amount
    
    # Create ledger entries
    create_ledger_entry(txn, "debit", "available", request.amount, sub_account.available_balance)
    create_ledger_entry(txn, "credit", "reserved", request.amount, sub_account.reserved_balance)
    
    # Call payment aggregator for payout
    aggregator = get_payment_aggregator()
    result = await aggregator.initiate_payout(
        amount=txn.net_amount,  # Send net amount after fee
        currency=request.currency,
        bank_code=request.bank_code,
        account_number=request.account_number,
        account_name=request.account_name,
        reference=txn.reference
    )
    
    if result.get("success"):
        txn.status = TransactionStatus.PROCESSING
        txn.provider = result.get("provider")
        txn.provider_reference = result.get("data", {}).get("id") or result.get("data", {}).get("transfer_id")
        
        # Update limits
        sub_account.daily_payout_used += request.amount
        sub_account.monthly_payout_used += request.amount
    else:
        # Reverse reservation
        sub_account.available_balance += request.amount
        sub_account.reserved_balance -= request.amount
        txn.status = TransactionStatus.FAILED
        
        create_ledger_entry(txn, "credit", "available", request.amount, sub_account.available_balance)
        create_ledger_entry(txn, "debit", "reserved", request.amount, sub_account.reserved_balance)
    
    txn.provider_response = result
    txn.updated_at = datetime.utcnow()
    transactions_db[txn.id] = txn
    
    sub_account.last_activity = datetime.utcnow()
    sub_account.updated_at = datetime.utcnow()
    
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"Payout failed: {result.get('error')}")
    
    response = TransactionResponse(
        id=txn.id,
        type=txn.type.value,
        amount=txn.amount,
        fee=txn.fee,
        net_amount=txn.net_amount,
        currency=txn.currency,
        status=txn.status.value,
        reference=txn.reference,
        provider=txn.provider,
        created_at=txn.created_at,
        completed_at=txn.completed_at
    )
    
    save_idempotency(request.idempotency_key, response.model_dump())
    
    return response


# =========================
# BANK ACCOUNT ENDPOINTS
# =========================

@wallet_router.post("/bank-accounts/{company_id}/link")
async def link_bank_account(company_id: str, request: LinkBankRequest):
    """Link a bank account for funding via aggregator's built-in verification"""
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    # Call aggregator to verify/link account
    aggregator = get_payment_aggregator()
    result = await aggregator.link_bank_account({
        "bank_code": request.bank_code,
        "account_number": request.account_number,
        "account_name": request.account_name
    })
    
    # Create bank account record
    bank_account = LinkedBankAccount(
        sub_account_id=sub_account.id,
        company_id=company_id,
        bank_code=request.bank_code,
        bank_name=f"Bank {request.bank_code}",  # Would get from bank list
        account_number_masked=f"****{request.account_number[-4:]}",
        account_number_hash=hashlib.sha256(request.account_number.encode()).hexdigest(),
        account_name=request.account_name,
        status=BankAccountStatus.VERIFIED if result.get("success") else BankAccountStatus.PENDING,
        provider=result.get("provider", "unknown"),
        provider_reference=result.get("data", {}).get("reference"),
        is_primary=request.set_as_primary
    )
    
    if result.get("success"):
        bank_account.verified_at = datetime.utcnow()
    
    bank_accounts_db[bank_account.id] = bank_account
    
    return bank_account


@wallet_router.get("/bank-accounts/{company_id}")
async def get_linked_bank_accounts(company_id: str):
    """Get all linked bank accounts for a company"""
    accounts = [ba for ba in bank_accounts_db.values() if ba.company_id == company_id]
    return accounts


# =========================
# TRANSACTION HISTORY
# =========================

@wallet_router.get("/transactions/{company_id}")
async def get_transactions(
    company_id: str,
    type: Optional[TransactionType] = None,
    status: Optional[TransactionStatus] = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0
):
    """Get transaction history for a company"""
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    transactions = [
        txn for txn in transactions_db.values()
        if txn.company_id == company_id
        and (type is None or txn.type == type)
        and (status is None or txn.status == status)
    ]
    
    # Sort by created_at desc
    transactions.sort(key=lambda x: x.created_at, reverse=True)
    
    return {
        "total": len(transactions),
        "transactions": transactions[offset:offset + limit]
    }


@wallet_router.get("/transactions/{company_id}/{transaction_id}")
async def get_transaction(company_id: str, transaction_id: str):
    """Get specific transaction details"""
    txn = transactions_db.get(transaction_id)
    if not txn or txn.company_id != company_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


# =========================
# SUBSCRIPTION INFO
# =========================

@wallet_router.get("/subscription/{company_id}")
async def get_subscription_info(company_id: str):
    """Get subscription tier and features"""
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    tier_config = TIER_CONFIG[sub_account.subscription_tier]
    
    return {
        "company_id": company_id,
        "current_tier": sub_account.subscription_tier.value,
        "features": tier_config["features"],
        "limits": {
            "daily_payout_limit": tier_config["daily_payout_limit"],
            "monthly_payout_limit": tier_config["monthly_payout_limit"],
            "daily_payout_used": sub_account.daily_payout_used,
            "monthly_payout_used": sub_account.monthly_payout_used
        },
        "fee_percentage": tier_config["fee_percentage"],
        "api_access": tier_config["api_access"],
        "upgrade_available": sub_account.subscription_tier == SubscriptionTier.BASIC
    }



# =========================
# PULL ORDER ENDPOINTS (Direct Debit)
# =========================

@wallet_router.post("/pull-orders/{company_id}/create")
async def create_pull_order(
    company_id: str,
    request: CreatePullOrderRequest,
    background_tasks: BackgroundTasks
):
    """
    Create a pull order to debit funds from client's linked bank account.
    The order requires client approval before execution.
    """
    sub_account = get_sub_account(company_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    # Get the source bank account
    bank_account = bank_accounts_db.get(request.source_bank_account_id)
    if not bank_account or bank_account.company_id != company_id:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    if bank_account.status != BankAccountStatus.VERIFIED:
        raise HTTPException(status_code=400, detail="Bank account must be verified for pull orders")
    
    # Calculate fee
    tier_config = TIER_CONFIG[sub_account.subscription_tier]
    fee = request.amount * (tier_config["fee_percentage"] / 100)
    
    # Create pull order
    pull_order = PullOrder(
        company_id=company_id,
        sub_account_id=sub_account.id,
        amount=request.amount,
        description=request.description,
        source_bank_account_id=request.source_bank_account_id,
        source_bank_code=bank_account.bank_code,
        source_account_number_masked=bank_account.account_number_masked,
        source_account_name=bank_account.account_name,
        purpose=request.purpose,
        purpose_reference=request.purpose_reference,
        fee=fee,
        net_amount=request.amount - fee
    )
    
    pull_orders_db[pull_order.id] = pull_order
    
    # In production: Send notification to client for approval
    # background_tasks.add_task(send_pull_order_notification, pull_order)
    
    logger.info(f"Created pull order {pull_order.id} for {request.amount} ZMW from account {bank_account.account_number_masked}")
    
    # Broadcast real-time event
    background_tasks.add_task(
        ws_manager.broadcast, company_id, "pull_order.created",
        {"id": pull_order.id, "reference": pull_order.reference,
         "amount": pull_order.amount, "status": pull_order.status.value,
         "source_account": bank_account.account_number_masked,
         "description": pull_order.description}
    )
    
    return {
        "message": "Pull order created. Awaiting client approval.",
        "pull_order": pull_order.model_dump(),
        "approval_link": f"/wallet/pull-orders/approve?token={pull_order.approval_token}",
        "expires_at": pull_order.approval_expires_at.isoformat()
    }


@wallet_router.get("/pull-orders/{company_id}")
async def get_pull_orders(
    company_id: str,
    status: Optional[PullOrderStatus] = None
):
    """Get all pull orders for a company"""
    orders = [po for po in pull_orders_db.values() if po.company_id == company_id]
    
    if status:
        orders = [po for po in orders if po.status == status]
    
    # Sort by created_at desc
    orders.sort(key=lambda x: x.created_at, reverse=True)
    
    return {
        "total": len(orders),
        "pull_orders": [po.model_dump() for po in orders]
    }


@wallet_router.get("/pull-orders/detail/{pull_order_id}")
async def get_pull_order_detail(pull_order_id: str):
    """Get detailed pull order information"""
    pull_order = pull_orders_db.get(pull_order_id)
    if not pull_order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    
    # Get audit trail
    audit_trail = [a for a in pull_order_audit_db if a.pull_order_id == pull_order_id]
    audit_trail.sort(key=lambda x: x.timestamp, reverse=True)
    
    return {
        "pull_order": pull_order.model_dump(),
        "audit_trail": [a.model_dump() for a in audit_trail]
    }


@wallet_router.get("/pull-approval")
async def get_pending_approval_by_token(token: str):
    """
    Get pull order details by approval token.
    Used by client to view and approve/reject the pull order.
    """
    # Find pull order by token
    pull_order = None
    for po in pull_orders_db.values():
        if po.approval_token == token:
            pull_order = po
            break
    
    if not pull_order:
        raise HTTPException(status_code=404, detail="Pull order not found or invalid token")
    
    # Check if expired
    if datetime.utcnow() > pull_order.approval_expires_at:
        if pull_order.status == PullOrderStatus.PENDING_APPROVAL:
            pull_order.status = PullOrderStatus.EXPIRED
            pull_order.updated_at = datetime.utcnow()
        raise HTTPException(status_code=400, detail="Approval link has expired")
    
    # Check status
    if pull_order.status != PullOrderStatus.PENDING_APPROVAL:
        return {
            "pull_order": pull_order.model_dump(),
            "can_approve": False,
            "message": f"This pull order has already been {pull_order.status.value}"
        }
    
    # Get sub-account for company name
    sub_account = sub_accounts_db.get(pull_order.sub_account_id)
    
    return {
        "pull_order": {
            "id": pull_order.id,
            "reference": pull_order.reference,
            "amount": pull_order.amount,
            "currency": pull_order.currency,
            "fee": pull_order.fee,
            "net_amount": pull_order.net_amount,
            "description": pull_order.description,
            "purpose": pull_order.purpose,
            "source_account_masked": pull_order.source_account_number_masked,
            "source_account_name": pull_order.source_account_name,
            "requester_company": sub_account.company_name if sub_account else "Unknown",
            "created_at": pull_order.created_at.isoformat(),
            "expires_at": pull_order.approval_expires_at.isoformat()
        },
        "can_approve": True,
        "message": "Please review and approve or reject this debit request"
    }


@wallet_router.post("/pull-orders/approve")
async def approve_pull_order(request: ApprovePullOrderRequest, req: Request):
    """
    Client approves the pull order.
    After approval, the funds will be pulled from the linked bank account.
    """
    # Find pull order by token
    pull_order = None
    for po in pull_orders_db.values():
        if po.approval_token == request.approval_token:
            pull_order = po
            break
    
    if not pull_order:
        raise HTTPException(status_code=404, detail="Pull order not found or invalid token")
    
    # Check if expired
    if datetime.utcnow() > pull_order.approval_expires_at:
        pull_order.status = PullOrderStatus.EXPIRED
        pull_order.updated_at = datetime.utcnow()
        raise HTTPException(status_code=400, detail="Approval link has expired")
    
    # Check status
    if pull_order.status != PullOrderStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail=f"Pull order is {pull_order.status.value}, cannot approve")
    
    # Get client info
    client_ip = req.client.host if req.client else "unknown"
    user_agent = req.headers.get("user-agent", "unknown")
    
    # Create audit record
    audit = PullOrderApprovalAudit(
        pull_order_id=pull_order.id,
        company_id=pull_order.company_id,
        action="approve",
        client_name=request.client_name,
        client_email=request.client_email,
        ip_address=client_ip,
        user_agent=user_agent
    )
    pull_order_audit_db.append(audit)
    
    # Update pull order
    pull_order.status = PullOrderStatus.APPROVED
    pull_order.approved_at = datetime.utcnow()
    pull_order.approved_by = request.client_name
    pull_order.approval_ip = client_ip
    pull_order.updated_at = datetime.utcnow()
    
    logger.info(f"Pull order {pull_order.id} approved by {request.client_name} from {client_ip}")
    
    # Broadcast real-time event
    asyncio.ensure_future(
        ws_manager.broadcast(pull_order.company_id, "pull_order.approved",
            {"id": pull_order.id, "reference": pull_order.reference,
             "amount": pull_order.amount, "status": pull_order.status.value,
             "approved_by": request.client_name})
    )
    
    return {
        "message": "Pull order approved successfully",
        "pull_order_id": pull_order.id,
        "reference": pull_order.reference,
        "amount": pull_order.amount,
        "status": pull_order.status.value,
        "approved_at": pull_order.approved_at.isoformat(),
        "next_step": "The funds will be pulled from your account within 1-2 business days"
    }


@wallet_router.post("/pull-orders/reject")
async def reject_pull_order(request: RejectPullOrderRequest, req: Request):
    """
    Client rejects the pull order.
    """
    # Find pull order by token
    pull_order = None
    for po in pull_orders_db.values():
        if po.approval_token == request.approval_token:
            pull_order = po
            break
    
    if not pull_order:
        raise HTTPException(status_code=404, detail="Pull order not found or invalid token")
    
    # Check status
    if pull_order.status != PullOrderStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail=f"Pull order is {pull_order.status.value}, cannot reject")
    
    # Get client info
    client_ip = req.client.host if req.client else "unknown"
    user_agent = req.headers.get("user-agent", "unknown")
    
    # Create audit record
    audit = PullOrderApprovalAudit(
        pull_order_id=pull_order.id,
        company_id=pull_order.company_id,
        action="reject",
        client_name=request.client_name,
        client_email=None,
        ip_address=client_ip,
        user_agent=user_agent,
        reason=request.reason
    )
    pull_order_audit_db.append(audit)
    
    # Update pull order
    pull_order.status = PullOrderStatus.REJECTED
    pull_order.rejected_at = datetime.utcnow()
    pull_order.rejection_reason = request.reason
    pull_order.updated_at = datetime.utcnow()
    
    logger.info(f"Pull order {pull_order.id} rejected: {request.reason}")
    
    # Broadcast real-time event
    asyncio.ensure_future(
        ws_manager.broadcast(pull_order.company_id, "pull_order.rejected",
            {"id": pull_order.id, "reference": pull_order.reference,
             "amount": pull_order.amount, "status": pull_order.status.value,
             "reason": request.reason})
    )
    
    return {
        "message": "Pull order rejected",
        "pull_order_id": pull_order.id,
        "status": pull_order.status.value,
        "reason": request.reason
    }


@wallet_router.post("/pull-orders/{pull_order_id}/execute")
async def execute_pull_order(pull_order_id: str):
    """
    Execute an approved pull order.
    Pulls funds from client's bank account and credits to wallet.
    """
    pull_order = pull_orders_db.get(pull_order_id)
    if not pull_order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    
    if pull_order.status != PullOrderStatus.APPROVED:
        raise HTTPException(status_code=400, detail=f"Pull order must be approved. Current status: {pull_order.status.value}")
    
    sub_account = sub_accounts_db.get(pull_order.sub_account_id)
    if not sub_account:
        raise HTTPException(status_code=404, detail="Sub-account not found")
    
    # Update status to processing
    pull_order.status = PullOrderStatus.PROCESSING
    pull_order.updated_at = datetime.utcnow()
    
    # Call payment aggregator for direct debit
    aggregator = get_payment_aggregator()
    
    # Note: In production, this would use the aggregator's direct debit API
    # For demo, we simulate the pull
    try:
        # Simulate direct debit call
        # result = await aggregator.initiate_direct_debit(...)
        
        # For demo: Simulate successful pull
        pull_order.status = PullOrderStatus.COMPLETED
        pull_order.executed_at = datetime.utcnow()
        pull_order.provider = "cgrate"  # Would come from actual response
        pull_order.provider_reference = f"DD-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Create wallet transaction
        txn = WalletTransaction(
            sub_account_id=sub_account.id,
            company_id=pull_order.company_id,
            type=TransactionType.FUND,
            amount=pull_order.amount,
            currency=pull_order.currency,
            fee=pull_order.fee,
            net_amount=pull_order.net_amount,
            description=f"Pull from {pull_order.source_account_number_masked}: {pull_order.description}",
            status=TransactionStatus.COMPLETED,
            provider=pull_order.provider,
            provider_reference=pull_order.provider_reference,
            balance_before=sub_account.available_balance,
            completed_at=datetime.utcnow()
        )
        
        # Credit to wallet
        sub_account.available_balance += pull_order.net_amount
        sub_account.last_activity = datetime.utcnow()
        sub_account.updated_at = datetime.utcnow()
        
        txn.balance_after = sub_account.available_balance
        transactions_db[txn.id] = txn
        
        pull_order.wallet_transaction_id = txn.id
        pull_order.updated_at = datetime.utcnow()
        
        # Create ledger entry
        create_ledger_entry(txn, "credit", "available", pull_order.net_amount, sub_account.available_balance)
        
        logger.info(f"Pull order {pull_order_id} executed. Credited {pull_order.net_amount} ZMW to wallet")
        
        # Broadcast real-time event
        asyncio.ensure_future(
            ws_manager.broadcast(pull_order.company_id, "pull_order.executed",
                {"id": pull_order.id, "reference": pull_order.reference,
                 "amount": pull_order.amount, "net_credited": pull_order.net_amount,
                 "new_balance": sub_account.available_balance,
                 "status": pull_order.status.value})
        )
        
        return {
            "message": "Pull order executed successfully",
            "pull_order_id": pull_order.id,
            "amount_pulled": pull_order.amount,
            "fee": pull_order.fee,
            "net_credited": pull_order.net_amount,
            "new_balance": sub_account.available_balance,
            "transaction_id": txn.id
        }
        
    except Exception as e:
        pull_order.status = PullOrderStatus.FAILED
        pull_order.updated_at = datetime.utcnow()
        logger.error(f"Pull order {pull_order_id} failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute pull: {str(e)}")


@wallet_router.post("/pull-orders/{pull_order_id}/cancel")
async def cancel_pull_order(pull_order_id: str, req: Request):
    """Cancel a pending pull order"""
    pull_order = pull_orders_db.get(pull_order_id)
    if not pull_order:
        raise HTTPException(status_code=404, detail="Pull order not found")
    
    if pull_order.status not in [PullOrderStatus.PENDING_APPROVAL, PullOrderStatus.APPROVED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel pull order in status: {pull_order.status.value}")
    
    client_ip = req.client.host if req.client else "unknown"
    user_agent = req.headers.get("user-agent", "unknown")
    
    # Create audit record
    audit = PullOrderApprovalAudit(
        pull_order_id=pull_order.id,
        company_id=pull_order.company_id,
        action="cancel",
        ip_address=client_ip,
        user_agent=user_agent,
        reason="Cancelled by requester"
    )
    pull_order_audit_db.append(audit)
    
    pull_order.status = PullOrderStatus.CANCELLED
    pull_order.updated_at = datetime.utcnow()
    
    # Broadcast real-time event
    asyncio.ensure_future(
        ws_manager.broadcast(pull_order.company_id, "pull_order.cancelled",
            {"id": pull_order.id, "reference": pull_order.reference,
             "status": pull_order.status.value})
    )
    
    return {
        "message": "Pull order cancelled",
        "pull_order_id": pull_order.id,
        "status": pull_order.status.value
    }


@wallet_router.get("/pull-orders/{company_id}/audit")
async def get_pull_order_audit_trail(company_id: str):
    """Get audit trail for all pull orders of a company"""
    audits = [a for a in pull_order_audit_db if a.company_id == company_id]
    audits.sort(key=lambda x: x.timestamp, reverse=True)
    
    return {
        "total": len(audits),
        "audit_records": [a.model_dump() for a in audits]
    }
