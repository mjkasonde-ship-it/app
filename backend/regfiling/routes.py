"""
CoveRegFiling - API Routes
Reminders, form prep, fee calc, PO gen, wallet payment
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import Optional, List
from datetime import datetime, date, timedelta
import logging

from .models import (
    RegFiling, PaymentOrder, AuthorizationAudit,
    FilingStatus, FilingPriority, PaymentOrderStatus,
    FilingReminderRequest, FormPrepareRequest, FormApprovalRequest,
    FeeCalculationRequest, GeneratePORequest, AuthorizePORequest,
    ExecutePaymentRequest, PaymentPrioritizationResult,
    REGULATORY_FEES, AUTHORITY_BANK_DETAILS
)

logger = logging.getLogger(__name__)

regfiling_router = APIRouter(prefix="/regfiling", tags=["Regulatory Filing"])

# In-memory storage (replace with MongoDB in production)
filings_db = {}
payment_orders_db = {}
audit_log_db = []


def get_priority_score(filing: RegFiling) -> int:
    """Calculate priority score for payment ordering"""
    score = 0
    
    # Base score by priority
    priority_scores = {
        FilingPriority.CRITICAL: 1000,
        FilingPriority.HIGH: 750,
        FilingPriority.MEDIUM: 500,
        FilingPriority.LOW: 250
    }
    score += priority_scores.get(filing.priority, 500)
    
    # Add penalty amount impact
    if filing.calculated_penalty > 0:
        score += min(500, int(filing.calculated_penalty / 100))
    
    # Add urgency based on due date
    days_until_due = (filing.due_date - date.today()).days
    if days_until_due < 0:  # Overdue
        score += 500 + abs(days_until_due) * 10
    elif days_until_due <= 7:
        score += 300
    elif days_until_due <= 14:
        score += 150
    
    return score


# =========================
# FILING MANAGEMENT
# =========================

@regfiling_router.get("/filings/{company_id}")
async def get_company_filings(
    company_id: str,
    status: Optional[FilingStatus] = None,
    due_within_days: Optional[int] = None
):
    """Get all filings for a company"""
    filings = [f for f in filings_db.values() if f.company_id == company_id]
    
    if status:
        filings = [f for f in filings if f.status == status]
    
    if due_within_days:
        cutoff = date.today() + timedelta(days=due_within_days)
        filings = [f for f in filings if f.due_date <= cutoff]
    
    # Sort by due date
    filings.sort(key=lambda x: x.due_date)
    
    return {
        "total": len(filings),
        "filings": [f.model_dump() for f in filings]
    }


@regfiling_router.get("/filings/{company_id}/upcoming")
async def get_upcoming_filings(company_id: str, days: int = 30):
    """Get filings due in the next N days"""
    cutoff = date.today() + timedelta(days=days)
    filings = [
        f for f in filings_db.values() 
        if f.company_id == company_id 
        and f.due_date <= cutoff
        and f.status not in [FilingStatus.COMPLETED, FilingStatus.FILED]
    ]
    
    filings.sort(key=lambda x: x.due_date)
    
    # Categorize
    overdue = [f for f in filings if f.due_date < date.today()]
    due_soon = [f for f in filings if date.today() <= f.due_date <= date.today() + timedelta(days=7)]
    upcoming = [f for f in filings if f.due_date > date.today() + timedelta(days=7)]
    
    return {
        "overdue": [f.model_dump() for f in overdue],
        "due_soon": [f.model_dump() for f in due_soon],
        "upcoming": [f.model_dump() for f in upcoming],
        "total": len(filings)
    }


@regfiling_router.post("/filings/create")
async def create_filing(filing: RegFiling):
    """Create a new filing record"""
    # Set initial status based on due date
    days_until_due = (filing.due_date - date.today()).days
    if days_until_due < 0:
        filing.status = FilingStatus.OVERDUE
        filing.priority = FilingPriority.CRITICAL
    elif days_until_due <= 7:
        filing.status = FilingStatus.DUE_SOON
        filing.priority = FilingPriority.HIGH
    else:
        filing.status = FilingStatus.UPCOMING
    
    filings_db[filing.id] = filing
    logger.info(f"Created filing {filing.id} for company {filing.company_id}")
    
    return filing


# =========================
# REMINDERS
# =========================

@regfiling_router.post("/reminders/send")
async def send_filing_reminders(
    request: FilingReminderRequest,
    background_tasks: BackgroundTasks
):
    """Send reminders for upcoming filings"""
    cutoff = date.today() + timedelta(days=request.days_ahead)
    
    filings_to_remind = [
        f for f in filings_db.values()
        if f.company_id == request.company_id
        and f.due_date <= cutoff
        and f.status not in [FilingStatus.COMPLETED, FilingStatus.FILED, FilingStatus.PAID]
    ]
    
    reminders_sent = []
    
    for filing in filings_to_remind:
        days_until_due = (filing.due_date - date.today()).days
        
        # Determine reminder urgency
        if days_until_due < 0:
            urgency = "OVERDUE"
            message = f"URGENT: {filing.title} is {abs(days_until_due)} days overdue!"
        elif days_until_due <= 3:
            urgency = "CRITICAL"
            message = f"CRITICAL: {filing.title} is due in {days_until_due} days!"
        elif days_until_due <= 7:
            urgency = "HIGH"
            message = f"REMINDER: {filing.title} is due in {days_until_due} days"
        else:
            urgency = "NOTICE"
            message = f"Upcoming: {filing.title} is due on {filing.due_date}"
        
        reminder = {
            "filing_id": filing.id,
            "title": filing.title,
            "authority": filing.authority_name,
            "due_date": filing.due_date.isoformat(),
            "days_until_due": days_until_due,
            "urgency": urgency,
            "message": message,
            "estimated_fee": filing.total_amount or filing.base_fee
        }
        
        reminders_sent.append(reminder)
        
        # Update filing
        filing.reminder_sent_at = datetime.utcnow()
        filing.reminder_count += 1
        filing.updated_at = datetime.utcnow()
    
    # In production: send via email/notification service
    logger.info(f"Sent {len(reminders_sent)} reminders for company {request.company_id}")
    
    return {
        "reminders_sent": len(reminders_sent),
        "reminders": reminders_sent
    }


# =========================
# FORM PREPARATION
# =========================

@regfiling_router.post("/forms/prepare")
async def prepare_filing_form(request: FormPrepareRequest):
    """Prepare form with company data for approval"""
    filing = filings_db.get(request.filing_id)
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")
    
    # Store form data
    filing.form_data = request.form_data
    filing.form_prepared_at = datetime.utcnow()
    filing.status = FilingStatus.AWAITING_APPROVAL
    filing.updated_at = datetime.utcnow()
    
    return {
        "message": "Form prepared successfully",
        "filing_id": filing.id,
        "status": filing.status.value,
        "form_data": filing.form_data
    }


@regfiling_router.post("/forms/approve")
async def approve_filing_form(request: FormApprovalRequest):
    """Approve prepared form"""
    filing = filings_db.get(request.filing_id)
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")
    
    if filing.status != FilingStatus.AWAITING_APPROVAL:
        raise HTTPException(status_code=400, detail="Form is not awaiting approval")
    
    filing.form_approved_at = datetime.utcnow()
    filing.form_approved_by = request.approved_by
    filing.status = FilingStatus.FORM_PENDING  # Ready for PO
    filing.updated_at = datetime.utcnow()
    
    return {
        "message": "Form approved successfully",
        "filing_id": filing.id,
        "approved_by": request.approved_by,
        "approved_at": filing.form_approved_at.isoformat()
    }


# =========================
# FEE CALCULATION
# =========================

@regfiling_router.post("/fees/calculate")
async def calculate_filing_fees(request: FeeCalculationRequest):
    """Calculate fees including late penalties"""
    filing = filings_db.get(request.filing_id)
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")
    
    calc_date = request.as_of_date or date.today()
    
    # Get fee structure
    authority_fees = REGULATORY_FEES.get(filing.authority_code, {})
    fee_structure = authority_fees.get(filing.filing_type, {
        "base": filing.base_fee,
        "late_rate": filing.late_penalty_rate,
        "max_penalty": filing.max_penalty
    })
    
    base_fee = fee_structure.get("base", 0)
    late_rate = fee_structure.get("late_rate", 0)
    max_penalty = fee_structure.get("max_penalty")
    
    # Calculate penalty if overdue
    penalty = 0.0
    days_overdue = (calc_date - filing.due_date).days
    
    if days_overdue > 0:
        # Monthly penalty rate
        months_overdue = max(1, days_overdue / 30)
        penalty = base_fee * late_rate * months_overdue
        
        # Apply max cap if specified
        if max_penalty:
            penalty = min(penalty, max_penalty)
    
    total = base_fee + penalty
    
    # Update filing
    filing.base_fee = base_fee
    filing.calculated_penalty = penalty
    filing.total_amount = total
    filing.updated_at = datetime.utcnow()
    
    # Update priority if penalty is high
    if penalty > base_fee:
        filing.priority = FilingPriority.CRITICAL
    elif penalty > 0:
        filing.priority = FilingPriority.HIGH
    
    return {
        "filing_id": filing.id,
        "calculation_date": calc_date.isoformat(),
        "days_overdue": max(0, days_overdue),
        "base_fee": base_fee,
        "late_penalty_rate": late_rate,
        "calculated_penalty": penalty,
        "total_amount": total,
        "currency": "ZMW",
        "priority": filing.priority.value
    }


# =========================
# PAYMENT ORDER GENERATION
# =========================

@regfiling_router.post("/po/generate")
async def generate_payment_order(request: GeneratePORequest):
    """Generate Payment Order for filing"""
    filing = filings_db.get(request.filing_id)
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")
    
    # Ensure fees are calculated
    if filing.total_amount == 0:
        raise HTTPException(status_code=400, detail="Calculate fees first")
    
    # Get authority bank details
    bank_details = AUTHORITY_BANK_DETAILS.get(filing.authority_code)
    
    # Create Payment Order
    po = PaymentOrder(
        company_id=filing.company_id,
        filing_id=filing.id,
        obligation_title=filing.title,
        obligation_reference=f"{filing.authority_name} - {filing.filing_type}",
        authority_name=filing.authority_name,
        authority_code=filing.authority_code,
        authority_bank_details=bank_details,
        base_fee=filing.base_fee,
        penalty_amount=filing.calculated_penalty if request.include_penalty else 0,
        total_amount=filing.total_amount if request.include_penalty else filing.base_fee,
        priority=filing.priority,
        penalty_description=f"Late penalty: {filing.late_penalty_rate * 100}% per month" if filing.calculated_penalty > 0 else "",
        non_compliance_consequences=f"Failure to pay may result in license suspension, additional penalties up to ZMW {filing.max_penalty or 'unlimited'}, and potential prosecution."
    )
    
    payment_orders_db[po.id] = po
    
    # Update filing
    filing.payment_order_id = po.id
    filing.status = FilingStatus.PO_GENERATED
    filing.updated_at = datetime.utcnow()
    
    logger.info(f"Generated PO {po.po_number} for filing {filing.id}")
    
    return {
        "message": "Payment Order generated",
        "payment_order": po.model_dump()
    }


@regfiling_router.get("/po/{company_id}")
async def get_payment_orders(
    company_id: str,
    status: Optional[PaymentOrderStatus] = None
):
    """Get all payment orders for a company"""
    orders = [po for po in payment_orders_db.values() if po.company_id == company_id]
    
    if status:
        orders = [po for po in orders if po.status == status]
    
    # Sort by priority and creation date
    orders.sort(key=lambda x: (-get_priority_score(filings_db.get(x.filing_id, RegFiling(
        company_id="", obligation_id="", filing_type="", title="", description="",
        authority_name="", authority_code="", due_date=date.today()
    ))), x.created_at))
    
    return {
        "total": len(orders),
        "payment_orders": [po.model_dump() for po in orders]
    }


@regfiling_router.get("/po/detail/{po_id}")
async def get_payment_order_detail(po_id: str):
    """Get detailed PO information"""
    po = payment_orders_db.get(po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Payment Order not found")
    
    filing = filings_db.get(po.filing_id)
    
    return {
        "payment_order": po.model_dump(),
        "filing": filing.model_dump() if filing else None,
        "audit_trail": [
            a.model_dump() for a in audit_log_db 
            if a.payment_order_id == po_id
        ]
    }


# =========================
# AUTHORIZATION
# =========================

@regfiling_router.post("/po/authorize")
async def authorize_payment_order(request: AuthorizePORequest, req: Request):
    """Authorize PO with timestamped audit trail"""
    po = payment_orders_db.get(request.payment_order_id)
    if not po:
        raise HTTPException(status_code=404, detail="Payment Order not found")
    
    if po.status not in [PaymentOrderStatus.DRAFT, PaymentOrderStatus.PENDING_AUTH]:
        raise HTTPException(status_code=400, detail=f"Cannot authorize PO in status: {po.status}")
    
    # Get client info for audit
    client_ip = req.client.host if req.client else "unknown"
    user_agent = req.headers.get("user-agent", "unknown")
    
    # Create audit record
    audit = AuthorizationAudit(
        payment_order_id=po.id,
        company_id=po.company_id,
        action="authorize",
        user_id=request.user_id,
        user_name=request.authorized_by,
        user_email=request.user_email,
        user_role=request.user_role,
        ip_address=client_ip,
        user_agent=user_agent,
        details={
            "po_number": po.po_number,
            "amount": po.total_amount,
            "authority": po.authority_name
        }
    )
    audit_log_db.append(audit)
    
    # Update PO
    po.status = PaymentOrderStatus.AUTHORIZED
    po.authorized_by = request.authorized_by
    po.authorized_at = datetime.utcnow()
    po.auth_ip_address = client_ip
    po.auth_user_agent = user_agent
    po.updated_at = datetime.utcnow()
    
    logger.info(f"PO {po.po_number} authorized by {request.authorized_by} from {client_ip}")
    
    return {
        "message": "Payment Order authorized",
        "po_number": po.po_number,
        "authorized_by": request.authorized_by,
        "authorized_at": po.authorized_at.isoformat(),
        "audit_id": audit.id
    }


# =========================
# PAYMENT EXECUTION
# =========================

@regfiling_router.post("/po/pay")
async def execute_payment(request: ExecutePaymentRequest):
    """Execute payment via wallet"""
    po = payment_orders_db.get(request.payment_order_id)
    if not po:
        raise HTTPException(status_code=404, detail="Payment Order not found")
    
    if po.status != PaymentOrderStatus.AUTHORIZED:
        raise HTTPException(status_code=400, detail="PO must be authorized before payment")
    
    po.status = PaymentOrderStatus.PROCESSING
    po.updated_at = datetime.utcnow()
    
    if request.use_wallet:
        # Import wallet integration
        try:
            from wallet.routes import get_sub_account, sub_accounts_db
            
            sub_account = get_sub_account(po.company_id)
            if not sub_account:
                raise HTTPException(status_code=404, detail="Wallet sub-account not found")
            
            # Check balance
            if sub_account.available_balance < po.total_amount:
                po.status = PaymentOrderStatus.AUTHORIZED  # Revert
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient wallet balance. Available: {sub_account.available_balance}, Required: {po.total_amount}"
                )
            
            # Deduct from wallet (simplified - in production use proper payout flow)
            sub_account.available_balance -= po.total_amount
            sub_account.updated_at = datetime.utcnow()
            
            po.status = PaymentOrderStatus.PAID
            po.payment_executed_at = datetime.utcnow()
            po.wallet_transaction_id = f"wtx_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            po.payment_status = "completed"
            
            # Update filing
            filing = filings_db.get(po.filing_id)
            if filing:
                filing.status = FilingStatus.PAID
                filing.paid_at = datetime.utcnow()
                filing.payment_reference = po.wallet_transaction_id
                filing.updated_at = datetime.utcnow()
            
            logger.info(f"Payment executed for PO {po.po_number} via wallet")
            
            return {
                "message": "Payment executed successfully",
                "po_number": po.po_number,
                "amount_paid": po.total_amount,
                "transaction_id": po.wallet_transaction_id,
                "new_balance": sub_account.available_balance
            }
            
        except ImportError:
            po.status = PaymentOrderStatus.AUTHORIZED
            raise HTTPException(status_code=500, detail="Wallet module not available")
    else:
        # Manual payment - mark as pending external payment
        return {
            "message": "Manual payment required",
            "po_number": po.po_number,
            "amount": po.total_amount,
            "bank_details": po.authority_bank_details
        }


# =========================
# PAYMENT PRIORITIZATION
# =========================

@regfiling_router.post("/payments/prioritize/{company_id}")
async def prioritize_payments(company_id: str) -> PaymentPrioritizationResult:
    """
    Prioritize pending payments when funds are low
    Orders by penalty/criticality
    """
    # Get wallet balance
    try:
        from wallet.routes import get_sub_account
        sub_account = get_sub_account(company_id)
        available_balance = sub_account.available_balance if sub_account else 0
    except:
        available_balance = 0
    
    # Get pending POs
    pending_pos = [
        po for po in payment_orders_db.values()
        if po.company_id == company_id
        and po.status in [PaymentOrderStatus.AUTHORIZED, PaymentOrderStatus.PENDING_AUTH]
    ]
    
    # Calculate priority scores
    scored_pos = []
    for po in pending_pos:
        filing = filings_db.get(po.filing_id)
        if filing:
            score = get_priority_score(filing)
        else:
            score = 500  # Default medium priority
        
        scored_pos.append({
            "payment_order": po.model_dump(),
            "priority_score": score,
            "days_overdue": (date.today() - filings_db.get(po.filing_id, RegFiling(
                company_id="", obligation_id="", filing_type="", title="", description="",
                authority_name="", authority_code="", due_date=date.today()
            )).due_date).days if po.filing_id in filings_db else 0
        })
    
    # Sort by priority score (highest first)
    scored_pos.sort(key=lambda x: -x["priority_score"])
    
    # Determine what can be paid
    total_pending = sum(po["payment_order"]["total_amount"] for po in scored_pos)
    
    prioritized = []
    deferred = []
    running_total = 0
    
    for po_info in scored_pos:
        amount = po_info["payment_order"]["total_amount"]
        if running_total + amount <= available_balance:
            prioritized.append(po_info)
            running_total += amount
        else:
            deferred.append(po_info)
    
    shortfall = max(0, total_pending - available_balance)
    
    # Generate recommendation
    if shortfall == 0:
        recommendation = "Sufficient funds available for all pending payments."
    elif len(prioritized) > 0:
        recommendation = f"Fund wallet with at least ZMW {shortfall:,.2f} to cover all payments. " \
                        f"Alternatively, process {len(prioritized)} high-priority payments now " \
                        f"and defer {len(deferred)} lower-priority payments."
    else:
        recommendation = f"Insufficient funds. Add at least ZMW {scored_pos[0]['payment_order']['total_amount']:,.2f} " \
                        f"to process the most critical payment."
    
    return PaymentPrioritizationResult(
        available_balance=available_balance,
        total_pending=total_pending,
        shortfall=shortfall,
        prioritized_orders=prioritized,
        deferred_orders=deferred,
        recommendation=recommendation
    )


# =========================
# AUDIT TRAIL
# =========================

@regfiling_router.get("/audit/{company_id}")
async def get_audit_trail(
    company_id: str,
    po_id: Optional[str] = None,
    action: Optional[str] = None
):
    """Get audit trail for authorization clicks"""
    audits = [a for a in audit_log_db if a.company_id == company_id]
    
    if po_id:
        audits = [a for a in audits if a.payment_order_id == po_id]
    
    if action:
        audits = [a for a in audits if a.action == action]
    
    # Sort by timestamp desc
    audits.sort(key=lambda x: x.timestamp, reverse=True)
    
    return {
        "total": len(audits),
        "audit_records": [a.model_dump() for a in audits]
    }


# =========================
# SEED TEST DATA
# =========================

@regfiling_router.post("/seed-test-data/{company_id}")
async def seed_test_filings(company_id: str):
    """Seed test filing data for demo"""
    test_filings = [
        RegFiling(
            company_id=company_id,
            obligation_id="obl-1",
            filing_type="annual_return",
            title="PACRA Annual Return",
            description="Submit annual return to Patents and Companies Registration Agency",
            authority_name="PACRA",
            authority_code="PACRA",
            due_date=date.today() + timedelta(days=5),
            base_fee=150,
            late_penalty_rate=0.25,
            max_penalty=5000,
            priority=FilingPriority.HIGH
        ),
        RegFiling(
            company_id=company_id,
            obligation_id="obl-2",
            filing_type="corporate_tax",
            title="Corporate Tax Return - Q4 2025",
            description="Quarterly corporate tax filing with ZRA",
            authority_name="Zambia Revenue Authority",
            authority_code="ZRA",
            due_date=date.today() - timedelta(days=10),  # Overdue
            base_fee=0,
            calculated_fee=25000,  # Tax amount
            late_penalty_rate=0.05,
            priority=FilingPriority.CRITICAL
        ),
        RegFiling(
            company_id=company_id,
            obligation_id="obl-3",
            filing_type="mining_license_renewal",
            title="Mining License Renewal",
            description="Annual mining license renewal with Ministry of Mines",
            authority_name="Ministry of Mines",
            authority_code="Ministry_of_Mines",
            due_date=date.today() + timedelta(days=30),
            base_fee=25000,
            late_penalty_rate=0.20,
            max_penalty=500000,
            priority=FilingPriority.HIGH
        ),
        RegFiling(
            company_id=company_id,
            obligation_id="obl-4",
            filing_type="environmental_audit",
            title="Annual Environmental Audit",
            description="Submit environmental compliance audit to ZEMA",
            authority_name="ZEMA",
            authority_code="ZEMA",
            due_date=date.today() + timedelta(days=45),
            base_fee=5000,
            late_penalty_rate=0.10,
            max_penalty=50000,
            priority=FilingPriority.MEDIUM
        ),
        RegFiling(
            company_id=company_id,
            obligation_id="obl-5",
            filing_type="contribution",
            title="NAPSA Contributions - February",
            description="Monthly pension contributions to NAPSA",
            authority_name="NAPSA",
            authority_code="NAPSA",
            due_date=date.today() + timedelta(days=3),
            base_fee=0,
            calculated_fee=15000,  # Contribution amount
            late_penalty_rate=0.10,
            priority=FilingPriority.HIGH
        ),
    ]
    
    for filing in test_filings:
        # Calculate fees
        days_overdue = (date.today() - filing.due_date).days
        if days_overdue > 0:
            filing.status = FilingStatus.OVERDUE
            penalty = filing.base_fee * filing.late_penalty_rate * max(1, days_overdue / 30)
            if filing.max_penalty:
                penalty = min(penalty, filing.max_penalty)
            filing.calculated_penalty = penalty
        filing.total_amount = (filing.calculated_fee or filing.base_fee) + filing.calculated_penalty
        
        filings_db[filing.id] = filing
    
    return {
        "message": f"Seeded {len(test_filings)} test filings",
        "filings": [f.model_dump() for f in test_filings]
    }
