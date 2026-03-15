"""
CoveRegFiling - Automated Regulatory Filing Module
Monthly reminders, form prep, fee calc, PO generation, wallet payment
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid


class FilingStatus(str, Enum):
    UPCOMING = "upcoming"
    DUE_SOON = "due_soon"       # Within 7 days
    OVERDUE = "overdue"
    FORM_PENDING = "form_pending"
    AWAITING_APPROVAL = "awaiting_approval"
    PO_GENERATED = "po_generated"
    PAYMENT_PENDING = "payment_pending"
    PAID = "paid"
    FILED = "filed"
    COMPLETED = "completed"


class FilingPriority(str, Enum):
    CRITICAL = "critical"      # Highest penalty, immediate action
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class PaymentOrderStatus(str, Enum):
    DRAFT = "draft"
    PENDING_AUTH = "pending_auth"
    AUTHORIZED = "authorized"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"


# =========================
# FILING MODELS
# =========================

class RegFiling(BaseModel):
    """Regulatory filing record"""
    id: str = Field(default_factory=lambda: f"fil_{uuid.uuid4().hex[:12]}")
    company_id: str
    obligation_id: str
    
    # Filing details
    filing_type: str  # annual_return, tax_filing, license_renewal, etc.
    title: str
    description: str
    
    # Authority info
    authority_name: str
    authority_code: str
    
    # Dates
    due_date: date
    filing_period_start: Optional[date] = None
    filing_period_end: Optional[date] = None
    
    # Status
    status: FilingStatus = FilingStatus.UPCOMING
    priority: FilingPriority = FilingPriority.MEDIUM
    
    # Fees & Penalties
    base_fee: float = 0.0
    late_penalty_rate: float = 0.0  # Percentage per month
    max_penalty: Optional[float] = None
    calculated_fee: float = 0.0
    calculated_penalty: float = 0.0
    total_amount: float = 0.0
    
    # Form preparation
    form_template_id: Optional[str] = None
    form_data: Optional[Dict[str, Any]] = None
    form_prepared_at: Optional[datetime] = None
    form_approved_at: Optional[datetime] = None
    form_approved_by: Optional[str] = None
    
    # Payment
    payment_order_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    
    # Filing
    filed_at: Optional[datetime] = None
    filing_reference: Optional[str] = None
    
    # Reminders
    reminder_sent_at: Optional[datetime] = None
    reminder_count: int = 0
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PaymentOrder(BaseModel):
    """Payment Order for regulatory filing"""
    id: str = Field(default_factory=lambda: f"po_{uuid.uuid4().hex[:12]}")
    company_id: str
    filing_id: str
    
    # PO Details
    po_number: str = Field(default_factory=lambda: f"PO-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}")
    
    # Obligation info (from filing)
    obligation_title: str
    obligation_reference: str  # Statute & section
    authority_name: str
    authority_code: str
    authority_bank_details: Optional[Dict[str, str]] = None
    
    # Amounts
    base_fee: float
    penalty_amount: float = 0.0
    total_amount: float
    currency: str = "ZMW"
    
    # Penalty info (for display)
    penalty_description: str = ""
    non_compliance_consequences: str = ""
    
    # Status
    status: PaymentOrderStatus = PaymentOrderStatus.DRAFT
    priority: FilingPriority = FilingPriority.MEDIUM
    
    # Authorization
    auth_required: bool = True
    authorized_by: Optional[str] = None
    authorized_at: Optional[datetime] = None
    auth_ip_address: Optional[str] = None
    auth_user_agent: Optional[str] = None
    
    # Payment execution
    wallet_transaction_id: Optional[str] = None
    payment_executed_at: Optional[datetime] = None
    payment_status: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AuthorizationAudit(BaseModel):
    """Audit trail for PO authorizations"""
    id: str = Field(default_factory=lambda: f"aud_{uuid.uuid4().hex[:12]}")
    payment_order_id: str
    company_id: str
    
    # Action
    action: str  # authorize, revoke, modify, pay
    
    # User info
    user_id: str
    user_name: str
    user_email: str
    user_role: str
    
    # Context
    ip_address: str
    user_agent: str
    
    # Details
    details: Dict[str, Any] = {}
    
    # Timestamp (critical for audit)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# =========================
# REQUEST/RESPONSE MODELS
# =========================

class FilingReminderRequest(BaseModel):
    company_id: str
    days_ahead: int = 30  # Send reminders for filings due in next N days


class FormPrepareRequest(BaseModel):
    filing_id: str
    form_data: Dict[str, Any]


class FormApprovalRequest(BaseModel):
    filing_id: str
    approved_by: str
    approval_notes: Optional[str] = None


class FeeCalculationRequest(BaseModel):
    filing_id: str
    as_of_date: Optional[date] = None  # Calculate fees as of this date


class GeneratePORequest(BaseModel):
    filing_id: str
    include_penalty: bool = True


class AuthorizePORequest(BaseModel):
    payment_order_id: str
    authorized_by: str
    user_id: str
    user_email: str
    user_role: str


class ExecutePaymentRequest(BaseModel):
    payment_order_id: str
    use_wallet: bool = True


class PaymentPrioritizationResult(BaseModel):
    """Result of payment prioritization when funds are low"""
    available_balance: float
    total_pending: float
    shortfall: float
    prioritized_orders: List[Dict[str, Any]]  # Ordered by penalty/criticality
    deferred_orders: List[Dict[str, Any]]     # Cannot be paid now
    recommendation: str


# =========================
# FEE CALCULATION
# =========================

# Zambian regulatory fees database
REGULATORY_FEES = {
    "PACRA": {
        "annual_return": {"base": 150, "late_rate": 0.25, "max_penalty": 5000},
        "name_change": {"base": 500, "late_rate": 0, "max_penalty": 0},
    },
    "ZRA": {
        "corporate_tax": {"base": 0, "late_rate": 0.05, "max_penalty": None},  # Percentage of tax due
        "vat_return": {"base": 0, "late_rate": 0.05, "max_penalty": None},
        "paye_return": {"base": 0, "late_rate": 0.05, "max_penalty": None},
    },
    "NAPSA": {
        "contribution": {"base": 0, "late_rate": 0.10, "max_penalty": None},
    },
    "WCFCB": {
        "insurance_renewal": {"base": 500, "late_rate": 0.15, "max_penalty": 200000},
    },
    "ZEMA": {
        "environmental_audit": {"base": 5000, "late_rate": 0.10, "max_penalty": 50000},
        "eia_submission": {"base": 10000, "late_rate": 0.15, "max_penalty": 100000},
    },
    "Ministry_of_Mines": {
        "mining_license_renewal": {"base": 25000, "late_rate": 0.20, "max_penalty": 500000},
        "quarterly_production_report": {"base": 1000, "late_rate": 0.10, "max_penalty": 50000},
    },
}

# Authority bank details for payments
AUTHORITY_BANK_DETAILS = {
    "PACRA": {
        "bank_name": "Zanaco",
        "account_number": "0010100012345",
        "branch": "Cairo Road",
        "reference_format": "PACRA-{company_reg}-{year}"
    },
    "ZRA": {
        "bank_name": "Bank of Zambia",
        "account_number": "ZRA-COLLECTIONS",
        "reference_format": "TPIN-{tax_id}-{period}"
    },
    "NAPSA": {
        "bank_name": "Stanbic Bank",
        "account_number": "9130001234567",
        "reference_format": "NAPSA-{company_id}-{month}"
    },
}
