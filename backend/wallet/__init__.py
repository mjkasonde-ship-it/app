"""
CoveSmartWallet Package
Programmable payment wallet with multi-provider support
"""

from .models import (
    SubAccount,
    SubAccountCreate,
    WalletTransaction,
    WalletBalance,
    FundRequest,
    PayoutRequest,
    LinkedBankAccount,
    SubscriptionTier,
    TransactionType,
    TransactionStatus,
    TIER_CONFIG
)

from .adapters import (
    PaymentAggregator,
    CGrateAdapter,
    DPOAdapter,
    FlutterwaveAdapter,
    PaymentProvider
)

from .routes import wallet_router

__all__ = [
    "wallet_router",
    "SubAccount",
    "SubAccountCreate", 
    "WalletTransaction",
    "WalletBalance",
    "FundRequest",
    "PayoutRequest",
    "LinkedBankAccount",
    "SubscriptionTier",
    "TransactionType",
    "TransactionStatus",
    "TIER_CONFIG",
    "PaymentAggregator",
    "CGrateAdapter",
    "DPOAdapter",
    "FlutterwaveAdapter",
    "PaymentProvider"
]
