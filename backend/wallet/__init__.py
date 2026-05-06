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
    TIER_CONFIG,
    PullOrder,
    PullOrderStatus,
    PullOrderApprovalAudit,
    CreatePullOrderRequest,
    ApprovePullOrderRequest,
    RejectPullOrderRequest,
)

from .adapters import (
    PaymentAggregator,
    CGrateAdapter,
    DPOAdapter,
    FlutterwaveAdapter,
    PaymentProvider,
)

# New layered architecture: router → service → repository
from .router import wallet_router
from .repository import WalletRepositories, ensure_wallet_indexes

__all__ = [
    # Router (mount in server.py)
    "wallet_router",
    # Repository bootstrap
    "WalletRepositories",
    "ensure_wallet_indexes",
    # Domain models
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
    "PullOrder",
    "PullOrderStatus",
    "PullOrderApprovalAudit",
    "CreatePullOrderRequest",
    "ApprovePullOrderRequest",
    "RejectPullOrderRequest",
    # Adapters
    "PaymentAggregator",
    "CGrateAdapter",
    "DPOAdapter",
    "FlutterwaveAdapter",
    "PaymentProvider",
]
