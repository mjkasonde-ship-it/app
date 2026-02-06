from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
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
    size: str  # small, medium, large, enterprise
    sector: str
    sub_sector: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None

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

class Obligation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    statute: str
    obligation: str
    action_required: str
    due_date: str
    severity: str  # critical, high, medium, low
    penalty: Optional[str] = None
    frequency: Optional[str] = None
    responsible_authority: Optional[str] = None
    sector: str
    sub_sector: str
    status: str = "pending"  # pending, in_progress, completed, overdue

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
    role: str  # super-admin, legal-admin, corporate-user
    company_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_active: Optional[datetime] = None
    status: str = "active"

class UserCreate(BaseModel):
    email: str
    name: str
    role: str
    company_id: Optional[str] = None

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
            {"statute": "Workers Compensation Act Chapter 271", "obligation": "Workers Compensation Insurance Renewal", "action_required": "Renew workers compensation coverage", "due_date": "2026-01-31", "severity": "high", "category": "Business Operations", "penalty": "ZMW 200,000 fine", "frequency": "Annual", "responsible_authority": "Workers Compensation Fund Control Board"},
            {"statute": "Mining Regulations 2019", "obligation": "Quarterly Production Reports", "action_required": "Submit mineral production statistics", "due_date": "2026-04-15", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 50,000 fine", "frequency": "Quarterly", "responsible_authority": "Ministry of Mines"},
        ],
        "Precious Metals": [
            {"statute": "Mines and Minerals Development Act No. 11 of 2015", "obligation": "Gold Export License Renewal", "action_required": "Apply for gold export permit renewal", "due_date": "2026-02-28", "severity": "critical", "category": "Core Operations", "penalty": "Export ban", "frequency": "Annual", "responsible_authority": "Bank of Zambia"},
            {"statute": "Anti-Money Laundering Act No. 44 of 2010", "obligation": "AML Compliance Report", "action_required": "Submit AML compliance certificate", "due_date": "2026-03-31", "severity": "critical", "category": "Corporate", "penalty": "Operating license revocation", "frequency": "Annual", "responsible_authority": "Financial Intelligence Centre"},
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
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Construction Environmental Plan", "action_required": "Submit environmental mitigation plan for major projects", "due_date": "2026-02-28", "severity": "high", "category": "Environment", "penalty": "Project halt order", "frequency": "Per project", "responsible_authority": "ZEMA"},
            {"statute": "Public Health Act Chapter 295", "obligation": "Construction Site Health Standards", "action_required": "Ensure compliance with health and safety standards", "due_date": "2026-06-30", "severity": "medium", "category": "Business Operations", "penalty": "ZMW 75,000 fine", "frequency": "Ongoing", "responsible_authority": "Ministry of Health"},
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
            {"statute": "Plant Variety and Seeds Act No. 22 of 2020", "obligation": "Seed Certification", "action_required": "Certify seed varieties for commercial production", "due_date": "2026-02-28", "severity": "high", "category": "Core Operations", "penalty": "Sales prohibition", "frequency": "Per variety", "responsible_authority": "Seed Control and Certification Institute"},
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
            {"statute": "Financial Intelligence Centre Act No. 46 of 2010", "obligation": "Suspicious Transaction Reports", "action_required": "File quarterly STR summary", "due_date": "2026-04-15", "severity": "critical", "category": "Corporate", "penalty": "ZMW 10 million fine", "frequency": "Quarterly", "responsible_authority": "Financial Intelligence Centre"},
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
            {"statute": "Weights and Measures Act Chapter 403", "obligation": "Weights Verification", "action_required": "Calibrate and certify all measuring equipment", "due_date": "2026-02-28", "severity": "medium", "category": "Core Operations", "penalty": "ZMW 50,000 fine", "frequency": "Annual", "responsible_authority": "Zambia Compulsory Standards Agency"},
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
            {"statute": "Environmental Management Act No. 12 of 2011", "obligation": "Emissions Compliance Report", "action_required": "Submit annual emissions data", "due_date": "2026-03-31", "severity": "high", "category": "Environment", "penalty": "ZMW 1 million fine", "frequency": "Annual", "responsible_authority": "ZEMA"},
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

# =========================
# HELPER FUNCTIONS
# =========================

def get_obligations_for_company(sector: str, sub_sector: str) -> List[dict]:
    """Get all obligations applicable to a company based on sector and sub-sector"""
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
    
    # Initialize obligations for the company
    obligations = get_obligations_for_company(company.sector, company.sub_sector)
    for obl in obligations:
        obl['company_id'] = company.id
        await db.obligations.insert_one(obl)
    
    # Calculate initial compliance score
    total = len(obligations)
    company.compliance_score = 100 if total == 0 else 0
    doc['compliance_score'] = company.compliance_score
    
    await db.companies.insert_one(doc)
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
    result = await db.obligations.update_one(
        {"id": obligation_id},
        {"$set": {"status": status}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Obligation not found")
    return {"message": "Status updated", "status": status}

# Legislation/Sector Data Routes
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
    """Generate AI-powered summary of legislation using Claude Sonnet"""
    try:
        emergent_key = os.environ.get('EMERGENT_LLM_KEY')
        if not emergent_key:
            # Fallback mock response if key not available
            return AISummaryResponse(
                summary=f"This obligation under the {request.statute} requires {request.action_required}. Failure to comply may result in significant penalties.",
                approved_by="Legal AI Assistant",
                last_updated=datetime.now(timezone.utc).isoformat(),
                key_points=[
                    "Ensure timely submission before deadline",
                    "Maintain proper documentation",
                    "Consult legal counsel for complex requirements"
                ]
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
        
        # Parse AI response
        import json
        try:
            # Try to extract JSON from the response
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
            key_points=[
                "Ensure timely submission",
                "Maintain documentation",
                "Consult legal counsel"
            ]
        )

# User Management Routes (Admin)
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    user = User(**user_data.model_dump())
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('last_active'):
        doc['last_active'] = doc['last_active'].isoformat()
    await db.users.insert_one(doc)
    return user

@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        if isinstance(user.get('last_active'), str):
            user['last_active'] = datetime.fromisoformat(user['last_active'])
    return users

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# Notification Routes
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
    
    # Calculate compliance score
    compliance_score = int((completed / total * 100)) if total > 0 else 100
    
    # Get upcoming deadlines (next 30 days)
    from datetime import timedelta
    today = datetime.now(timezone.utc)
    thirty_days = today + timedelta(days=30)
    
    upcoming = [o for o in obligations if o.get('due_date') and datetime.fromisoformat(o['due_date'].replace('Z', '+00:00') if 'Z' in o['due_date'] else o['due_date'] + 'T00:00:00+00:00') <= thirty_days]
    
    # Group by category
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
    
    # Sector distribution
    sector_dist = {}
    for c in companies:
        sector = c.get('sector', 'Unknown')
        sector_dist[sector] = sector_dist.get(sector, 0) + 1
    
    # Compliance by severity
    severity_dist = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for o in obligations:
        sev = o.get('severity', 'low')
        if sev in severity_dist:
            severity_dist[sev] += 1
    
    # Monthly trend (mock data for demo)
    monthly_trend = [
        {"month": "Oct", "compliance": 72},
        {"month": "Nov", "compliance": 78},
        {"month": "Dec", "compliance": 82},
        {"month": "Jan", "compliance": 85},
    ]
    
    return {
        "total_companies": len(companies),
        "total_users": len(users),
        "total_obligations": len(obligations),
        "sector_distribution": sector_dist,
        "severity_distribution": severity_dist,
        "monthly_trend": monthly_trend,
        "active_users_today": len([u for u in users if u.get('status') == 'active']),
    }

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
