"""
CoveRegFiling - API Routes
Reminders, form prep, fee calc, PO gen, wallet payment

Fully migrated to async MongoDB - no more in-memory dicts.
All collections accessed via get_db() populated by set_db() on startup.
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Depends
from auth import get_current_user, require_min_role
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

# ---------------------------------------------------------------------------
# DB accessor
# ---------------------------------------------------------------------------
_db = None


def set_db(database) -> None:
    global _db
    _db = database


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialised")
    return _db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_priority_score(filing: RegFiling) -> int:
    base = {
        FilingPriority.CRITICAL: 100,
        FilingPriority.HIGH: 75,
        FilingPriority.MEDIUM: 50,
        FilingPriority.LOW: 25,
    }.get(filing.priority, 0)
    days = (filing.due_date - date.today()).days
    if days < 0:
        base += 50
    elif days <= 7:
        base += 25
    elif days <= 30:
        base += 10
    return base


def _filing_from_doc(doc: dict) -> RegFiling:
    doc.pop("_id", None)
    return RegFiling(**doc)


def _po_from_doc(doc: dict) -> PaymentOrder:
    doc.pop("_id", None)
    return PaymentOrder(**doc)


# =========================
# FILING MANAGEMENT
# =========================

@regfiling_router.get("/filings/{company_id}")
async def get_company_filings(
    company_id: str,
    status: Optional[FilingStatus] = None,
    due_within_days: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all filings for a company."""
    db = get_db()
    query: dict = {"company_id": company_id}
    if status:
        query["status"] = status.value
    if due_within_days:
        cutoff = (date.today() + timedelta(days=due_within_days)).isoformat()
        query["due_date"] = {"$lte": cutoff}

    cursor = db.filings.find(query).sort("due_date", 1)
    filings = [_filing_from_doc(doc) async for doc in cursor]

    return {"total": len(filings), "filings": [f.model_dump() for f in filings]}


@regfiling_router.get("/filings/{company_id}/upcoming")
async def get_upcoming_filings(
    company_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get filings due in the next N days."""
    db = get_db()
    cutoff_str = (date.today() + timedelta(days=days)).isoformat()

    cursor = db.filings.find({
        "company_id": company_id,
        "due_date": {"$lte": cutoff_str},
        "status": {"$nin": [FilingStatus.COMPLETED.value, FilingStatus.FILED.value]}
    }).sort("due_date", 1)
    filings = [_filing_from_doc(doc) async for doc in cursor]

    today = date.today()
    overdue = [f for f in filings if f.due_date < today]
    due_soon = [f for f in filings if today <= f.due_date <= today + timedelta(days=7)]
    upcoming = [f for f in filings if f.due_date > today + timedelta(days=7)]

    return {
        "overdue": [f.model_dump() for f in overdue],
        "due_soon": [f.model_dump() for f in due_soon],
        "upcoming": [f.model_dump() for f in upcoming],
        "summary": {"total": len(filings), "overdue_count": len(overdue),
                    "due_soon_count": len(due_soon), "upcoming_count": len(upcoming)}
    }


@regfiling_router.post("/filings/create")
async def create_filing(
    filing: RegFiling,
    current_user: dict = Depends(get_current_user)
):
    """Create a new filing record."""
    db = get_db()
    days_until_due = (filing.due_date - date.today()).days
    if days_until_due < 0:
        filing.status = FilingStatus.OVERDUE
        filing.priority = FilingPriority.CRITICAL
    elif days_until_due <= 7:
        filing.status = FilingStatus.DUE_SOON
        filing.priority = FilingPriority.HIGH
    else:
        filing.status = FilingStatus.UPCOMING
    doc = filing.model_dump()
    doc["due_date"] = filing.due_date.isoformat()
    await db.filings.insert_one(doc)
    logger.info("Created filing %s for company %s", filing.id, filing.company_id)
    return filing


# =========================
# REMINDERS
# =========================

@regfiling_router.post("/reminders/send")
async def send_filing_reminders(
    request: FilingReminderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Send reminders for upcoming filings."""
    db = get_db()
    cutoff_str = (date.today() + timedelta(days=request.days_ahead)).isoformat()

    cursor = db.filings.find({
        "company_id": request.company_id,
        "due_date": {"$lte": cutoff_str},
        "status": {"$nin": [FilingStatus.COMPLETED.value, FilingStatus.FILED.value, FilingStatus.PAID.value]}
    })
    filings = [_filing_from_doc(doc) async for doc in cursor]

    reminders_sent = []
    for filing in filings:
        days_until_due = (filing.due_date - date.today()).days
        if days_until_due < 0:
            urgency, message = "OVERDUE", f"URGENT: {filing.title} is {abs(days_until_due)} days overdue"
        elif days_until_due <= 3:
            urgency, message = "CRITICAL", f"CRITICAL: {filing.title} due in {days_until_due} days"
        elif days_until_due <= 7:
            urgency, message = "HIGH", f"REMINDER: {filing.title} due in {days_until_due} days"
        else:
            urgency, message = "UPCOMING", f"Upcoming: {filing.title} due in {days_until_due} days"

        reminders_sent.append({
            "filing_id": filing.id,
            "company_id": filing.company_id,
            "title": filing.title,
            "due_date": filing.due_date.isoformat(),
            "days_until_due": days_until_due,
            "urgency": urgency,
            "message": message,
            "authority": filing.authority_name,
            "estimated_fee": filing.total_amount or filing.base_fee
        })
        background_tasks.add_task(logger.info, "Reminder: filing=%s urgency=%s", filing.id, urgency)

    return {"reminders_sent": len(reminders_sent), "company_id": request.company_id, "reminders": reminders_sent}


# =========================
# FORM PREPARATION
# =========================

@regfiling_router.post("/forms/prepare")
async def prepare_filing_form(
    request: FormPrepareRequest,
    current_user: dict = Depends(get_current_user)
):
    """Prepare pre-filled regulatory form data."""
    db = get_db()
    doc = await db.filings.find_one({"id": request.filing_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Filing not found")
    filing = _filing_from_doc(doc)

    form_data = {
        "form_type": filing.filing_type,
        "authority": filing.authority_name,
        "company_id": filing.company_id,
        "filing_period": request.filing_period,
        "pre_filled_fields": {
            "company_registration": filing.company_id,
            "filing_type": filing.filing_type,
            "authority_code": filing.authority_code,
            "due_date": filing.due_date.isoformat(),
            "reference_number": f"REF-{filing.id[:8].upper()}",
        }
    }

    filing.form_prepared_at = datetime.utcnow()
    filing.form_data = form_data
    filing.status = FilingStatus.PREPARING
    await db.filings.update_one(
        {"id": filing.id},
        {"$set": {"form_prepared_at": filing.form_prepared_at.isoformat(),
                  "form_data": filing.form_data, "status": filing.status.value}}
    )
    return {"message": "Form prepared successfully", "filing_id": filing.id, "form_data": form_data}


@regfiling_router.post("/forms/approve")
async def approve_filing_form(
    request: FormApprovalRequest,
    current_user: dict = Depends(require_min_role("manager"))
):
    """Approve a prepared form (manager-only)."""
    db = get_db()
    doc = await db.filings.find_one({"id": request.filing_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Filing not found")
    filing = _filing_from_doc(doc)
    if filing.status not in [FilingStatus.PREPARING, FilingStatus.PENDING]:
        raise HTTPException(status_code=400, detail="Filing not in an approvable state")

    filing.form_approved_at = datetime.utcnow()
    filing.form_approved_by = request.approved_by
    filing.status = FilingStatus.APPROVED
    await db.filings.update_one(
        {"id": filing.id},
        {"$set": {"form_approved_at": filing.form_approved_at.isoformat(),
                  "form_approved_by": filing.form_approved_by, "status": filing.status.value}}
    )
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
async def calculate_filing_fees(
    request: FeeCalculationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Calculate fees including late penalties."""
    db = get_db()
    doc = await db.filings.find_one({"id": request.filing_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Filing not found")
    filing = _filing_from_doc(doc)

    calc_date = request.as_of_date or date.today()
    authority_fees = REGULATORY_FEES.get(filing.authority_code, {})
    fee_structure = authority_fees.get(filing.filing_type, {
        "base": filing.base_fee,
        "late_rate": filing.late_penalty_rate,
        "max_penalty": filing.max_late_penalty
    })

    base_fee = fee_structure.get("base", filing.base_fee)
    days_overdue = (calc_date - filing.due_date).days if calc_date > filing.due_date else 0
    late_penalty = 0.0
    if days_overdue > 0:
        late_rate = fee_structure.get("late_rate", filing.late_penalty_rate)
        max_penalty = fee_structure.get("max_penalty", filing.max_late_penalty)
        late_penalty = min(base_fee * late_rate * days_overdue, max_penalty)

    total_amount = base_fee + late_penalty
    now_str = datetime.utcnow().isoformat()
    await db.filings.update_one(
        {"id": filing.id},
        {"$set": {"base_fee": base_fee, "late_penalty": late_penalty,
                  "total_amount": total_amount, "fee_calculated_at": now_str}}
    )
    return {
        "filing_id": filing.id, "base_fee": base_fee, "days_overdue": days_overdue,
        "late_penalty": late_penalty, "total_amount": total_amount,
        "currency": "ZMW", "calculated_at": now_str
    }


# =========================
# PAYMENT ORDER GENERATION
# =========================

@regfiling_router.post("/po/generate")
async def generate_payment_order(
    request: GeneratePORequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate Payment Order for filing."""
    db = get_db()
    doc = await db.filings.find_one({"id": request.filing_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Filing not found")
    filing = _filing_from_doc(doc)
    if filing.total_amount == 0:
        raise HTTPException(status_code=400, detail="Calculate fees first")

    bank_details = AUTHORITY_BANK_DETAILS.get(filing.authority_code)
    po = PaymentOrder(
        company_id=filing.company_id,
        filing_id=filing.id,
        obligation_title=filing.title,
        obligation_reference=f"{filing.authority_name} - {filing.filing_type}",
        authority_name=filing.authority_name,
        authority_code=filing.authority_code,
        amount=filing.base_fee,
        late_penalty=filing.late_penalty,
        total_amount=filing.total_amount,
        currency="ZMW",
        due_date=filing.due_date,
        bank_name=bank_details.get("bank_name") if bank_details else None,
        account_number=bank_details.get("account_number") if bank_details else None,
        branch_code=bank_details.get("branch_code") if bank_details else None,
        swift_code=bank_details.get("swift_code") if bank_details else None,
        payment_reference=f"COVE-{filing.id[:8].upper()}-{datetime.utcnow().strftime('%Y%m%d')}"
    )
    po_doc = po.model_dump()
    po_doc["due_date"] = po.due_date.isoformat()
    await db.payment_orders.insert_one(po_doc)
    await db.filings.update_one({"id": filing.id}, {"$set": {"status": FilingStatus.PO_GENERATED.value}})
    logger.info("Generated PO %s for filing %s", po.id, filing.id)
    return po


@regfiling_router.post("/po/authorize")
async def authorize_payment_order(
    request: AuthorizePORequest,
    current_user: dict = Depends(require_min_role("manager"))
):
    """Authorize a Payment Order (manager-only)."""
    db = get_db()
    po_doc = await db.payment_orders.find_one({"id": request.po_id})
    if not po_doc:
        raise HTTPException(status_code=404, detail="Payment Order not found")
    po = _po_from_doc(po_doc)
    if po.status != PaymentOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"PO is already {po.status.value}")

    audit = AuthorizationAudit(
        po_id=po.id,
        authorized_by=request.authorized_by,
        authorization_level=request.authorization_level,
        notes=request.notes
    )
    await db.audit_log.insert_one(audit.model_dump())

    await db.payment_orders.update_one(
        {"id": po.id},
        {"$set": {"status": PaymentOrderStatus.AUTHORIZED.value,
                  "authorized_by": request.authorized_by,
                  "authorized_at": datetime.utcnow().isoformat()}}
    )
    return {
        "message": "Payment Order authorized",
        "po_id": po.id,
        "authorized_by": request.authorized_by,
        "status": PaymentOrderStatus.AUTHORIZED.value
    }


# =========================
# PAYMENT EXECUTION
# =========================

@regfiling_router.post("/payment/execute")
async def execute_payment(
    request: ExecutePaymentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Execute payment via Cove Wallet."""
    db = get_db()
    po_doc = await db.payment_orders.find_one({"id": request.po_id})
    if not po_doc:
        raise HTTPException(status_code=404, detail="Payment Order not found")
    po = _po_from_doc(po_doc)
    if po.status != PaymentOrderStatus.AUTHORIZED:
        raise HTTPException(status_code=400, detail=f"PO must be AUTHORIZED. Current: {po.status.value}")

    if request.payment_method == "wallet":
        from wallet.routes import get_sub_account_from_db
        sub_account = await get_sub_account_from_db(db, po.company_id)
        if not sub_account:
            raise HTTPException(status_code=404, detail="Wallet sub-account not found")
        if sub_account.available_balance < po.total_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient wallet balance. Available: {sub_account.available_balance}, Required: {po.total_amount}"
            )
        new_balance = sub_account.available_balance - po.total_amount
        await db.sub_accounts.update_one(
            {"company_id": po.company_id},
            {"$set": {"available_balance": new_balance, "updated_at": datetime.utcnow().isoformat()}}
        )
        wtx_id = f"wtx_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        now_str = datetime.utcnow().isoformat()
        await db.payment_orders.update_one(
            {"id": po.id},
            {"$set": {"status": PaymentOrderStatus.PAID.value, "payment_executed_at": now_str,
                      "wallet_transaction_id": wtx_id, "payment_status": "completed"}}
        )
        await db.filings.update_one(
            {"id": po.filing_id},
            {"$set": {"status": FilingStatus.PAID.value, "paid_at": now_str, "payment_reference": wtx_id}}
        )
        logger.info("Payment executed for PO %s via wallet tx %s", po.id, wtx_id)
        return {"message": "Payment executed successfully", "po_id": po.id,
                "transaction_id": wtx_id, "amount": po.total_amount, "status": "PAID"}

    raise HTTPException(status_code=400, detail=f"Unsupported payment method: {request.payment_method}")


# =========================
# PAYMENT PRIORITIZATION
# =========================

@regfiling_router.get("/payments/prioritize/{company_id}")
async def prioritize_payments(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Rank outstanding payment orders by urgency."""
    db = get_db()
    cursor = db.payment_orders.find({
        "company_id": company_id,
        "status": {"$nin": [PaymentOrderStatus.PAID.value, PaymentOrderStatus.CANCELLED.value]}
    })
    pos = [_po_from_doc(doc) async for doc in cursor]

    filing_ids = [po.filing_id for po in pos]
    filings_map = {}
    if filing_ids:
        f_cursor = db.filings.find({"id": {"$in": filing_ids}})
        filings_map = {doc["id"]: _filing_from_doc(doc) async for doc in f_cursor}

    results = []
    for po in pos:
        filing = filings_map.get(po.filing_id)
        priority_score = get_priority_score(filing) if filing else 0
        results.append(PaymentPrioritizationResult(
            po_id=po.id, filing_id=po.filing_id, company_id=company_id,
            title=po.obligation_title, amount=po.total_amount,
            due_date=po.due_date, priority_score=priority_score, status=po.status
        ))

    results.sort(key=lambda r: r.priority_score, reverse=True)
    return {
        "company_id": company_id,
        "total_outstanding": len(results),
        "total_amount": sum(r.amount for r in results),
        "prioritized_orders": [r.model_dump() for r in results]
    }


# =========================
# SEED DATA (dev/staging only)
# =========================

@regfiling_router.post("/seed/{company_id}")
async def seed_filings(
    company_id: str,
    request: Request,
    current_user: dict = Depends(require_min_role("admin"))
):
    """Seed sample filings for dev/staging only (admin-only)."""
    import os
    if os.getenv("ENVIRONMENT", "production") == "production":
        raise HTTPException(status_code=403, detail="Seed endpoint disabled in production")

    db = get_db()
    sample_filings = [
        RegFiling(
            company_id=company_id, obligation_id="obl-1", filing_type="annual_return",
            title="PACRA Annual Return",
            description="Annual return filing with Patents and Companies Registration Agency",
            authority_name="PACRA", authority_code="PACRA",
            due_date=date.today() + timedelta(days=14),
            base_fee=500, late_penalty_rate=0.05, max_late_penalty=5000,
            priority=FilingPriority.HIGH
        ),
        RegFiling(
            company_id=company_id, obligation_id="obl-2", filing_type="vat_return",
            title="ZRA VAT Return",
            description="Monthly VAT return with Zambia Revenue Authority",
            authority_name="ZRA", authority_code="ZRA",
            due_date=date.today() - timedelta(days=5),
            base_fee=0, late_penalty_rate=0.10, max_late_penalty=50000,
            priority=FilingPriority.CRITICAL
        ),
        RegFiling(
            company_id=company_id, obligation_id="obl-3", filing_type="mining_license_renewal",
            title="Mining License Renewal",
            description="Annual mining license renewal with Ministry of Mines",
            authority_name="Ministry of Mines", authority_code="Ministry_of_Mines",
            due_date=date.today() + timedelta(days=30),
            base_fee=25000, late_penalty_rate=0.20, max_late_penalty=500000,
            priority=FilingPriority.HIGH
        ),
        RegFiling(
            company_id=company_id, obligation_id="obl-4", filing_type="environmental_audit",
            title="Annual Environmental Audit",
            description="Submit environmental compliance audit to ZEMA",
            authority_name="ZEMA", authority_code="ZEMA",
            due_date=date.today() + timedelta(days=60),
            base_fee=15000, late_penalty_rate=0.15, max_late_penalty=150000,
            priority=FilingPriority.MEDIUM
        ),
    ]

    inserted = 0
    for filing in sample_filings:
        existing = await db.filings.find_one({"obligation_id": filing.obligation_id, "company_id": company_id})
        if not existing:
            doc = filing.model_dump()
            doc["due_date"] = filing.due_date.isoformat()
            await db.filings.insert_one(doc)
            inserted += 1

    return {
        "message": f"Seeded {inserted} new filings for {company_id}",
        "company_id": company_id,
        "inserted": inserted,
        "skipped": len(sample_filings) - inserted
    }
