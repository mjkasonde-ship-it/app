"""
CoveSmartWallet - Data Models
Master wallet with sub-accounts per company
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class SubscriptionTier(str, Enum):
    BASIC = "basic"
    PREMIUM = "premium"


class TransactionType(str, Enum):
    FUND = "fund"           # Incoming payment
    PAYOUT = "payout"       # Outgoing payment
    TRANSFER = "transfer"   # Internal transfer between sub-accounts
    FEE = "fee"             # Platform fee
    REFUND = "refund"


class TransactionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REVERSED = "reversed"


class BankAccountStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"


# =========================
# WALLET MODELS
# =========================

class MasterWallet(BaseModel):
    """Platform-level master wallet"""
    id: str = Field(default_factory=lambda: f"mw_{uuid.uuid4().hex[:12]}")
    name: str = "Cove Master Wallet"
    total_balance: float = 0.0
    available_balance: float = 0.0
    pending_balance: float = 0.0
    currency: str = "ZMW"
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SubAccount(BaseModel):
    """Company-level sub-account within master wallet"""
    id: str = Field(default_factory=lambda: f"sa_{uuid.uuid4().hex[:12]}")
    master_wallet_id: str
    company_id: str
    company_name: str
    
    # Balances
    available_balance: float = 0.0
    pending_balance: float = 0.0
    reserved_balance: float = 0.0  # For scheduled payouts
    currency: str = "ZMW"
    
    # Subscription & Limits
    subscription_tier: SubscriptionTier = SubscriptionTier.BASIC
    daily_payout_limit: float = 50000.0  # ZMW - Basic tier
    monthly_payout_limit: float = 500000.0
    daily_payout_used: float = 0.0
    monthly_payout_used: float = 0.0
    
    # Status
    status: str = "active"
    kyc_verified: bool = False
    aml_cleared: bool = False
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: Optional[datetime] = None


class SubAccountCreate(BaseModel):
    company_id: str
    company_name: str
    subscription_tier: SubscriptionTier = SubscriptionTier.BASIC
    currency: str = "ZMW"


# =========================
# TRANSACTION MODELS
# =========================

class WalletTransaction(BaseModel):
    """Individual wallet transaction"""
    id: str = Field(default_factory=lambda: f"wtx_{uuid.uuid4().hex[:12]}")
    sub_account_id: str
    company_id: str
    
    # Transaction details
    type: TransactionType
    amount: float
    currency: str = "ZMW"
    fee: float = 0.0
    net_amount: float = 0.0  # amount - fee
    
    # Status
    status: TransactionStatus = TransactionStatus.PENDING
    
    # Payment provider info
    provider: Optional[str] = None  # cgrate, dpo, flutterwave
    provider_reference: Optional[str] = None
    provider_response: Optional[Dict[str, Any]] = None
    
    # Reference & Description
    reference: str = Field(default_factory=lambda: f"REF-{uuid.uuid4().hex[:8].upper()}")
    description: Optional[str] = None
    narration: Optional[str] = None
    
    # For payouts
    recipient_bank_code: Optional[str] = None
    recipient_account_number: Optional[str] = None
    recipient_account_name: Optional[str] = None
    
    # Idempotency
    idempotency_key: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    # Balance snapshot
    balance_before: float = 0.0
    balance_after: float = 0.0


class FundRequest(BaseModel):
    """Request to fund wallet (receive payment)"""
    amount: float
    currency: str = "ZMW"
    customer_email: str
    description: Optional[str] = None
    callback_url: Optional[str] = None
    idempotency_key: Optional[str] = None


class PayoutRequest(BaseModel):
    """Request to execute payout (Premium tier only)"""
    amount: float
    currency: str = "ZMW"
    bank_code: str
    account_number: str
    account_name: str
    narration: Optional[str] = None
    scheduled_date: Optional[datetime] = None  # For scheduled payouts
    idempotency_key: Optional[str] = None


class TransferRequest(BaseModel):
    """Internal transfer between sub-accounts"""
    from_sub_account_id: str
    to_sub_account_id: str
    amount: float
    description: Optional[str] = None


# =========================
# BANK ACCOUNT MODELS
# =========================

class LinkedBankAccount(BaseModel):
    """Bank account linked for funding"""
    id: str = Field(default_factory=lambda: f"ba_{uuid.uuid4().hex[:12]}")
    sub_account_id: str
    company_id: str
    
    # Bank details (tokenized/masked for security)
    bank_code: str
    bank_name: str
    account_number_masked: str  # e.g., "****1234"
    account_number_hash: str    # SHA256 hash for verification
    account_name: str
    
    # Verification
    status: BankAccountStatus = BankAccountStatus.PENDING
    verified_at: Optional[datetime] = None
    verification_method: str = "aggregator"  # aggregator, micro_deposit
    
    # Provider info
    provider: str  # cgrate, dpo, flutterwave
    provider_reference: Optional[str] = None
    
    # Metadata
    is_primary: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LinkBankRequest(BaseModel):
    """Request to link a bank account"""
    bank_code: str
    account_number: str
    account_name: str
    set_as_primary: bool = False


# =========================
# LEDGER MODELS
# =========================

class LedgerEntry(BaseModel):
    """Double-entry ledger for audit trail"""
    id: str = Field(default_factory=lambda: f"led_{uuid.uuid4().hex[:12]}")
    transaction_id: str
    sub_account_id: str
    
    # Entry type
    entry_type: str  # debit, credit
    account_type: str  # available, pending, reserved, fee
    
    # Amounts
    debit: float = 0.0
    credit: float = 0.0
    balance_after: float = 0.0
    
    # Metadata
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


# =========================
# WEBHOOK MODELS
# =========================

class WebhookEvent(BaseModel):
    """Webhook event for external notifications"""
    id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    sub_account_id: str
    company_id: str
    
    event_type: str  # wallet.funded, wallet.payout_completed, wallet.payout_failed
    payload: Dict[str, Any]
    
    # Delivery status
    delivered: bool = False
    delivery_attempts: int = 0
    last_attempt_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WebhookConfig(BaseModel):
    """Webhook configuration per sub-account"""
    id: str = Field(default_factory=lambda: f"whc_{uuid.uuid4().hex[:12]}")
    sub_account_id: str
    company_id: str
    
    url: str
    secret: str = Field(default_factory=lambda: uuid.uuid4().hex)
    events: List[str] = ["wallet.funded", "wallet.payout_completed", "wallet.payout_failed"]
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


# =========================
# RESPONSE MODELS
# =========================

class WalletBalance(BaseModel):
    """Balance response"""
    sub_account_id: str
    company_id: str
    available_balance: float
    pending_balance: float
    reserved_balance: float
    currency: str
    subscription_tier: str
    daily_payout_remaining: float
    monthly_payout_remaining: float
    last_updated: datetime


class TransactionResponse(BaseModel):
    """Transaction response"""
    id: str
    type: str
    amount: float
    fee: float
    net_amount: float
    currency: str
    status: str
    reference: str
    provider: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]


class PaymentLinkResponse(BaseModel):
    """Payment link for funding"""
    transaction_id: str
    payment_url: str
    reference: str
    amount: float
    currency: str
    expires_at: datetime
    provider: str


# =========================
# TIER CONFIGURATION
# =========================

TIER_CONFIG = {
    SubscriptionTier.BASIC: {
        "name": "Basic",
        "features": ["view_balance", "receive_payments", "transaction_history"],
        "daily_payout_limit": 0,  # No payouts
        "monthly_payout_limit": 0,
        "api_access": False,
        "scheduled_payments": False,
        "multi_currency": False,
        "fee_percentage": 2.5
    },
    SubscriptionTier.PREMIUM: {
        "name": "Premium",
        "features": [
            "view_balance", 
            "receive_payments", 
            "transaction_history",
            "execute_payouts",
            "scheduled_payments",
            "api_access",
            "multi_currency",
            "webhook_notifications",
            "bulk_payouts"
        ],
        "daily_payout_limit": 500000,  # ZMW
        "monthly_payout_limit": 5000000,
        "api_access": True,
        "scheduled_payments": True,
        "multi_currency": True,
        "fee_percentage": 1.5
    }
}
