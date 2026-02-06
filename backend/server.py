from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Cove Legal Tech API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =========================
# MODELS
# =========================

class CompanyCreate(BaseModel):
    name: str
    registration_number: str
    size: str
    sector: str
    sub_sector: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    registration_number: Optional[str] = None
    size: Optional[str] = None
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    registration_number: str
    size: str
    sector: str
    sub_sector: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    compliance_score: int = 0
    subscription_plan: str = "professional"
    subscription_status: str = "active"
    mrr: float = 2500.0

class Obligation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    statute: str
    obligation: str
    action_required: str
    due_date: str
    severity: str
    penalty: Optional[str] = None
    frequency: Optional[str] = None
    responsible_authority: Optional[str] = None
    sector: str
    sub_sector: str
    status: str = "pending"

class ObligationCreate(BaseModel):
    category: str
    statute: str
    obligation: str
    action_required: str
    due_date: str
    severity: str
    penalty: Optional[str] = None
    frequency: Optional[str] = None
    responsible_authority: Optional[str] = None
    sector: str
    sub_sector: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: str
    company_id: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    mfa_enabled: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    status: str = "active"

class UserCreate(BaseModel):
    email: str
    name: str
    role: str
    company_id: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    company_id: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    mfa_enabled: Optional[bool] = None

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    ip_address: str = "192.168.1.1"
    user_agent: str = "Mozilla/5.0"
    status: str = "success"
    details: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Ticket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    subject: str
    description: str
    priority: str = "medium"
    status: str = "open"
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TicketCreate(BaseModel):
    user_id: str
    user_name: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    subject: str
    description: str
    priority: str = "medium"

class TicketMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    sender_id: str
    sender_name: str
    message: str
    is_internal: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    company_id: str
    company_name: str
    user_id: str
    user_name: str
    file_type: str
    file_size: int
    url: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Legislation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    statute_name: str
    act_number: str
    sector: str
    sub_sector: str
    category: str
    sub_category: Optional[str] = None
    description: str
    effective_date: str
    status: str = "active"
    obligations_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LegislationCreate(BaseModel):
    statute_name: str
    act_number: str
    sector: str
    sub_sector: str
    category: str
    sub_category: Optional[str] = None
    description: str
    effective_date: str

class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str
    description: str
    permissions: List[str]
    is_system: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubscriptionPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float
    billing_period: str = "monthly"
    features: List[str]
    user_limit: int
    storage_limit_gb: int
    is_active: bool = True

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    company_id: str
    company_name: str
    amount: float
    issue_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30))
    status: str = "pending"
    plan: str = "professional"

class SystemSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "system-settings"
    platform_name: str = "Cove Legal Tech"
    support_email: str = "support@cove.zm"
    default_language: str = "en"
    timezone: str = "Africa/Lusaka"
    date_format: str = "DD/MM/YYYY"
    currency: str = "ZMW"
    session_timeout_minutes: int = 60
    password_min_length: int = 8
    mfa_required_roles: List[str] = []
    backup_frequency: str = "daily"

class BulkUserAction(BaseModel):
    action: str
    user_ids: List[str]

class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: str
    permissions: List[str]

class TicketMessageCreate(BaseModel):
    sender_id: str
    sender_name: str
    message: str
    is_internal: bool = False

class AISummaryRequest(BaseModel):
    statute: str
    obligation: str
    action_required: str

class AISummaryResponse(BaseModel):
    summary: str
    approved_by: str
    last_updated: str
    key_points: List[str]

class NotificationCreate(BaseModel):
    company_id: str
    obligation_id: str
    email: str
    days_before: int = 7

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    obligation_id: str
    email: str
    days_before: int
    sent: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityNotification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    title: str
    message: str
    link: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# =========================
# MOCK DATA
# =========================

MOCK_OBLIGATIONS = {
    "mining": {
        "Base Metals": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Annual Mining License Renewal", "action_required": "Submit renewal application with updated environmental reports", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 500,000 fine or license revocation", "frequency": "Annual", "responsible_authority": "Ministry of Mines and Minerals Development"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Environmental Impact Assessment Report", "action_required": "Commission and submit comprehensive EIA to ZEMA", "due_date": "2026-06-30", "severity": "critical", "category": "Environment", "penalty": "Operations suspension", "frequency": "Every 3 years", "responsible_authority": "Zambia Environmental Management Agency"},
            {"statute": "Employment Act Chapter 268", "obligation": "Submit Annual Employment Returns", "action_required": "File employment statistics with Labour Office", "due_date": "2026-02-28", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 10,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return with audited financials", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "Penalties and interest on unpaid tax", "frequency": "Annual", "responsible_authority": "Zambia Revenue Authority"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA including director updates", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off from register", "frequency": "Annual", "responsible_authority": "Patents and Companies Registration Agency"},
        ],
        "Precious Metals": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Gold Export License Renewal", "action_required": "Apply for gold export permit renewal", "due_date": "2026-02-28", "severity": "critical", "category": "Core Operations", "penalty": "Export ban", "frequency": "Annual", "responsible_authority": "Bank of Zambia"},
        ],
        "Industrial Minerals": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Industrial Minerals License Renewal", "action_required": "Submit renewal with production forecasts", "due_date": "2026-05-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 300,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Mines"},
        ],
        "Gemstones": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Gemstone Trading License", "action_required": "Renew gemstone dealer license", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Trading suspension", "frequency": "Annual", "responsible_authority": "Ministry of Mines"},
        ]
    },
    "construction": {
        "Infrastructure": [
            {"statute": "Engineers Registration Act Chapter 507", "obligation": "Engineer Registration Verification", "action_required": "Verify all project engineers are registered with EIZ", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Project suspension", "frequency": "Annual", "responsible_authority": "Engineering Institution of Zambia"},
            {"statute": "National Council for Construction Act No. 13 of 2003", "obligation": "NCC Registration Renewal", "action_required": "Renew contractor registration with NCC", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Prohibition from government contracts", "frequency": "Annual", "responsible_authority": "National Council for Construction"},
        ],
        "Commercial Buildings": [
            {"statute": "Urban and Regional Planning Act No. 3 of 2015", "obligation": "Building Permit Application", "action_required": "Obtain planning permission for commercial developments", "due_date": "2026-01-31", "severity": "critical", "category": "Core Operations", "penalty": "Demolition order", "frequency": "Per project", "responsible_authority": "Local Authority Planning Department"},
        ],
        "Residential": [
            {"statute": "Housing Act Chapter 194", "obligation": "Housing Development License", "action_required": "Register as approved housing developer", "due_date": "2026-05-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Housing"},
        ],
        "Civil Engineering": [
            {"statute": "Roads and Road Traffic Act Chapter 464", "obligation": "Road Works Permit", "action_required": "Obtain permit for road construction/modification", "due_date": "2026-04-15", "severity": "high", "category": "Core Operations", "penalty": "Work stoppage", "frequency": "Per project", "responsible_authority": "Road Development Agency"},
        ]
    },
    "agriculture": {
        "Crop Production": [
            {"statute": "Agricultural Credits Act Chapter 224", "obligation": "Agricultural Produce Registration", "action_required": "Register crop production with agricultural board", "due_date": "2026-03-31", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 25,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Agriculture"},
        ],
        "Livestock": [
            {"statute": "Animal Health Act No. 27 of 2010", "obligation": "Livestock Health Certification", "action_required": "Obtain veterinary health certificates", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Movement restrictions", "frequency": "Annual", "responsible_authority": "Ministry of Fisheries and Livestock"},
        ],
        "Forestry": [
            {"statute": "Forests Act No. 4 of 2015", "obligation": "Forest Management License", "action_required": "Renew forest harvesting permit", "due_date": "2026-06-30", "severity": "critical", "category": "Core Operations", "penalty": "Criminal prosecution", "frequency": "Annual", "responsible_authority": "Forestry Department"},
        ],
        "Fisheries": [
            {"statute": "Fisheries Act No. 22 of 2011", "obligation": "Commercial Fishing License", "action_required": "Renew commercial fishing permit", "due_date": "2026-01-31", "severity": "high", "category": "Core Operations", "penalty": "Equipment seizure", "frequency": "Annual", "responsible_authority": "Department of Fisheries"},
        ]
    },
    "financial": {
        "Banking": [
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Banking License Compliance", "action_required": "Submit annual compliance report to BoZ", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "Bank of Zambia"},
        ],
        "Insurance": [
            {"statute": "Insurance Act No. 27 of 1997", "obligation": "Insurance License Renewal", "action_required": "Renew insurance underwriting license", "due_date": "2026-02-28", "severity": "critical", "category": "Corporate", "penalty": "Operating ban", "frequency": "Annual", "responsible_authority": "Pensions and Insurance Authority"},
        ],
        "Investment": [
            {"statute": "Securities Act No. 41 of 2016", "obligation": "Securities Dealer Registration", "action_required": "Renew dealer license with SEC", "due_date": "2026-05-31", "severity": "high", "category": "Corporate", "penalty": "Trading suspension", "frequency": "Annual", "responsible_authority": "Securities and Exchange Commission"},
        ],
        "Microfinance": [
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Microfinance Institution License", "action_required": "Submit quarterly reports to BoZ", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "License suspension", "frequency": "Quarterly", "responsible_authority": "Bank of Zambia"},
        ]
    },
    "manufacturing": {
        "FMCG": [
            {"statute": "Food and Drugs Act Chapter 303", "obligation": "Food Safety Certification", "action_required": "Obtain ZABS product certification", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Product recall", "frequency": "Annual", "responsible_authority": "Zambia Bureau of Standards"},
        ],
        "Industrial": [
            {"statute": "Factories Act Chapter 441", "obligation": "Factory Registration", "action_required": "Renew factory operating certificate", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Closure order", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
        ],
        "Textiles": [
            {"statute": "Standards Act No. 4 of 2017", "obligation": "Textile Quality Standards", "action_required": "Certify products meet ZABS textile standards", "due_date": "2026-05-31", "severity": "medium", "category": "Core Operations", "penalty": "Export ban", "frequency": "Annual", "responsible_authority": "ZABS"},
        ],
        "Food Processing": [
            {"statute": "Food Safety Act No. 7 of 2019", "obligation": "Food Processing License", "action_required": "Renew food processing facility license", "due_date": "2026-01-31", "severity": "critical", "category": "Core Operations", "penalty": "Facility closure", "frequency": "Annual", "responsible_authority": "Food and Drugs Control Authority"},
        ]
    },
    "power": {
        "Generation": [
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Power Generation License", "action_required": "Renew electricity generation license", "due_date": "2026-06-30", "severity": "critical", "category": "Core Operations", "penalty": "Generation halt", "frequency": "Every 5 years", "responsible_authority": "Energy Regulation Board"},
        ],
        "Distribution": [
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Distribution Network License", "action_required": "Maintain distribution license compliance", "due_date": "2026-04-30", "severity": "critical", "category": "Core Operations", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "ERB"},
        ],
        "Renewable Energy": [
            {"statute": "Renewable Energy Feed-in Tariff Policy 2017", "obligation": "REFiT Registration", "action_required": "Register renewable energy project", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "Tariff exclusion", "frequency": "Per project", "responsible_authority": "ERB"},
        ],
        "Transmission": [
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Transmission License", "action_required": "Submit transmission capacity report", "due_date": "2026-05-31", "severity": "critical", "category": "Core Operations", "penalty": "Operating restrictions", "frequency": "Annual", "responsible_authority": "ERB"},
        ]
    }
}

# Default Roles
DEFAULT_ROLES = [
    {"name": "super-admin", "display_name": "Super Admin", "description": "Full platform access", "permissions": ["*"], "is_system": True},
    {"name": "legal-admin", "display_name": "Legal Admin", "description": "Manage legislation and users", "permissions": ["users.view", "users.edit", "companies.view", "companies.edit", "legislation.view", "legislation.edit", "documents.view", "reports.generate"], "is_system": True},
    {"name": "corporate-user", "display_name": "Corporate User", "description": "Company compliance management", "permissions": ["own_company.view", "own_documents.upload", "own_reports.view", "own_profile.edit"], "is_system": True},
    {"name": "viewer", "display_name": "Viewer", "description": "Read-only access", "permissions": ["own_company.view", "own_documents.view", "own_reports.view"], "is_system": True},
]

# Default Subscription Plans
DEFAULT_PLANS = [
    {"name": "Basic", "price": 500.0, "billing_period": "monthly", "features": ["Up to 10 users", "Basic compliance tracking", "Email support"], "user_limit": 10, "storage_limit_gb": 5},
    {"name": "Professional", "price": 2500.0, "billing_period": "monthly", "features": ["Up to 50 users", "Advanced analytics", "AI summaries", "Priority support"], "user_limit": 50, "storage_limit_gb": 50},
    {"name": "Enterprise", "price": 7500.0, "billing_period": "monthly", "features": ["Unlimited users", "Custom integrations", "Dedicated support", "SLA guarantee"], "user_limit": 9999, "storage_limit_gb": 500},
]

# =========================
# HELPER FUNCTIONS
# =========================

def get_obligations_for_company(sector: str, sub_sector: str) -> List[dict]:
    obligations = []
    sector_lower = sector.lower()
    if sector_lower in MOCK_OBLIGATIONS:
        sector_data = MOCK_OBLIGATIONS[sector_lower]
        if sub_sector in sector_data:
            for idx, obl in enumerate(sector_data[sub_sector]):
                obligations.append({
                    "id": f"{sector_lower}-{sub_sector.lower().replace(' ', '-')}-{idx}",
                    "sector": sector,
                    "sub_sector": sub_sector,
                    "status": "pending",
                    **obl
                })
    return obligations

async def log_audit(user_id: str, user_name: str, action: str, resource_type: str, resource_id: str = None, details: dict = None):
    log = AuditLog(
        user_id=user_id,
        user_name=user_name,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details
    )
    doc = log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.audit_logs.insert_one(doc)

async def create_activity_notification(type: str, title: str, message: str, link: str = None):
    notif = ActivityNotification(type=type, title=title, message=message, link=link)
    doc = notif.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.activity_notifications.insert_one(doc)

# =========================
# API ROUTES
# =========================

@api_router.get("/")
async def root():
    return {"message": "Cove Legal Tech API - Zambia Compliance Platform"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Company Routes
@api_router.post("/companies", response_model=Company)
async def create_company(company_data: CompanyCreate):
    company = Company(**company_data.model_dump())
    doc = company.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    obligations = get_obligations_for_company(company.sector, company.sub_sector)
    for obl in obligations:
        obl['company_id'] = company.id
        await db.obligations.insert_one(obl)
    
    total = len(obligations)
    company.compliance_score = 100 if total == 0 else 0
    doc['compliance_score'] = company.compliance_score
    
    await db.companies.insert_one(doc)
    await create_activity_notification("company", "New Company Registered", f"{company.name} has joined the platform", "/admin?tab=organizations")
    return company

@api_router.get("/companies", response_model=List[Company])
async def get_companies():
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    for company in companies:
        if isinstance(company.get('created_at'), str):
            company['created_at'] = datetime.fromisoformat(company['created_at'])
    return companies

@api_router.get("/companies/{company_id}", response_model=Company)
async def get_company(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if isinstance(company.get('created_at'), str):
        company['created_at'] = datetime.fromisoformat(company['created_at'])
    return company

@api_router.put("/companies/{company_id}")
async def update_company(company_id: str, update_data: CompanyUpdate):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.companies.update_one({"id": company_id}, {"$set": update_dict})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    await log_audit("system", "System", "company.update", "company", company_id, update_dict)
    return {"message": "Company updated successfully"}

@api_router.delete("/companies/{company_id}")
async def delete_company(company_id: str):
    result = await db.companies.delete_one({"id": company_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.obligations.delete_many({"company_id": company_id})
    await log_audit("system", "System", "company.delete", "company", company_id)
    return {"message": "Company deleted"}

# Obligations Routes
@api_router.get("/obligations")
async def get_all_obligations(company_id: Optional[str] = None, category: Optional[str] = None, severity: Optional[str] = None):
    query = {}
    if company_id:
        query["company_id"] = company_id
    if category:
        query["category"] = category
    if severity:
        query["severity"] = severity
    obligations = await db.obligations.find(query, {"_id": 0}).to_list(1000)
    return obligations

@api_router.get("/obligations/{obligation_id}")
async def get_obligation(obligation_id: str):
    obligation = await db.obligations.find_one({"id": obligation_id}, {"_id": 0})
    if not obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")
    return obligation

@api_router.patch("/obligations/{obligation_id}/status")
async def update_obligation_status(obligation_id: str, status: str):
    result = await db.obligations.update_one({"id": obligation_id}, {"$set": {"status": status}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Obligation not found")
    return {"message": "Status updated", "status": status}

# Sectors
@api_router.get("/sectors")
async def get_sectors():
    return {
        "sectors": {
            "mining": ["Base Metals", "Precious Metals", "Industrial Minerals", "Gemstones"],
            "construction": ["Infrastructure", "Commercial Buildings", "Residential", "Civil Engineering"],
            "agriculture": ["Crop Production", "Livestock", "Forestry", "Fisheries"],
            "financial": ["Banking", "Insurance", "Investment", "Microfinance"],
            "manufacturing": ["FMCG", "Industrial", "Textiles", "Food Processing"],
            "power": ["Generation", "Distribution", "Renewable Energy", "Transmission"]
        }
    }

@api_router.get("/legislation/{sector}/{sub_sector}")
async def get_legislation(sector: str, sub_sector: str):
    obligations = get_obligations_for_company(sector, sub_sector)
    return {"sector": sector, "sub_sector": sub_sector, "obligations": obligations}

# AI Summary Route
@api_router.post("/ai/summary", response_model=AISummaryResponse)
async def get_ai_summary(request: AISummaryRequest):
    try:
        emergent_key = os.environ.get('EMERGENT_LLM_KEY')
        if not emergent_key:
            return AISummaryResponse(
                summary=f"This obligation under the {request.statute} requires {request.action_required}. Failure to comply may result in significant penalties.",
                approved_by="Legal AI Assistant",
                last_updated=datetime.now(timezone.utc).isoformat(),
                key_points=["Ensure timely submission before deadline", "Maintain proper documentation", "Consult legal counsel for complex requirements"]
            )
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"cove-summary-{uuid.uuid4()}",
            system_message="""You are a Zambian legal compliance expert. Provide clear, concise summaries of legal obligations for corporate compliance officers. 
            Format your response as JSON with these fields:
            - summary: A 2-3 sentence plain English explanation
            - key_points: An array of 3-5 actionable bullet points
            Always reference specific Zambian laws and regulatory bodies where relevant."""
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        prompt = f"""Summarize this Zambian legal obligation for a compliance officer:

Statute: {request.statute}
Obligation: {request.obligation}
Action Required: {request.action_required}

Provide a JSON response with 'summary' and 'key_points' fields."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        import json
        try:
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            parsed = json.loads(response_text.strip())
            return AISummaryResponse(
                summary=parsed.get("summary", response[:500]),
                approved_by="AI Legal Assistant (Claude Sonnet 4.5)",
                last_updated=datetime.now(timezone.utc).isoformat(),
                key_points=parsed.get("key_points", ["Review the full statute text", "Consult legal counsel", "Set calendar reminders"])
            )
        except json.JSONDecodeError:
            return AISummaryResponse(
                summary=response[:500] if len(response) > 500 else response,
                approved_by="AI Legal Assistant (Claude Sonnet 4.5)",
                last_updated=datetime.now(timezone.utc).isoformat(),
                key_points=["Review the full statute text", "Consult legal counsel", "Set calendar reminders"]
            )
            
    except Exception as e:
        logger.error(f"AI Summary error: {e}")
        return AISummaryResponse(
            summary=f"This obligation under the {request.statute} requires {request.action_required}. Failure to comply may result in penalties.",
            approved_by="System Generated",
            last_updated=datetime.now(timezone.utc).isoformat(),
            key_points=["Ensure timely submission", "Maintain documentation", "Consult legal counsel"]
        )

# User Management Routes
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    user = User(**user_data.model_dump())
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('last_login'):
        doc['last_login'] = doc['last_login'].isoformat()
    await db.users.insert_one(doc)
    await log_audit("system", "System", "user.create", "user", user.id, {"email": user.email, "role": user.role})
    await create_activity_notification("user", "New User Added", f"{user.name} joined as {user.role}", "/admin?tab=users")
    return user

@api_router.get("/users", response_model=List[User])
async def get_users(role: Optional[str] = None, company_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if role:
        query["role"] = role
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        if isinstance(user.get('last_login'), str):
            user['last_login'] = datetime.fromisoformat(user['last_login'])
    return users

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    return user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update_data: UserUpdate):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_dict})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_audit("system", "System", "user.update", "user", user_id, update_dict)
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit("system", "System", "user.delete", "user", user_id)
    return {"message": "User deleted"}

@api_router.post("/users/bulk-action")
async def bulk_user_action(action: str, user_ids: List[str]):
    if action == "delete":
        result = await db.users.delete_many({"id": {"$in": user_ids}})
        return {"message": f"Deleted {result.deleted_count} users"}
    elif action == "suspend":
        result = await db.users.update_many({"id": {"$in": user_ids}}, {"$set": {"status": "suspended"}})
        return {"message": f"Suspended {result.modified_count} users"}
    elif action == "activate":
        result = await db.users.update_many({"id": {"$in": user_ids}}, {"$set": {"status": "active"}})
        return {"message": f"Activated {result.modified_count} users"}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

# Roles Routes
@api_router.get("/roles")
async def get_roles():
    roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    if not roles:
        # Initialize with default roles
        for role_data in DEFAULT_ROLES:
            role = Role(**role_data)
            doc = role.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.roles.insert_one(doc)
        roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    return roles

@api_router.post("/roles")
async def create_role(name: str, display_name: str, description: str, permissions: List[str]):
    role = Role(name=name, display_name=display_name, description=description, permissions=permissions)
    doc = role.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.roles.insert_one(doc)
    return role

# Audit Logs Routes
@api_router.get("/audit-logs")
async def get_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents(query)
    return {"logs": logs, "total": total}

# Tickets Routes
@api_router.get("/tickets")
async def get_tickets(status: Optional[str] = None, priority: Optional[str] = None, assigned_to: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tickets

@api_router.post("/tickets")
async def create_ticket(ticket_data: TicketCreate):
    ticket = Ticket(**ticket_data.model_dump())
    doc = ticket.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.tickets.insert_one(doc)
    await create_activity_notification("ticket", "New Support Ticket", f"Ticket #{ticket.id[:8]}: {ticket.subject}", "/admin?tab=support")
    return ticket

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    messages = await db.ticket_messages.find({"ticket_id": ticket_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"ticket": ticket, "messages": messages}

@api_router.post("/tickets/{ticket_id}/messages")
async def add_ticket_message(ticket_id: str, sender_id: str, sender_name: str, message: str, is_internal: bool = False):
    msg = TicketMessage(ticket_id=ticket_id, sender_id=sender_id, sender_name=sender_name, message=message, is_internal=is_internal)
    doc = msg.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.ticket_messages.insert_one(doc)
    await db.tickets.update_one({"id": ticket_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    return msg

@api_router.patch("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, status: Optional[str] = None, priority: Optional[str] = None, assigned_to: Optional[str] = None):
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if status:
        update["status"] = status
    if priority:
        update["priority"] = priority
    if assigned_to:
        update["assigned_to"] = assigned_to
    
    result = await db.tickets.update_one({"id": ticket_id}, {"$set": update})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket updated"}

# Documents Routes
@api_router.get("/documents")
async def get_documents(company_id: Optional[str] = None, file_type: Optional[str] = None):
    query = {}
    if company_id:
        query["company_id"] = company_id
    if file_type:
        query["file_type"] = file_type
    
    docs = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    result = await db.documents.delete_one({"id": document_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}

# Legislation Routes
@api_router.get("/legislation")
async def get_all_legislation(sector: Optional[str] = None, category: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if sector:
        query["sector"] = sector
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    
    legislation = await db.legislation.find(query, {"_id": 0}).to_list(500)
    return legislation

@api_router.post("/legislation")
async def create_legislation(leg_data: LegislationCreate):
    legislation = Legislation(**leg_data.model_dump())
    doc = legislation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.legislation.insert_one(doc)
    await log_audit("system", "System", "legislation.create", "legislation", legislation.id)
    return legislation

@api_router.put("/legislation/{legislation_id}")
async def update_legislation(legislation_id: str, update_data: LegislationCreate):
    update_dict = update_data.model_dump()
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.legislation.update_one({"id": legislation_id}, {"$set": update_dict})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Legislation not found")
    return {"message": "Legislation updated"}

@api_router.delete("/legislation/{legislation_id}")
async def delete_legislation(legislation_id: str):
    result = await db.legislation.delete_one({"id": legislation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Legislation not found")
    return {"message": "Legislation deleted"}

# Subscription Plans Routes
@api_router.get("/subscription-plans")
async def get_subscription_plans():
    plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(20)
    if not plans:
        for plan_data in DEFAULT_PLANS:
            plan = SubscriptionPlan(**plan_data)
            doc = plan.model_dump()
            await db.subscription_plans.insert_one(doc)
        plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(20)
    return plans

@api_router.post("/subscription-plans")
async def create_subscription_plan(name: str, price: float, features: List[str], user_limit: int, storage_limit_gb: int):
    plan = SubscriptionPlan(name=name, price=price, features=features, user_limit=user_limit, storage_limit_gb=storage_limit_gb)
    doc = plan.model_dump()
    await db.subscription_plans.insert_one(doc)
    return plan

# Invoices Routes
@api_router.get("/invoices")
async def get_invoices(company_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("issue_date", -1).to_list(500)
    return invoices

@api_router.patch("/invoices/{invoice_id}")
async def update_invoice_status(invoice_id: str, status: str):
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": status}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice status updated"}

# Settings Routes
@api_router.get("/settings/system")
async def get_system_settings():
    settings = await db.system_settings.find_one({"id": "system-settings"}, {"_id": 0})
    if not settings:
        default_settings = SystemSettings()
        doc = default_settings.model_dump()
        await db.system_settings.insert_one(doc)
        return default_settings
    return settings

@api_router.put("/settings/system")
async def update_system_settings(settings: SystemSettings):
    doc = settings.model_dump()
    await db.system_settings.replace_one({"id": "system-settings"}, doc, upsert=True)
    await log_audit("system", "System", "settings.update", "system_settings")
    return {"message": "Settings updated"}

# Activity Notifications Routes
@api_router.get("/activity-notifications")
async def get_activity_notifications(limit: int = 20, unread_only: bool = False):
    query = {}
    if unread_only:
        query["read"] = False
    
    notifications = await db.activity_notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    unread_count = await db.activity_notifications.count_documents({"read": False})
    return {"notifications": notifications, "unread_count": unread_count}

@api_router.post("/activity-notifications/mark-read")
async def mark_notifications_read(notification_ids: List[str] = None):
    if notification_ids:
        await db.activity_notifications.update_many({"id": {"$in": notification_ids}}, {"$set": {"read": True}})
    else:
        await db.activity_notifications.update_many({}, {"$set": {"read": True}})
    return {"message": "Notifications marked as read"}

# Global Search Route
@api_router.get("/search")
async def global_search(q: str, limit: int = 10):
    results = {
        "users": [],
        "companies": [],
        "legislation": [],
        "tickets": [],
        "documents": []
    }
    
    if len(q) < 2:
        return results
    
    # Search users
    users = await db.users.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    results["users"] = users
    
    # Search companies
    companies = await db.companies.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"registration_number": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    results["companies"] = companies
    
    # Search legislation
    legislation = await db.legislation.find(
        {"$or": [
            {"statute_name": {"$regex": q, "$options": "i"}},
            {"act_number": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    results["legislation"] = legislation
    
    # Search tickets
    tickets = await db.tickets.find(
        {"$or": [
            {"subject": {"$regex": q, "$options": "i"}},
            {"id": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    results["tickets"] = tickets
    
    return results

# Dashboard Statistics
@api_router.get("/dashboard/stats/{company_id}")
async def get_dashboard_stats(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    obligations = await db.obligations.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    
    total = len(obligations)
    completed = sum(1 for o in obligations if o.get('status') == 'completed')
    critical = sum(1 for o in obligations if o.get('severity') == 'critical')
    high = sum(1 for o in obligations if o.get('severity') == 'high')
    
    compliance_score = int((completed / total * 100)) if total > 0 else 100
    
    today = datetime.now(timezone.utc)
    thirty_days = today + timedelta(days=30)
    
    upcoming = [o for o in obligations if o.get('due_date') and datetime.fromisoformat(o['due_date'].replace('Z', '+00:00') if 'Z' in o['due_date'] else o['due_date'] + 'T00:00:00+00:00') <= thirty_days]
    
    categories = {}
    for o in obligations:
        cat = o.get('category', 'Other')
        if cat not in categories:
            categories[cat] = {"total": 0, "completed": 0}
        categories[cat]["total"] += 1
        if o.get('status') == 'completed':
            categories[cat]["completed"] += 1
    
    return {
        "company": company,
        "compliance_score": compliance_score,
        "total_obligations": total,
        "completed_obligations": completed,
        "critical_items": critical,
        "high_priority_items": high,
        "upcoming_deadlines": upcoming[:10],
        "categories": categories
    }

# Admin Analytics
@api_router.get("/admin/analytics")
async def get_admin_analytics():
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    obligations = await db.obligations.find({}, {"_id": 0}).to_list(10000)
    
    sector_dist = {}
    for c in companies:
        sector = c.get('sector', 'Unknown')
        sector_dist[sector] = sector_dist.get(sector, 0) + 1
    
    severity_dist = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for o in obligations:
        sev = o.get('severity', 'low')
        if sev in severity_dist:
            severity_dist[sev] += 1
    
    # Calculate MRR
    total_mrr = sum(c.get('mrr', 0) for c in companies)
    
    monthly_trend = [
        {"month": "Oct", "compliance": 72, "revenue": total_mrr * 0.85},
        {"month": "Nov", "compliance": 78, "revenue": total_mrr * 0.9},
        {"month": "Dec", "compliance": 82, "revenue": total_mrr * 0.95},
        {"month": "Jan", "compliance": 85, "revenue": total_mrr},
    ]
    
    # Platform health metrics
    platform_health = {
        "uptime": 99.8,
        "api_response_time": 145,
        "error_rate": 0.02,
        "storage_used_gb": len(companies) * 2.5,
        "storage_total_gb": 500
    }
    
    return {
        "total_companies": len(companies),
        "total_users": len(users),
        "total_obligations": len(obligations),
        "active_users_today": len([u for u in users if u.get('status') == 'active']),
        "sector_distribution": sector_dist,
        "severity_distribution": severity_dist,
        "monthly_trend": monthly_trend,
        "total_mrr": total_mrr,
        "platform_health": platform_health,
        "critical_alerts": sum(1 for o in obligations if o.get('severity') == 'critical' and o.get('status') != 'completed')
    }

@api_router.get("/admin/revenue")
async def get_revenue_analytics():
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate revenue by plan
    revenue_by_plan = {"Basic": 0, "Professional": 0, "Enterprise": 0}
    plan_counts = {"Basic": 0, "Professional": 0, "Enterprise": 0}
    
    for c in companies:
        plan = c.get('subscription_plan', 'Professional').capitalize()
        if plan in revenue_by_plan:
            revenue_by_plan[plan] += c.get('mrr', 2500)
            plan_counts[plan] += 1
    
    total_mrr = sum(revenue_by_plan.values())
    
    return {
        "total_mrr": total_mrr,
        "annual_run_rate": total_mrr * 12,
        "revenue_by_plan": revenue_by_plan,
        "plan_counts": plan_counts,
        "avg_revenue_per_company": total_mrr / len(companies) if companies else 0,
        "churn_rate": 2.5,
        "ltv_projection": total_mrr * 24
    }

# Notifications Routes
@api_router.post("/notifications", response_model=Notification)
async def create_notification(notification_data: NotificationCreate):
    notification = Notification(**notification_data.model_dump())
    doc = notification.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)
    return notification

@api_router.get("/notifications")
async def get_notifications(company_id: Optional[str] = None):
    query = {}
    if company_id:
        query["company_id"] = company_id
    notifications = await db.notifications.find(query, {"_id": 0}).to_list(1000)
    return notifications

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
