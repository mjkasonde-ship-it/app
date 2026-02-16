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

class PlainLanguageSummary(BaseModel):
    """5-section plain language breakdown of compliance obligation"""
    statute_jurisdiction: str = ""  # Section 1: Statute & Jurisdiction
    core_obligations: str = ""       # Section 2: Core Obligations
    practical_implications: str = "" # Section 3: Practical Implications
    deadlines_triggers: str = ""     # Section 4: Key Deadlines & Triggers
    non_compliance_risks: str = ""   # Section 5: Non-Compliance Risks

class Obligation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    statute: str
    provision: Optional[str] = None  # Specific section/article reference
    legal_reference_url: Optional[str] = None  # URL to legal text
    obligation: str
    action_required: str
    consequences: Optional[str] = None  # What happens if not complied
    due_date: str
    severity: str
    penalty: Optional[str] = None
    frequency: Optional[str] = None
    responsible_authority: Optional[str] = None
    owner: str = "Legal"  # Owner department: Legal, HR, Finance, Operations, Compliance
    sector: str
    sub_sector: str
    status: str = "pending"  # pending, in_progress, completed, non_compliant, overdue
    # New 5-section plain language summary
    plain_language_summary: Optional[Dict[str, str]] = None

class ObligationCreate(BaseModel):
    category: str
    statute: str
    provision: Optional[str] = None
    legal_reference_url: Optional[str] = None
    obligation: str
    action_required: str
    consequences: Optional[str] = None
    due_date: str
    severity: str
    penalty: Optional[str] = None
    frequency: Optional[str] = None
    responsible_authority: Optional[str] = None
    owner: str = "Legal"
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

# VDR Models
class VDRFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    folder: str  # corporate, legal, hr, operations
    company_id: Optional[str] = None
    size: int = 0
    mime_type: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1
    linked_obligation_id: Optional[str] = None
    linked_obligation: Optional[str] = None
    file_path: Optional[str] = None
    versions: List[Dict[str, Any]] = []

class VDRFileCreate(BaseModel):
    name: str
    folder: str
    company_id: Optional[str] = None
    size: int = 0
    mime_type: Optional[str] = None
    uploaded_by: str = "User"
    linked_obligation_id: Optional[str] = None

# Role and Permission Models
class Permission(BaseModel):
    id: str
    name: str
    description: str

class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    permissions: List[str] = []
    company_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class SubscriptionPlanCreate(BaseModel):
    name: str
    price: float
    features: List[str]
    user_limit: int
    storage_limit_gb: int

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
# COMPREHENSIVE MOCK DATA - ZAMBIAN LEGISLATION
# =========================

MOCK_OBLIGATIONS = {
    "mining": {
        "Base Metals": [
            # Core Operations
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Large-Scale Mining License Renewal", "action_required": "Submit renewal application with updated mine plan, environmental reports, and community development agreement", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "License revocation and ZMW 1,000,000 fine", "frequency": "Every 25 years (annual review)", "responsible_authority": "Ministry of Mines and Minerals Development"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Quarterly Production Returns", "action_required": "Submit detailed mineral production statistics including grades, tonnages, and recovery rates", "due_date": "2026-04-15", "severity": "high", "category": "Core Operations", "penalty": "ZMW 100,000 fine per quarter", "frequency": "Quarterly", "responsible_authority": "Mining Cadastre Office"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Mine Safety Certificate", "action_required": "Obtain annual mine safety certification from Chief Inspector of Mines", "due_date": "2026-02-28", "severity": "critical", "category": "Core Operations", "penalty": "Operations suspension", "frequency": "Annual", "responsible_authority": "Mine Safety Department"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Blasting License Renewal", "action_required": "Renew explosives handling and blasting permits", "due_date": "2026-01-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "Zambia Police - Explosives Unit"},
            # Corporate
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA including director updates, share capital changes", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off from register", "frequency": "Annual", "responsible_authority": "Patents and Companies Registration Agency"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return with audited financials", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty plus interest at BoZ rate", "frequency": "Annual", "responsible_authority": "Zambia Revenue Authority"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Mineral Royalty Payment", "action_required": "Pay mineral royalty based on gross value of minerals produced", "due_date": "2026-04-14", "severity": "critical", "category": "Corporate", "penalty": "5% penalty per month on unpaid amount", "frequency": "Quarterly", "responsible_authority": "Zambia Revenue Authority"},
            {"statute": "Value Added Tax Act Chapter 331", "obligation": "VAT Returns Filing", "action_required": "Submit monthly VAT returns and remit collected VAT", "due_date": "2026-02-21", "severity": "high", "category": "Corporate", "penalty": "ZMW 6,000 per day of default", "frequency": "Monthly", "responsible_authority": "Zambia Revenue Authority"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "AML Compliance Report", "action_required": "Submit annual AML compliance certificate and suspicious transaction reports", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "Operating license revocation", "frequency": "Annual", "responsible_authority": "Financial Intelligence Centre"},
            # Environment
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Environmental Impact Assessment Report", "action_required": "Commission and submit comprehensive EIA to ZEMA for new projects or expansions", "due_date": "2026-06-30", "severity": "critical", "category": "Environment", "penalty": "Operations suspension and rehabilitation order", "frequency": "Every 3 years", "responsible_authority": "Zambia Environmental Management Agency"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Annual Environmental Audit", "action_required": "Conduct and submit independent environmental audit report", "due_date": "2026-05-31", "severity": "high", "category": "Environment", "penalty": "ZMW 750,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Waste Management License", "action_required": "Renew hazardous waste storage and disposal permit", "due_date": "2026-03-31", "severity": "high", "category": "Environment", "penalty": "ZMW 500,000 fine and cleanup order", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Water Resources Management Act No. 21 of 2011", "obligation": "Water Abstraction Permit", "action_required": "Renew water use permit for mining operations", "due_date": "2026-04-30", "severity": "high", "category": "Environment", "penalty": "ZMW 300,000 fine", "frequency": "Annual", "responsible_authority": "Water Resources Management Authority"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Mine Closure Plan Update", "action_required": "Submit updated mine closure and rehabilitation plan", "due_date": "2026-07-31", "severity": "high", "category": "Environment", "penalty": "Withholding of environmental bond", "frequency": "Every 2 years", "responsible_authority": "ZEMA"},
            # Business Operations
            {"statute": "Employment Act Chapter 268", "obligation": "Annual Employment Returns", "action_required": "File employment statistics including workforce composition, wages, and training", "due_date": "2026-02-28", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 10,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
            {"statute": "Workers Compensation Act Chapter 271", "obligation": "Workers Compensation Coverage", "action_required": "Maintain and renew workers compensation insurance", "due_date": "2026-01-31", "severity": "high", "category": "Business Operations", "penalty": "ZMW 200,000 fine and criminal liability", "frequency": "Annual", "responsible_authority": "Workers Compensation Fund Control Board"},
            {"statute": "Occupational Health and Safety Act No. 36 of 2010", "obligation": "OHS Compliance Certificate", "action_required": "Obtain annual occupational health and safety certification", "due_date": "2026-03-31", "severity": "high", "category": "Business Operations", "penalty": "ZMW 150,000 fine", "frequency": "Annual", "responsible_authority": "Occupational Health and Safety Institute"},
            {"statute": "National Pension Scheme Act No. 40 of 1996", "obligation": "NAPSA Contributions", "action_required": "Remit employee and employer pension contributions", "due_date": "2026-02-14", "severity": "high", "category": "Business Operations", "penalty": "20% penalty on arrears", "frequency": "Monthly", "responsible_authority": "National Pension Scheme Authority"},
            {"statute": "Skills Development Act No. 11 of 1996", "obligation": "Skills Levy Payment", "action_required": "Pay skills development levy (0.5% of payroll)", "due_date": "2026-02-14", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 50,000 fine", "frequency": "Monthly", "responsible_authority": "TEVETA"},
            {"statute": "Citizens Economic Empowerment Act No. 9 of 2006", "obligation": "Local Content Compliance Report", "action_required": "Submit report on local procurement and citizen economic empowerment", "due_date": "2026-06-30", "severity": "medium", "category": "Business Operations", "penalty": "Preferential treatment withdrawal", "frequency": "Annual", "responsible_authority": "Citizens Economic Empowerment Commission"},
        ],
        "Precious Metals": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Precious Metals Trading License", "action_required": "Renew gold/silver dealer and export license", "due_date": "2026-02-28", "severity": "critical", "category": "Core Operations", "penalty": "Export ban and criminal prosecution", "frequency": "Annual", "responsible_authority": "Bank of Zambia"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Precious Metals Production Declaration", "action_required": "Submit monthly production declarations for gold, silver, platinum", "due_date": "2026-02-10", "severity": "high", "category": "Core Operations", "penalty": "ZMW 200,000 fine", "frequency": "Monthly", "responsible_authority": "Ministry of Mines"},
            {"statute": "Bank of Zambia Act Chapter 360", "obligation": "Gold Sales Reporting", "action_required": "Report all gold sales to Bank of Zambia within 7 days", "due_date": "2026-02-07", "severity": "critical", "category": "Core Operations", "penalty": "ZMW 500,000 fine", "frequency": "Per transaction", "responsible_authority": "Bank of Zambia"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Windfall Tax on Precious Metals", "action_required": "Calculate and pay windfall tax when prices exceed threshold", "due_date": "2026-04-21", "severity": "high", "category": "Corporate", "penalty": "25% penalty plus interest", "frequency": "Quarterly", "responsible_authority": "Zambia Revenue Authority"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "Customer Due Diligence Records", "action_required": "Maintain KYC records for all precious metals transactions", "due_date": "2026-12-31", "severity": "critical", "category": "Corporate", "penalty": "License revocation", "frequency": "Ongoing", "responsible_authority": "Financial Intelligence Centre"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Mercury Use Permit", "action_required": "Obtain permit for mercury use in gold processing (artisanal mining)", "due_date": "2026-03-31", "severity": "high", "category": "Environment", "penalty": "ZMW 300,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Employment Act Chapter 268", "obligation": "Annual Employment Returns", "action_required": "File employment statistics with Labour Office", "due_date": "2026-02-28", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 10,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
        ],
        "Industrial Minerals": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Industrial Minerals License Renewal", "action_required": "Submit renewal with production forecasts and development plan", "due_date": "2026-05-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 300,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Mines"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Quarry Operating License", "action_required": "Renew quarrying permit for limestone, granite, etc.", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 200,000 fine", "frequency": "Annual", "responsible_authority": "Mining Cadastre Office"},
            {"statute": "Explosives Act Chapter 115", "obligation": "Explosives Magazine License", "action_required": "Renew license for explosives storage", "due_date": "2026-01-31", "severity": "high", "category": "Core Operations", "penalty": "Criminal prosecution", "frequency": "Annual", "responsible_authority": "Zambia Police"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty plus interest", "frequency": "Annual", "responsible_authority": "ZRA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Dust Suppression Compliance", "action_required": "Submit dust monitoring reports and suppression measures", "due_date": "2026-04-30", "severity": "medium", "category": "Environment", "penalty": "ZMW 100,000 fine", "frequency": "Quarterly", "responsible_authority": "ZEMA"},
            {"statute": "Road Traffic Act Chapter 464", "obligation": "Heavy Vehicle Permits", "action_required": "Obtain permits for overweight/oversized loads", "due_date": "2026-12-31", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 50,000 fine per offense", "frequency": "Annual", "responsible_authority": "Road Transport and Safety Agency"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
        ],
        "Gemstones": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Gemstone Mining License", "action_required": "Renew gemstone mining permit", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Mining suspension", "frequency": "Annual", "responsible_authority": "Ministry of Mines"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Gemstone Trading License", "action_required": "Renew gemstone dealer license for buying/selling", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "Trading ban and ZMW 200,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Mines"},
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Gemstone Export Permit", "action_required": "Obtain export permit for each gemstone shipment", "due_date": "2026-12-31", "severity": "critical", "category": "Core Operations", "penalty": "Seizure of goods", "frequency": "Per shipment", "responsible_authority": "Mining Cadastre Office"},
            {"statute": "Customs and Excise Act Chapter 322", "obligation": "Gemstone Valuation Certificate", "action_required": "Obtain official valuation before export", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Export denial", "frequency": "Per shipment", "responsible_authority": "Government Valuer"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty plus interest", "frequency": "Annual", "responsible_authority": "ZRA"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "Transaction Reporting", "action_required": "Report transactions above USD 10,000", "due_date": "2026-12-31", "severity": "critical", "category": "Corporate", "penalty": "License revocation", "frequency": "Per transaction", "responsible_authority": "FIC"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
        ]
    },
    "construction": {
        "Infrastructure": [
            # Core Operations
            {"statute": "National Council for Construction Act No. 13 of 2003", "obligation": "NCC Contractor Registration", "action_required": "Renew contractor registration with appropriate grade (1-6)", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Prohibition from all construction work", "frequency": "Annual", "responsible_authority": "National Council for Construction"},
            {"statute": "Engineers Registration Act Chapter 507", "obligation": "Professional Engineer Registration", "action_required": "Verify all site engineers are registered with EIZ", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Project suspension and ZMW 100,000 fine", "frequency": "Annual", "responsible_authority": "Engineering Institution of Zambia"},
            {"statute": "Public Procurement Act No. 12 of 2008", "obligation": "ZPPA Supplier Registration", "action_required": "Maintain valid ZPPA supplier registration for government contracts", "due_date": "2026-06-30", "severity": "high", "category": "Core Operations", "penalty": "Disqualification from public tenders", "frequency": "Annual", "responsible_authority": "Zambia Public Procurement Authority"},
            {"statute": "Roads and Road Traffic Act Chapter 464", "obligation": "Road Works Permit", "action_required": "Obtain permit for any work affecting public roads", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Work stoppage and ZMW 150,000 fine", "frequency": "Per project", "responsible_authority": "Road Development Agency"},
            {"statute": "National Road Fund Act No. 13 of 2002", "obligation": "Toll Gate Operator License", "action_required": "Renew toll collection authorization", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "National Road Fund Agency"},
            # Corporate
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return including project portfolio updates", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return with project-by-project accounts", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty plus interest", "frequency": "Annual", "responsible_authority": "ZRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Withholding Tax on Subcontractors", "action_required": "Deduct and remit 15% withholding tax on payments to subcontractors", "due_date": "2026-02-14", "severity": "high", "category": "Corporate", "penalty": "Personal liability for directors", "frequency": "Monthly", "responsible_authority": "ZRA"},
            {"statute": "Value Added Tax Act Chapter 331", "obligation": "VAT Returns Filing", "action_required": "Submit monthly VAT returns", "due_date": "2026-02-21", "severity": "high", "category": "Corporate", "penalty": "ZMW 6,000 per day default", "frequency": "Monthly", "responsible_authority": "ZRA"},
            # Environment
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Construction EIA Approval", "action_required": "Obtain EIA approval for major infrastructure projects", "due_date": "2026-01-31", "severity": "critical", "category": "Environment", "penalty": "Project halt and demolition order", "frequency": "Per project", "responsible_authority": "ZEMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Construction Waste Disposal Plan", "action_required": "Submit and implement approved waste disposal plan", "due_date": "2026-03-31", "severity": "high", "category": "Environment", "penalty": "ZMW 200,000 fine", "frequency": "Per project", "responsible_authority": "ZEMA"},
            {"statute": "Water Resources Management Act No. 21 of 2011", "obligation": "River/Stream Crossing Permit", "action_required": "Obtain permit for bridge construction over water bodies", "due_date": "2026-12-31", "severity": "high", "category": "Environment", "penalty": "ZMW 300,000 fine", "frequency": "Per project", "responsible_authority": "WARMA"},
            # Business Operations
            {"statute": "Occupational Health and Safety Act No. 36 of 2010", "obligation": "Construction Site Safety Plan", "action_required": "Register site safety plan and maintain safety officer", "due_date": "2026-01-15", "severity": "critical", "category": "Business Operations", "penalty": "Site closure", "frequency": "Per project", "responsible_authority": "OHSI"},
            {"statute": "Workers Compensation Act Chapter 271", "obligation": "Construction Workers Insurance", "action_required": "Maintain workers compensation coverage for all site workers", "due_date": "2026-01-31", "severity": "high", "category": "Business Operations", "penalty": "Criminal liability", "frequency": "Annual", "responsible_authority": "WCFCB"},
            {"statute": "Employment Act Chapter 268", "obligation": "Employment Contracts Registration", "action_required": "Register employment contracts for project-based workers", "due_date": "2026-12-31", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 20,000 fine", "frequency": "Per project", "responsible_authority": "Ministry of Labour"},
            {"statute": "National Pension Scheme Act No. 40 of 1996", "obligation": "NAPSA Contributions", "action_required": "Remit pension contributions for all employees", "due_date": "2026-02-14", "severity": "high", "category": "Business Operations", "penalty": "20% penalty", "frequency": "Monthly", "responsible_authority": "NAPSA"},
        ],
        "Commercial Buildings": [
            {"statute": "Urban and Regional Planning Act No. 3 of 2015", "obligation": "Planning Permission", "action_required": "Obtain development permit for commercial construction", "due_date": "2026-01-31", "severity": "critical", "category": "Core Operations", "penalty": "Demolition order", "frequency": "Per project", "responsible_authority": "Local Authority Planning"},
            {"statute": "Urban and Regional Planning Act No. 3 of 2015", "obligation": "Building Permit", "action_required": "Obtain building permit before construction commencement", "due_date": "2026-02-15", "severity": "critical", "category": "Core Operations", "penalty": "ZMW 500,000 fine and demolition", "frequency": "Per project", "responsible_authority": "Local Authority"},
            {"statute": "Urban and Regional Planning Act No. 3 of 2015", "obligation": "Occupancy Certificate", "action_required": "Obtain certificate of occupancy before building use", "due_date": "2026-12-31", "severity": "critical", "category": "Core Operations", "penalty": "Building closure", "frequency": "Per project", "responsible_authority": "Local Authority"},
            {"statute": "National Council for Construction Act No. 13 of 2003", "obligation": "NCC Registration", "action_required": "Maintain valid NCC contractor registration", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Work prohibition", "frequency": "Annual", "responsible_authority": "NCC"},
            {"statute": "Fire Services Act Chapter 432", "obligation": "Fire Safety Certificate", "action_required": "Obtain fire safety approval for commercial buildings", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Occupancy denial", "frequency": "Per project", "responsible_authority": "Fire Brigade"},
            {"statute": "Public Health Act Chapter 295", "obligation": "Sanitary Facilities Approval", "action_required": "Obtain approval for sanitary installations", "due_date": "2026-12-31", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 50,000 fine", "frequency": "Per project", "responsible_authority": "Local Authority Health Dept"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "EIA for Large Buildings", "action_required": "Submit EIA for buildings over 5,000 sqm", "due_date": "2026-01-31", "severity": "high", "category": "Environment", "penalty": "Construction halt", "frequency": "Per project", "responsible_authority": "ZEMA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Residential": [
            {"statute": "Housing (Statutory and Improvement Areas) Act Chapter 194", "obligation": "Housing Developer License", "action_required": "Register as approved housing developer", "due_date": "2026-05-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Housing"},
            {"statute": "Urban and Regional Planning Act No. 3 of 2015", "obligation": "Subdivision Approval", "action_required": "Obtain approval for land subdivision for housing", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Void sales", "frequency": "Per project", "responsible_authority": "Local Authority"},
            {"statute": "Urban and Regional Planning Act No. 3 of 2015", "obligation": "Planning Permission", "action_required": "Obtain development permit for residential projects", "due_date": "2026-01-31", "severity": "critical", "category": "Core Operations", "penalty": "Demolition order", "frequency": "Per project", "responsible_authority": "Local Authority"},
            {"statute": "Lands Act Chapter 184", "obligation": "Title Deed Processing", "action_required": "Process title deeds for purchasers within 12 months", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Civil liability", "frequency": "Per sale", "responsible_authority": "Ministry of Lands"},
            {"statute": "National Council for Construction Act No. 13 of 2003", "obligation": "NCC Registration", "action_required": "Maintain valid contractor registration", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Work prohibition", "frequency": "Annual", "responsible_authority": "NCC"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Sales Contract Compliance", "action_required": "Ensure housing sales contracts comply with consumer protection", "due_date": "2026-12-31", "severity": "medium", "category": "Corporate", "penalty": "Contract voidable", "frequency": "Ongoing", "responsible_authority": "Competition and Consumer Protection Commission"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Property Transfer Tax", "action_required": "Collect and remit property transfer tax on sales", "due_date": "2026-12-31", "severity": "high", "category": "Corporate", "penalty": "20% penalty", "frequency": "Per sale", "responsible_authority": "ZRA"},
        ],
        "Civil Engineering": [
            {"statute": "Roads and Road Traffic Act Chapter 464", "obligation": "Road Construction Permit", "action_required": "Obtain permit for road construction/rehabilitation", "due_date": "2026-04-15", "severity": "high", "category": "Core Operations", "penalty": "Work stoppage", "frequency": "Per project", "responsible_authority": "RDA"},
            {"statute": "National Council for Construction Act No. 13 of 2003", "obligation": "NCC Grade 1 Registration", "action_required": "Maintain Grade 1 NCC registration for major civil works", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Contract termination", "frequency": "Annual", "responsible_authority": "NCC"},
            {"statute": "Engineers Registration Act Chapter 507", "obligation": "Registered Engineer on Site", "action_required": "Ensure registered civil engineer supervises works", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Work stoppage", "frequency": "Per project", "responsible_authority": "EIZ"},
            {"statute": "Water Resources Management Act No. 21 of 2011", "obligation": "Dam Safety Permit", "action_required": "Obtain dam construction/modification permit", "due_date": "2026-12-31", "severity": "critical", "category": "Core Operations", "penalty": "Criminal liability", "frequency": "Per project", "responsible_authority": "WARMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Major Works EIA", "action_required": "Submit EIA for roads, bridges, dams over threshold", "due_date": "2026-01-31", "severity": "critical", "category": "Environment", "penalty": "Project cancellation", "frequency": "Per project", "responsible_authority": "ZEMA"},
            {"statute": "Public Procurement Act No. 12 of 2008", "obligation": "ZPPA Registration", "action_required": "Maintain ZPPA supplier registration", "due_date": "2026-06-30", "severity": "high", "category": "Core Operations", "penalty": "Tender disqualification", "frequency": "Annual", "responsible_authority": "ZPPA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ]
    },
    "agriculture": {
        "Crop Production": [
            {"statute": "Agricultural Credits Act Chapter 224", "obligation": "Agricultural Producer Registration", "action_required": "Register with Food Reserve Agency as commercial producer", "due_date": "2026-03-31", "severity": "medium", "category": "Core Operations", "penalty": "Ineligible for FRA purchase program", "frequency": "Annual", "responsible_authority": "Food Reserve Agency"},
            {"statute": "Plant Variety and Seeds Act No. 22 of 2020", "obligation": "Seed Certification", "action_required": "Certify seed varieties for commercial production and sale", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "Sales prohibition", "frequency": "Per variety", "responsible_authority": "Seed Control and Certification Institute"},
            {"statute": "Plant Pests and Diseases Act Chapter 233", "obligation": "Phytosanitary Certificate", "action_required": "Obtain phytosanitary certificate for crop exports", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Export ban", "frequency": "Per shipment", "responsible_authority": "Plant Quarantine and Phytosanitary Service"},
            {"statute": "Fertilizers and Feed Act Chapter 226", "obligation": "Fertilizer Dealer License", "action_required": "Renew license for fertilizer distribution", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "ZMW 100,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Agriculture"},
            {"statute": "Pesticides and Toxic Substances Act Chapter 225", "obligation": "Pesticide Application License", "action_required": "Obtain license for commercial pesticide application", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 150,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Control of Goods Act Chapter 421", "obligation": "Crop Export Permit", "action_required": "Obtain export permit for controlled crops (maize, etc.)", "due_date": "2026-12-31", "severity": "critical", "category": "Core Operations", "penalty": "Seizure and prosecution", "frequency": "Per shipment", "responsible_authority": "Ministry of Agriculture"},
            {"statute": "Water Resources Management Act No. 21 of 2011", "obligation": "Irrigation Water Permit", "action_required": "Obtain permit for irrigation water abstraction", "due_date": "2026-05-31", "severity": "high", "category": "Environment", "penalty": "ZMW 200,000 fine", "frequency": "Annual", "responsible_authority": "WARMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Large Farm EIA", "action_required": "Submit EIA for farms over 500 hectares", "due_date": "2026-06-30", "severity": "high", "category": "Environment", "penalty": "Operations suspension", "frequency": "Every 5 years", "responsible_authority": "ZEMA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Farm Income Tax", "action_required": "Submit annual farm income tax return", "due_date": "2026-06-21", "severity": "high", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
            {"statute": "Employment Act Chapter 268", "obligation": "Farm Workers Registration", "action_required": "Register seasonal and permanent farm workers", "due_date": "2026-02-28", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 10,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
        ],
        "Livestock": [
            {"statute": "Animal Health Act No. 27 of 2010", "obligation": "Livestock Movement Permit", "action_required": "Obtain permit for moving livestock between districts", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Seizure of animals", "frequency": "Per movement", "responsible_authority": "Department of Veterinary Services"},
            {"statute": "Animal Health Act No. 27 of 2010", "obligation": "Veterinary Health Certificate", "action_required": "Obtain annual health certification for commercial herds", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Sales prohibition", "frequency": "Annual", "responsible_authority": "Department of Veterinary Services"},
            {"statute": "Animal Health Act No. 27 of 2010", "obligation": "Disease Outbreak Reporting", "action_required": "Report notifiable diseases within 24 hours", "due_date": "2026-12-31", "severity": "critical", "category": "Core Operations", "penalty": "ZMW 500,000 fine", "frequency": "Immediate", "responsible_authority": "Department of Veterinary Services"},
            {"statute": "Animal Identification and Traceability Act No. 28 of 2020", "obligation": "Cattle Branding Registration", "action_required": "Register brand marks and tag all cattle", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 100,000 fine", "frequency": "Annual", "responsible_authority": "Livestock Services Department"},
            {"statute": "Dairy Industry Development Act Chapter 231", "obligation": "Dairy Producer License", "action_required": "Renew dairy production and processing license", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "Operations ban", "frequency": "Annual", "responsible_authority": "Dairy Association of Zambia"},
            {"statute": "Control of Goods Act Chapter 421", "obligation": "Livestock Export Permit", "action_required": "Obtain export permit for live animals", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Export ban", "frequency": "Per shipment", "responsible_authority": "Ministry of Agriculture"},
            {"statute": "Food Safety Act No. 7 of 2019", "obligation": "Slaughterhouse License", "action_required": "Maintain abattoir operating license", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Facility closure", "frequency": "Annual", "responsible_authority": "Food and Drugs Authority"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Feedlot EIA", "action_required": "Submit EIA for feedlots over 1,000 animals", "due_date": "2026-06-30", "severity": "high", "category": "Environment", "penalty": "Operations halt", "frequency": "Every 3 years", "responsible_authority": "ZEMA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Forestry": [
            {"statute": "Forests Act No. 4 of 2015", "obligation": "Timber Concession License", "action_required": "Renew forest harvesting concession", "due_date": "2026-06-30", "severity": "critical", "category": "Core Operations", "penalty": "Criminal prosecution and ZMW 1,000,000 fine", "frequency": "Annual", "responsible_authority": "Forestry Department"},
            {"statute": "Forests Act No. 4 of 2015", "obligation": "Timber Dealer License", "action_required": "Renew license for buying/selling timber", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "Forestry Department"},
            {"statute": "Forests Act No. 4 of 2015", "obligation": "Forest Management Plan", "action_required": "Submit annual forest management and reforestation plan", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "License suspension", "frequency": "Annual", "responsible_authority": "Forestry Department"},
            {"statute": "Forests Act No. 4 of 2015", "obligation": "Timber Transport Permit", "action_required": "Obtain permit for transporting timber products", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Seizure of goods", "frequency": "Per transport", "responsible_authority": "Forestry Department"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Logging EIA", "action_required": "Submit EIA for commercial logging operations", "due_date": "2026-01-31", "severity": "critical", "category": "Environment", "penalty": "Operations ban", "frequency": "Per concession", "responsible_authority": "ZEMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Reforestation Compliance", "action_required": "Report on reforestation obligations (2 trees per 1 harvested)", "due_date": "2026-04-30", "severity": "high", "category": "Environment", "penalty": "ZMW 300,000 fine", "frequency": "Annual", "responsible_authority": "Forestry Department"},
            {"statute": "CITES Implementation Act", "obligation": "CITES Permit for Protected Species", "action_required": "Obtain CITES permit for export of protected wood species", "due_date": "2026-12-31", "severity": "critical", "category": "Environment", "penalty": "International trade ban", "frequency": "Per shipment", "responsible_authority": "ZAWA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Fisheries": [
            {"statute": "Fisheries Act No. 22 of 2011", "obligation": "Commercial Fishing License", "action_required": "Renew commercial fishing permit specifying catch limits", "due_date": "2026-01-31", "severity": "high", "category": "Core Operations", "penalty": "Equipment seizure and ZMW 300,000 fine", "frequency": "Annual", "responsible_authority": "Department of Fisheries"},
            {"statute": "Fisheries Act No. 22 of 2011", "obligation": "Fishing Vessel Registration", "action_required": "Register all commercial fishing vessels", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "Vessel impoundment", "frequency": "Annual", "responsible_authority": "Department of Fisheries"},
            {"statute": "Fisheries Act No. 22 of 2011", "obligation": "Catch Returns Submission", "action_required": "Submit monthly catch returns to Fisheries Department", "due_date": "2026-02-15", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 50,000 fine", "frequency": "Monthly", "responsible_authority": "Department of Fisheries"},
            {"statute": "Fisheries Act No. 22 of 2011", "obligation": "Fish Trader License", "action_required": "Renew license for buying and selling fish", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "ZMW 200,000 fine", "frequency": "Annual", "responsible_authority": "Department of Fisheries"},
            {"statute": "Food Safety Act No. 7 of 2019", "obligation": "Fish Processing License", "action_required": "Maintain fish processing facility license", "due_date": "2026-04-30", "severity": "critical", "category": "Core Operations", "penalty": "Facility closure", "frequency": "Annual", "responsible_authority": "Food and Drugs Authority"},
            {"statute": "Aquaculture Act No. 20 of 2011", "obligation": "Aquaculture Farm License", "action_required": "Renew fish farming permit", "due_date": "2026-05-31", "severity": "high", "category": "Core Operations", "penalty": "Operations suspension", "frequency": "Annual", "responsible_authority": "Department of Fisheries"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Aquaculture EIA", "action_required": "Submit EIA for fish farms over 5 hectares", "due_date": "2026-06-30", "severity": "high", "category": "Environment", "penalty": "Operations halt", "frequency": "Every 3 years", "responsible_authority": "ZEMA"},
            {"statute": "Water Resources Management Act No. 21 of 2011", "obligation": "Water Use Permit", "action_required": "Obtain permit for water abstraction for aquaculture", "due_date": "2026-04-30", "severity": "high", "category": "Environment", "penalty": "ZMW 200,000 fine", "frequency": "Annual", "responsible_authority": "WARMA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ]
    },
    "financial": {
        "Banking": [
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Banking License Renewal", "action_required": "Submit annual license compliance report to Bank of Zambia", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "Bank of Zambia"},
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Capital Adequacy Reporting", "action_required": "Submit quarterly capital adequacy ratio reports (minimum 10%)", "due_date": "2026-04-15", "severity": "critical", "category": "Corporate", "penalty": "Corrective action order", "frequency": "Quarterly", "responsible_authority": "Bank of Zambia"},
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Liquidity Ratio Compliance", "action_required": "Maintain and report on minimum liquidity ratios", "due_date": "2026-02-15", "severity": "critical", "category": "Corporate", "penalty": "Restrictions on operations", "frequency": "Monthly", "responsible_authority": "Bank of Zambia"},
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Large Exposure Reporting", "action_required": "Report exposures exceeding 10% of capital", "due_date": "2026-04-15", "severity": "high", "category": "Corporate", "penalty": "ZMW 5,000,000 fine", "frequency": "Quarterly", "responsible_authority": "Bank of Zambia"},
            {"statute": "Financial Intelligence Centre Act No. 46 of 2010", "obligation": "Suspicious Transaction Reports", "action_required": "File STRs within 3 days of detection", "due_date": "2026-12-31", "severity": "critical", "category": "Corporate", "penalty": "ZMW 10,000,000 fine", "frequency": "Per occurrence", "responsible_authority": "Financial Intelligence Centre"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "AML/CFT Compliance Report", "action_required": "Submit annual AML compliance certification", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "License suspension", "frequency": "Annual", "responsible_authority": "FIC"},
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Annual Audited Accounts", "action_required": "Submit audited annual accounts to BoZ", "due_date": "2026-04-30", "severity": "critical", "category": "Corporate", "penalty": "ZMW 2,000,000 fine", "frequency": "Annual", "responsible_authority": "Bank of Zambia"},
            {"statute": "Credit Reporting Act No. 8 of 2022", "obligation": "Credit Bureau Reporting", "action_required": "Submit customer credit data to licensed credit bureaus", "due_date": "2026-02-15", "severity": "high", "category": "Corporate", "penalty": "ZMW 1,000,000 fine", "frequency": "Monthly", "responsible_authority": "Bank of Zambia"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Interest Rate Disclosure", "action_required": "Display and report all interest rates and fees", "due_date": "2026-12-31", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 500,000 fine", "frequency": "Ongoing", "responsible_authority": "CCPC"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty plus interest", "frequency": "Annual", "responsible_authority": "ZRA"},
            {"statute": "Employment Act Chapter 268", "obligation": "Annual Employment Returns", "action_required": "File employment statistics with Labour Office", "due_date": "2026-02-28", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 10,000 fine", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
        ],
        "Insurance": [
            {"statute": "Insurance Act No. 27 of 1997", "obligation": "Insurance License Renewal", "action_required": "Submit annual license renewal application with audited accounts", "due_date": "2026-02-28", "severity": "critical", "category": "Corporate", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "Pensions and Insurance Authority"},
            {"statute": "Insurance Act No. 27 of 1997", "obligation": "Solvency Margin Compliance", "action_required": "Maintain minimum solvency margin and submit quarterly reports", "due_date": "2026-04-15", "severity": "critical", "category": "Corporate", "penalty": "Corrective orders", "frequency": "Quarterly", "responsible_authority": "PIA"},
            {"statute": "Insurance Act No. 27 of 1997", "obligation": "Technical Reserves Reporting", "action_required": "Report on adequacy of technical reserves", "due_date": "2026-04-15", "severity": "critical", "category": "Corporate", "penalty": "Business restrictions", "frequency": "Quarterly", "responsible_authority": "PIA"},
            {"statute": "Insurance Act No. 27 of 1997", "obligation": "Reinsurance Arrangements Report", "action_required": "Submit details of all reinsurance treaties", "due_date": "2026-03-31", "severity": "high", "category": "Corporate", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "PIA"},
            {"statute": "Insurance Act No. 27 of 1997", "obligation": "Investment Policy Compliance", "action_required": "Ensure investments comply with prescribed limits", "due_date": "2026-04-15", "severity": "high", "category": "Corporate", "penalty": "Forced divestiture", "frequency": "Quarterly", "responsible_authority": "PIA"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "AML Compliance Certificate", "action_required": "Submit AML compliance certification", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "License suspension", "frequency": "Annual", "responsible_authority": "FIC"},
            {"statute": "Insurance Act No. 27 of 1997", "obligation": "Claims Settlement Reporting", "action_required": "Report on claims settlement ratios and timelines", "due_date": "2026-04-30", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 200,000 fine", "frequency": "Quarterly", "responsible_authority": "PIA"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Policy Terms Disclosure", "action_required": "Ensure all policy terms clearly disclosed to customers", "due_date": "2026-12-31", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 300,000 fine", "frequency": "Ongoing", "responsible_authority": "CCPC"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Investment": [
            {"statute": "Securities Act No. 41 of 2016", "obligation": "Securities Dealer License", "action_required": "Renew dealer license with SEC", "due_date": "2026-05-31", "severity": "critical", "category": "Corporate", "penalty": "Trading ban", "frequency": "Annual", "responsible_authority": "Securities and Exchange Commission"},
            {"statute": "Securities Act No. 41 of 2016", "obligation": "Investment Advisor Registration", "action_required": "Maintain registration as investment advisor", "due_date": "2026-03-31", "severity": "high", "category": "Corporate", "penalty": "Practice prohibition", "frequency": "Annual", "responsible_authority": "SEC"},
            {"statute": "Securities Act No. 41 of 2016", "obligation": "Net Capital Requirements", "action_required": "Maintain minimum net capital and file monthly reports", "due_date": "2026-02-15", "severity": "critical", "category": "Corporate", "penalty": "License suspension", "frequency": "Monthly", "responsible_authority": "SEC"},
            {"statute": "Securities Act No. 41 of 2016", "obligation": "Client Asset Segregation Report", "action_required": "Report on segregation of client funds and securities", "due_date": "2026-04-15", "severity": "critical", "category": "Corporate", "penalty": "ZMW 5,000,000 fine", "frequency": "Quarterly", "responsible_authority": "SEC"},
            {"statute": "Securities Act No. 41 of 2016", "obligation": "Transaction Reporting", "action_required": "Report all securities transactions to SEC", "due_date": "2026-12-31", "severity": "high", "category": "Corporate", "penalty": "ZMW 100,000 per unreported transaction", "frequency": "Daily", "responsible_authority": "SEC"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "AML Compliance", "action_required": "Implement AML procedures and submit compliance report", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "FIC"},
            {"statute": "Securities Act No. 41 of 2016", "obligation": "Audited Annual Accounts", "action_required": "File audited annual accounts with SEC", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "ZMW 1,000,000 fine", "frequency": "Annual", "responsible_authority": "SEC"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Microfinance": [
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Microfinance License", "action_required": "Renew MFI operating license", "due_date": "2026-04-30", "severity": "critical", "category": "Corporate", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "Bank of Zambia"},
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Quarterly Returns", "action_required": "Submit quarterly financial and operational reports", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "ZMW 500,000 fine", "frequency": "Quarterly", "responsible_authority": "Bank of Zambia"},
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Capital Adequacy", "action_required": "Maintain minimum capital as per tier classification", "due_date": "2026-04-15", "severity": "critical", "category": "Corporate", "penalty": "Downgrade/closure", "frequency": "Quarterly", "responsible_authority": "Bank of Zambia"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "AML Compliance", "action_required": "Implement AML procedures including KYC", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "License suspension", "frequency": "Annual", "responsible_authority": "FIC"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Interest Rate Cap Compliance", "action_required": "Ensure interest rates comply with BoZ guidelines", "due_date": "2026-12-31", "severity": "high", "category": "Business Operations", "penalty": "ZMW 1,000,000 fine", "frequency": "Ongoing", "responsible_authority": "CCPC"},
            {"statute": "Banking and Financial Services Act No. 7 of 2017", "obligation": "Portfolio Quality Report", "action_required": "Report on loan portfolio and PAR ratios", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Corrective action", "frequency": "Quarterly", "responsible_authority": "Bank of Zambia"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ]
    },
    "manufacturing": {
        "FMCG": [
            {"statute": "Food and Drugs Act Chapter 303", "obligation": "Food Product Registration", "action_required": "Register all food products with Food and Drugs Authority", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Product seizure and recall", "frequency": "Per product", "responsible_authority": "Food and Drugs Authority"},
            {"statute": "Food Safety Act No. 7 of 2019", "obligation": "Food Processing License", "action_required": "Renew food processing facility license", "due_date": "2026-02-28", "severity": "critical", "category": "Core Operations", "penalty": "Facility closure", "frequency": "Annual", "responsible_authority": "Food and Drugs Authority"},
            {"statute": "Standards Act No. 4 of 2017", "obligation": "ZABS Product Certification", "action_required": "Obtain quality certification mark from ZABS", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "Sales prohibition", "frequency": "Annual", "responsible_authority": "Zambia Bureau of Standards"},
            {"statute": "Weights and Measures Act Chapter 403", "obligation": "Weights Verification", "action_required": "Calibrate and certify all weighing equipment", "due_date": "2026-02-28", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 50,000 fine", "frequency": "Annual", "responsible_authority": "ZCSA"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Product Labeling Compliance", "action_required": "Ensure labels meet consumer protection requirements", "due_date": "2026-12-31", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 200,000 fine", "frequency": "Ongoing", "responsible_authority": "CCPC"},
            {"statute": "Trade Marks Act Chapter 401", "obligation": "Trademark Registration", "action_required": "Maintain trademark registrations for brands", "due_date": "2026-12-31", "severity": "medium", "category": "Corporate", "penalty": "Brand protection loss", "frequency": "Every 10 years", "responsible_authority": "PACRA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Manufacturing EIA", "action_required": "Submit EIA for manufacturing facilities", "due_date": "2026-06-30", "severity": "high", "category": "Environment", "penalty": "Operations halt", "frequency": "Every 3 years", "responsible_authority": "ZEMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Waste Management Plan", "action_required": "Submit and implement waste management plan", "due_date": "2026-04-30", "severity": "high", "category": "Environment", "penalty": "ZMW 300,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Factories Act Chapter 441", "obligation": "Factory Registration", "action_required": "Maintain factory registration certificate", "due_date": "2026-04-30", "severity": "high", "category": "Business Operations", "penalty": "Closure order", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
            {"statute": "Occupational Health and Safety Act No. 36 of 2010", "obligation": "OHS Compliance", "action_required": "Obtain OHS compliance certificate", "due_date": "2026-03-31", "severity": "high", "category": "Business Operations", "penalty": "ZMW 150,000 fine", "frequency": "Annual", "responsible_authority": "OHSI"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Industrial": [
            {"statute": "Factories Act Chapter 441", "obligation": "Factory Registration Certificate", "action_required": "Renew factory operating certificate", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Closure order", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
            {"statute": "Standards Act No. 4 of 2017", "obligation": "Industrial Standards Compliance", "action_required": "Certify products meet ZS industrial standards", "due_date": "2026-05-31", "severity": "high", "category": "Core Operations", "penalty": "Sales prohibition", "frequency": "Annual", "responsible_authority": "ZABS"},
            {"statute": "Explosives Act Chapter 115", "obligation": "Explosives Storage License", "action_required": "Renew license for explosives storage (if applicable)", "due_date": "2026-01-31", "severity": "critical", "category": "Core Operations", "penalty": "Criminal prosecution", "frequency": "Annual", "responsible_authority": "Zambia Police"},
            {"statute": "Radiation Protection Act Chapter 306", "obligation": "Radiation Source License", "action_required": "Renew license for radioactive sources (if applicable)", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Equipment seizure", "frequency": "Annual", "responsible_authority": "Radiation Protection Authority"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Industrial EIA", "action_required": "Maintain current EIA approval", "due_date": "2026-06-30", "severity": "critical", "category": "Environment", "penalty": "Operations suspension", "frequency": "Every 3 years", "responsible_authority": "ZEMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Effluent Discharge Permit", "action_required": "Obtain/renew effluent discharge license", "due_date": "2026-04-30", "severity": "high", "category": "Environment", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Air Pollution Control Regulations", "obligation": "Air Emission Permit", "action_required": "Obtain permit for air emissions", "due_date": "2026-05-31", "severity": "high", "category": "Environment", "penalty": "ZMW 400,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Occupational Health and Safety Act No. 36 of 2010", "obligation": "OHS Certificate", "action_required": "Obtain annual OHS compliance certificate", "due_date": "2026-03-31", "severity": "high", "category": "Business Operations", "penalty": "Closure", "frequency": "Annual", "responsible_authority": "OHSI"},
            {"statute": "Workers Compensation Act Chapter 271", "obligation": "Workers Compensation", "action_required": "Maintain workers compensation coverage", "due_date": "2026-01-31", "severity": "high", "category": "Business Operations", "penalty": "Criminal liability", "frequency": "Annual", "responsible_authority": "WCFCB"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Textiles": [
            {"statute": "Standards Act No. 4 of 2017", "obligation": "Textile Quality Standards", "action_required": "Certify products meet ZS textile standards", "due_date": "2026-05-31", "severity": "medium", "category": "Core Operations", "penalty": "Export ban", "frequency": "Annual", "responsible_authority": "ZABS"},
            {"statute": "Factories Act Chapter 441", "obligation": "Factory Registration", "action_required": "Renew factory operating certificate", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Closure order", "frequency": "Annual", "responsible_authority": "Ministry of Labour"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Fabric Content Labeling", "action_required": "Label all textiles with accurate fabric content", "due_date": "2026-12-31", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 100,000 fine", "frequency": "Ongoing", "responsible_authority": "CCPC"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Textile Effluent Treatment", "action_required": "Treat dye effluents before discharge", "due_date": "2026-04-30", "severity": "high", "category": "Environment", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Customs and Excise Act Chapter 322", "obligation": "Import/Export Declaration", "action_required": "Declare all textile imports and exports", "due_date": "2026-12-31", "severity": "high", "category": "Corporate", "penalty": "Goods seizure", "frequency": "Per shipment", "responsible_authority": "Zambia Revenue Authority"},
            {"statute": "Citizens Economic Empowerment Act No. 9 of 2006", "obligation": "Local Content Report", "action_required": "Report on use of locally sourced cotton", "due_date": "2026-06-30", "severity": "medium", "category": "Business Operations", "penalty": "Preference withdrawal", "frequency": "Annual", "responsible_authority": "CEEC"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Food Processing": [
            {"statute": "Food Safety Act No. 7 of 2019", "obligation": "Food Processing License", "action_required": "Renew food processing facility license", "due_date": "2026-01-31", "severity": "critical", "category": "Core Operations", "penalty": "Facility closure", "frequency": "Annual", "responsible_authority": "Food and Drugs Authority"},
            {"statute": "Food and Drugs Act Chapter 303", "obligation": "Product Registration", "action_required": "Register all food products for sale", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Product recall", "frequency": "Per product", "responsible_authority": "FDA"},
            {"statute": "Food Safety Act No. 7 of 2019", "obligation": "HACCP Certification", "action_required": "Implement and maintain HACCP system", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "License suspension", "frequency": "Annual audit", "responsible_authority": "FDA"},
            {"statute": "Standards Act No. 4 of 2017", "obligation": "ZABS Quality Mark", "action_required": "Obtain ZABS product certification", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "Sales ban", "frequency": "Annual", "responsible_authority": "ZABS"},
            {"statute": "Public Health Act Chapter 295", "obligation": "Health Inspector Clearance", "action_required": "Pass annual health inspection", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "Closure", "frequency": "Annual", "responsible_authority": "Local Authority Health"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Nutrition Labeling", "action_required": "Provide accurate nutrition information on labels", "due_date": "2026-12-31", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 200,000 fine", "frequency": "Ongoing", "responsible_authority": "CCPC"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Food Processing EIA", "action_required": "Maintain EIA approval for facility", "due_date": "2026-06-30", "severity": "high", "category": "Environment", "penalty": "Operations halt", "frequency": "Every 3 years", "responsible_authority": "ZEMA"},
            {"statute": "Water Resources Management Act No. 21 of 2011", "obligation": "Water Use Permit", "action_required": "Obtain permit for industrial water use", "due_date": "2026-04-30", "severity": "high", "category": "Environment", "penalty": "ZMW 200,000 fine", "frequency": "Annual", "responsible_authority": "WARMA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ]
    },
    "power": {
        "Generation": [
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Power Generation License", "action_required": "Renew electricity generation license", "due_date": "2026-06-30", "severity": "critical", "category": "Core Operations", "penalty": "Generation halt and ZMW 5,000,000 fine", "frequency": "Every 5 years", "responsible_authority": "Energy Regulation Board"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Tariff Application", "action_required": "Submit tariff review application to ERB", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "Tariff freeze", "frequency": "Annual", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Generation Capacity Report", "action_required": "Submit monthly generation and availability reports", "due_date": "2026-02-15", "severity": "high", "category": "Core Operations", "penalty": "ZMW 500,000 fine", "frequency": "Monthly", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Power Purchase Agreement Compliance", "action_required": "Report on PPA compliance and delivery", "due_date": "2026-04-30", "severity": "critical", "category": "Core Operations", "penalty": "Contract termination", "frequency": "Quarterly", "responsible_authority": "ERB"},
            {"statute": "Water Resources Management Act No. 21 of 2011", "obligation": "Hydropower Water Rights", "action_required": "Renew water use permit for hydropower generation", "due_date": "2026-05-31", "severity": "critical", "category": "Core Operations", "penalty": "Operations halt", "frequency": "Annual", "responsible_authority": "WARMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Power Plant EIA", "action_required": "Maintain current EIA approval", "due_date": "2026-06-30", "severity": "critical", "category": "Environment", "penalty": "License revocation", "frequency": "Every 3 years", "responsible_authority": "ZEMA"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Emissions Monitoring Report", "action_required": "Submit annual emissions data (thermal plants)", "due_date": "2026-03-31", "severity": "high", "category": "Environment", "penalty": "ZMW 1,000,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Occupational Health and Safety Act No. 36 of 2010", "obligation": "Power Plant Safety Certificate", "action_required": "Obtain OHS certification for power plant operations", "due_date": "2026-03-31", "severity": "high", "category": "Business Operations", "penalty": "Operations suspension", "frequency": "Annual", "responsible_authority": "OHSI"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Distribution": [
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Distribution License", "action_required": "Maintain electricity distribution license compliance", "due_date": "2026-04-30", "severity": "critical", "category": "Core Operations", "penalty": "License revocation", "frequency": "Annual", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Quality of Supply Standards", "action_required": "Meet and report on quality of supply standards", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "ZMW 2,000,000 fine", "frequency": "Quarterly", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Loss Reduction Report", "action_required": "Report on technical and commercial losses", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "Tariff adjustment denial", "frequency": "Quarterly", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Customer Service Standards", "action_required": "Meet customer service standards (connection times, complaint handling)", "due_date": "2026-12-31", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 500,000 fine", "frequency": "Ongoing", "responsible_authority": "ERB"},
            {"statute": "Consumer Protection Act No. 17 of 2021", "obligation": "Billing Transparency", "action_required": "Ensure transparent and accurate billing", "due_date": "2026-12-31", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 300,000 fine", "frequency": "Ongoing", "responsible_authority": "CCPC"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Wayleave Environmental Compliance", "action_required": "Maintain environmental compliance for distribution lines", "due_date": "2026-06-30", "severity": "high", "category": "Environment", "penalty": "ZMW 500,000 fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
            {"statute": "Occupational Health and Safety Act No. 36 of 2010", "obligation": "Line Worker Safety Training", "action_required": "Certify all line workers complete safety training", "due_date": "2026-03-31", "severity": "high", "category": "Business Operations", "penalty": "Operations restriction", "frequency": "Annual", "responsible_authority": "OHSI"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Renewable Energy": [
            {"statute": "Renewable Energy Feed-in Tariff Policy 2017", "obligation": "REFiT Registration", "action_required": "Register renewable energy project under REFiT scheme", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "Tariff exclusion", "frequency": "Per project", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Renewable Energy License", "action_required": "Obtain generation license for renewable energy facility", "due_date": "2026-03-31", "severity": "critical", "category": "Core Operations", "penalty": "Operations ban", "frequency": "Every 5 years", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Generation Report", "action_required": "Report monthly generation from renewable sources", "due_date": "2026-02-15", "severity": "high", "category": "Core Operations", "penalty": "ZMW 100,000 fine", "frequency": "Monthly", "responsible_authority": "ERB"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Renewable Energy EIA", "action_required": "Submit EIA for solar/wind farms over threshold", "due_date": "2026-01-31", "severity": "high", "category": "Environment", "penalty": "Project halt", "frequency": "Per project", "responsible_authority": "ZEMA"},
            {"statute": "Zambia Development Agency Act No. 11 of 2006", "obligation": "Investment Certificate", "action_required": "Maintain ZDA investment certificate for tax incentives", "due_date": "2026-06-30", "severity": "medium", "category": "Corporate", "penalty": "Incentive loss", "frequency": "Annual", "responsible_authority": "ZDA"},
            {"statute": "Customs and Excise Act Chapter 322", "obligation": "Duty Exemption Application", "action_required": "Apply for duty exemption on renewable energy equipment", "due_date": "2026-12-31", "severity": "medium", "category": "Corporate", "penalty": "Full duty payment", "frequency": "Per import", "responsible_authority": "ZRA"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
        ],
        "Transmission": [
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Transmission License", "action_required": "Maintain electricity transmission license", "due_date": "2026-05-31", "severity": "critical", "category": "Core Operations", "penalty": "Operations halt", "frequency": "Annual", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Grid Code Compliance", "action_required": "Comply with national grid code requirements", "due_date": "2026-12-31", "severity": "critical", "category": "Core Operations", "penalty": "ZMW 3,000,000 fine", "frequency": "Ongoing", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Transmission Capacity Report", "action_required": "Report on transmission capacity and utilization", "due_date": "2026-04-30", "severity": "high", "category": "Core Operations", "penalty": "ZMW 1,000,000 fine", "frequency": "Quarterly", "responsible_authority": "ERB"},
            {"statute": "Energy Regulation Act No. 12 of 2019", "obligation": "Wheeling Charges Approval", "action_required": "Submit wheeling charges for ERB approval", "due_date": "2026-03-31", "severity": "high", "category": "Core Operations", "penalty": "Charge rejection", "frequency": "Annual", "responsible_authority": "ERB"},
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Transmission Line EIA", "action_required": "Maintain EIA approval for transmission corridors", "due_date": "2026-06-30", "severity": "high", "category": "Environment", "penalty": "Construction halt", "frequency": "Per project", "responsible_authority": "ZEMA"},
            {"statute": "Lands Act Chapter 184", "obligation": "Wayleave Agreements", "action_required": "Maintain valid wayleave agreements for transmission lines", "due_date": "2026-12-31", "severity": "high", "category": "Core Operations", "penalty": "Legal action", "frequency": "Ongoing", "responsible_authority": "Ministry of Lands"},
            {"statute": "Companies Act No. 10 of 2017", "obligation": "Annual Return Filing", "action_required": "File annual return with PACRA", "due_date": "2026-04-30", "severity": "high", "category": "Corporate", "penalty": "Company strike-off", "frequency": "Annual", "responsible_authority": "PACRA"},
            {"statute": "Income Tax Act Chapter 323", "obligation": "Corporate Tax Filing", "action_required": "Submit annual corporate tax return", "due_date": "2026-06-21", "severity": "critical", "category": "Corporate", "penalty": "25% penalty", "frequency": "Annual", "responsible_authority": "ZRA"},
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
                # Extract provision from statute name
                statute = obl.get("statute", "")
                provision_match = None
                import re
                match = re.search(r'(?:No\.|Chapter|Act|Section)\s*(\d+(?:\s*of\s*\d+)?)', statute)
                provision = match.group(0) if match else f"Section {idx + 1}"
                
                # Assign owner based on category
                category = obl.get("category", "Corporate")
                owner_map = {
                    "Corporate": "Legal",
                    "Core Operations": "Operations",
                    "Business Operations": "HR",
                    "Environment": "Compliance"
                }
                owner = owner_map.get(category, "Legal")
                
                # Generate legal reference URL
                slug = statute.lower().replace(' ', '-')[:50]
                legal_url = f"https://zambialii.org/legislation/{slug}"
                
                obligations.append({
                    "id": f"{sector_lower}-{sub_sector.lower().replace(' ', '-')}-{idx}",
                    "sector": sector,
                    "sub_sector": sub_sector,
                    "status": "pending" if idx % 5 != 0 else "completed",  # Simulate some completed
                    "provision": provision,
                    "legal_reference_url": legal_url,
                    "owner": owner,
                    "consequences": obl.get("penalty", "Non-compliance penalties apply"),
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
async def get_all_obligations(
    company_id: Optional[str] = None, 
    category: Optional[str] = None, 
    severity: Optional[str] = None,
    status: Optional[str] = None,
    owner: Optional[str] = None
):
    query = {}
    if company_id:
        query["company_id"] = company_id
    if category:
        query["category"] = category
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status
    if owner:
        query["owner"] = owner
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

# Bulk Status Update
class BulkStatusUpdate(BaseModel):
    obligation_ids: List[str]
    status: str

@api_router.post("/obligations/bulk-status")
async def bulk_update_obligation_status(request: BulkStatusUpdate):
    if not request.obligation_ids:
        raise HTTPException(status_code=400, detail="No obligation IDs provided")
    
    valid_statuses = ["pending", "in_progress", "completed", "non_compliant", "overdue"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.obligations.update_many(
        {"id": {"$in": request.obligation_ids}},
        {"$set": {"status": request.status}}
    )
    
    return {
        "message": f"Updated {result.modified_count} obligations",
        "updated_count": result.modified_count,
        "status": request.status
    }

# Auto-mark overdue obligations
@api_router.post("/obligations/mark-overdue")
async def mark_overdue_obligations(company_id: Optional[str] = None):
    """Automatically mark all obligations past their due date as overdue"""
    today = datetime.now(timezone.utc).isoformat()
    
    query = {
        "due_date": {"$lt": today},
        "status": {"$nin": ["completed", "overdue"]}
    }
    if company_id:
        query["company_id"] = company_id
    
    result = await db.obligations.update_many(
        query,
        {"$set": {"status": "overdue"}}
    )
    
    return {
        "message": f"Marked {result.modified_count} obligations as overdue",
        "updated_count": result.modified_count
    }

# Export data endpoint
@api_router.get("/obligations/export")
async def export_obligations(
    company_id: Optional[str] = None,
    format: str = "json"
):
    """Export obligations data for PDF/Excel generation"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    
    obligations = await db.obligations.find(query, {"_id": 0}).to_list(1000)
    
    # Enhance with computed fields
    for obl in obligations:
        if not obl.get("provision"):
            statute = obl.get("statute", "")
            import re
            match = re.search(r'(?:No\.|Chapter|Act|Section)\s*(\d+(?:\s*of\s*\d+)?)', statute)
            obl["provision"] = match.group(0) if match else "See Full Text"
        
        if not obl.get("owner"):
            category = obl.get("category", "Corporate")
            owner_map = {"Corporate": "Legal", "Core Operations": "Operations", "Business Operations": "HR", "Environment": "Compliance"}
            obl["owner"] = owner_map.get(category, "Legal")
        
        if not obl.get("consequences"):
            obl["consequences"] = obl.get("penalty", "Non-compliance penalties apply")
    
    return {
        "obligations": obligations,
        "count": len(obligations),
        "exported_at": datetime.now(timezone.utc).isoformat()
    }

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
async def bulk_user_action(data: BulkUserAction):
    action = data.action
    user_ids = data.user_ids
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
async def create_role(role_data: RoleCreate):
    role = Role(name=role_data.name, display_name=role_data.display_name, description=role_data.description, permissions=role_data.permissions)
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
async def add_ticket_message(ticket_id: str, msg_data: TicketMessageCreate):
    msg = TicketMessage(ticket_id=ticket_id, sender_id=msg_data.sender_id, sender_name=msg_data.sender_name, message=msg_data.message, is_internal=msg_data.is_internal)
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

# VDR (Virtual Data Room) Routes
@api_router.get("/vdr/files")
async def get_vdr_files(company_id: Optional[str] = None, folder: Optional[str] = None):
    query = {}
    if company_id:
        query["company_id"] = company_id
    if folder:
        query["folder"] = folder
    
    files = await db.vdr_files.find(query, {"_id": 0}).sort("uploaded_at", -1).to_list(500)
    return {"files": files, "count": len(files)}

@api_router.post("/vdr/upload")
async def upload_vdr_file(file_data: VDRFileCreate):
    # Check if file with same name exists in folder
    existing = await db.vdr_files.find_one({
        "name": file_data.name,
        "folder": file_data.folder,
        "company_id": file_data.company_id
    })
    
    if existing:
        # Create new version
        new_version = existing.get("version", 1) + 1
        versions = existing.get("versions", [])
        versions.append({
            "version": existing.get("version", 1),
            "uploaded_by": existing.get("uploaded_by"),
            "uploaded_at": existing.get("uploaded_at")
        })
        
        await db.vdr_files.update_one(
            {"id": existing["id"]},
            {"$set": {
                "version": new_version,
                "versions": versions,
                "uploaded_by": file_data.uploaded_by,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "size": file_data.size
            }}
        )
        
        file_id = existing["id"]
    else:
        # Create new file
        file_doc = VDRFile(
            name=file_data.name,
            folder=file_data.folder,
            company_id=file_data.company_id,
            size=file_data.size,
            mime_type=file_data.mime_type,
            uploaded_by=file_data.uploaded_by,
            linked_obligation_id=file_data.linked_obligation_id
        )
        
        await db.vdr_files.insert_one(file_doc.model_dump())
        file_id = file_doc.id
    
    # If linked to obligation, update its status
    if file_data.linked_obligation_id:
        await db.obligations.update_one(
            {"id": file_data.linked_obligation_id},
            {"$set": {"status": "completed"}}
        )
    
    return {"message": "File uploaded", "file_id": file_id}

@api_router.delete("/vdr/files/{file_id}")
async def delete_vdr_file(file_id: str):
    result = await db.vdr_files.delete_one({"id": file_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"message": "File deleted"}

@api_router.get("/vdr/files/{file_id}/versions")
async def get_file_versions(file_id: str):
    file = await db.vdr_files.find_one({"id": file_id}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return {"versions": file.get("versions", []), "current_version": file.get("version", 1)}

@api_router.post("/vdr/files/{file_id}/link")
async def link_file_to_obligation(file_id: str, obligation_id: str):
    # Get obligation name
    obligation = await db.obligations.find_one({"id": obligation_id}, {"_id": 0})
    obligation_name = obligation.get("obligation") if obligation else None
    
    result = await db.vdr_files.update_one(
        {"id": file_id},
        {"$set": {
            "linked_obligation_id": obligation_id,
            "linked_obligation": obligation_name
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Update obligation status to completed
    if obligation:
        await db.obligations.update_one(
            {"id": obligation_id},
            {"$set": {"status": "completed"}}
        )
    
    return {"message": "File linked to obligation", "obligation_name": obligation_name}

# User Invite Route
@api_router.post("/users/invite")
async def invite_user(email: str, name: str, role: str, company_id: Optional[str] = None):
    user = User(
        email=email,
        name=name,
        role=role,
        company_id=company_id,
        status="pending"
    )
    await db.users.insert_one(user.model_dump())
    return {"message": f"Invitation sent to {email}", "user_id": user.id}

# Roles & Permissions Routes
@api_router.get("/roles")
async def get_roles(company_id: Optional[str] = None):
    query = {}
    if company_id:
        query["company_id"] = company_id
    roles = await db.roles.find(query, {"_id": 0}).to_list(100)
    
    # Return default roles if none exist
    if not roles:
        roles = [
            {"id": "admin", "name": "Admin", "description": "Full access", "permissions": ["view_compliance", "edit_compliance", "create_compliance", "delete_compliance", "view_documents", "upload_documents", "delete_documents", "link_documents", "view_users", "invite_users", "edit_users", "delete_users", "view_settings", "edit_settings", "manage_roles"]},
            {"id": "legal", "name": "Legal", "description": "Legal compliance", "permissions": ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "link_documents", "view_users"]},
            {"id": "hr", "name": "HR", "description": "HR compliance", "permissions": ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "link_documents", "view_users"]},
            {"id": "operations", "name": "Operations", "description": "Operations compliance", "permissions": ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "link_documents", "view_users"]},
            {"id": "finance", "name": "Finance", "description": "Financial compliance", "permissions": ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "view_users"]},
            {"id": "viewer", "name": "Viewer", "description": "Read-only access", "permissions": ["view_compliance", "view_documents", "view_users"]}
        ]
    return roles

@api_router.post("/roles")
async def create_role(role: Role):
    await db.roles.insert_one(role.model_dump())
    return {"message": "Role created", "role_id": role.id}

@api_router.put("/roles/{role_id}")
async def update_role(role_id: str, permissions: List[str]):
    result = await db.roles.update_one(
        {"id": role_id},
        {"$set": {"permissions": permissions}}
    )
    if result.modified_count == 0:
        # Create it if doesn't exist
        await db.roles.insert_one({"id": role_id, "permissions": permissions})
    return {"message": "Role permissions updated"}

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
async def create_subscription_plan(plan_data: SubscriptionPlanCreate):
    plan = SubscriptionPlan(name=plan_data.name, price=plan_data.price, features=plan_data.features, user_limit=plan_data.user_limit, storage_limit_gb=plan_data.storage_limit_gb)
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
    medium = sum(1 for o in obligations if o.get('severity') == 'medium')
    low = sum(1 for o in obligations if o.get('severity') == 'low')
    pending = sum(1 for o in obligations if o.get('status') in ['pending', None])
    
    compliance_score = int((completed / total * 100)) if total > 0 else 100
    previous_score = max(0, compliance_score - 7)  # Simulated previous month score
    
    today = datetime.now(timezone.utc)
    thirty_days = today + timedelta(days=30)
    
    # Count overdue items
    overdue = 0
    upcoming = []
    for o in obligations:
        if o.get('due_date'):
            try:
                due_str = o['due_date']
                if 'Z' in due_str:
                    due_date = datetime.fromisoformat(due_str.replace('Z', '+00:00'))
                elif 'T' in due_str:
                    due_date = datetime.fromisoformat(due_str)
                else:
                    due_date = datetime.fromisoformat(due_str + 'T00:00:00+00:00')
                
                if due_date < today and o.get('status') != 'completed':
                    overdue += 1
                if due_date <= thirty_days:
                    upcoming.append(o)
            except:
                pass
    
    categories = {}
    for o in obligations:
        cat = o.get('category', 'Other')
        if cat not in categories:
            categories[cat] = {"total": 0, "completed": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
        categories[cat]["total"] += 1
        if o.get('status') == 'completed':
            categories[cat]["completed"] += 1
        sev = o.get('severity', 'low')
        if sev in categories[cat]:
            categories[cat][sev] += 1
    
    # Generate trend data (simulated historical data based on current score)
    months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    trend_data = []
    base_score = max(50, compliance_score - 20)
    base_completed = max(0, completed - 5)
    for i, month in enumerate(months):
        progress = (i + 1) / len(months)
        trend_data.append({
            "month": month,
            "score": int(base_score + (compliance_score - base_score) * progress),
            "completed": int(base_completed + (completed - base_completed) * progress)
        })
    
    # Severity breakdown for pie chart
    severity_breakdown = [
        {"name": "Critical", "value": critical, "fill": "#ef4444"},
        {"name": "High", "value": high, "fill": "#f59e0b"},
        {"name": "Medium", "value": medium, "fill": "#3b82f6"},
        {"name": "Low", "value": low, "fill": "#10b981"}
    ]
    
    return {
        "company": company,
        "compliance_score": compliance_score,
        "previous_score": previous_score,
        "total_obligations": total,
        "completed_obligations": completed,
        "critical_items": critical,
        "high_priority_items": high,
        "pending_items": pending,
        "overdue_items": overdue,
        "upcoming_deadlines": upcoming[:10],
        "categories": categories,
        "trend_data": trend_data,
        "severity_breakdown": severity_breakdown
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
