import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileStack,
  Search,
  Filter,
  FileText,
  Building2,
  Scale,
  Users,
  Briefcase,
  DollarSign,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Paperclip,
  Download,
  Save,
  Send,
  X,
  Plus,
  Trash2,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const COVE_LOGO = "https://customer-assets.emergentagent.com/job_ede56879-e7c8-4696-b14b-f3e4205ad2d7/artifacts/vpnavke8_Cove%20clean%20logo.png";

// Form Categories
const FORM_CATEGORIES = [
  { id: "tax", name: "Tax & Revenue", icon: DollarSign, color: "bg-emerald-100 text-emerald-700" },
  { id: "corporate", name: "Corporate Filings", icon: Building2, color: "bg-blue-100 text-blue-700" },
  { id: "employment", name: "Employment & Labour", icon: Users, color: "bg-amber-100 text-amber-700" },
  { id: "licenses", name: "Licenses & Permits", icon: Scale, color: "bg-purple-100 text-purple-700" },
  { id: "operations", name: "Operations", icon: Briefcase, color: "bg-cyan-100 text-cyan-700" }
];

// Government Compliance Forms
const FORM_TEMPLATES = [
  // Tax & Revenue
  {
    id: "itr",
    name: "Income Tax Return (ITR)",
    category: "tax",
    authority: "Zambia Revenue Authority",
    description: "Annual corporate income tax return for businesses",
    deadline: "June 21st annually",
    linkedObligation: "Corporate Tax Filing",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "tpin", label: "TPIN Number", type: "text", prefill: "registration_number" },
      { id: "tax_year", label: "Tax Year", type: "select", options: ["2025", "2026"] },
      { id: "gross_income", label: "Gross Income (ZMW)", type: "number" },
      { id: "allowable_deductions", label: "Allowable Deductions (ZMW)", type: "number" },
      { id: "taxable_income", label: "Taxable Income (ZMW)", type: "number" },
      { id: "tax_payable", label: "Tax Payable (ZMW)", type: "number" },
      { id: "contact_person", label: "Contact Person", type: "text" },
      { id: "contact_email", label: "Contact Email", type: "email", prefill: "email" },
      { id: "declaration", label: "Declaration", type: "checkbox", text: "I declare that the information provided is true and correct" }
    ]
  },
  {
    id: "vat",
    name: "VAT Return Form",
    category: "tax",
    authority: "Zambia Revenue Authority",
    description: "Monthly Value Added Tax return submission",
    deadline: "21st of following month",
    linkedObligation: "VAT Returns Filing",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "tpin", label: "TPIN Number", type: "text", prefill: "registration_number" },
      { id: "vat_period", label: "VAT Period", type: "text", placeholder: "e.g., January 2026" },
      { id: "output_vat", label: "Output VAT (ZMW)", type: "number" },
      { id: "input_vat", label: "Input VAT (ZMW)", type: "number" },
      { id: "net_vat", label: "Net VAT Payable/Refundable (ZMW)", type: "number" },
      { id: "total_sales", label: "Total Sales (ZMW)", type: "number" },
      { id: "zero_rated_sales", label: "Zero-Rated Sales (ZMW)", type: "number" },
      { id: "exempt_sales", label: "Exempt Sales (ZMW)", type: "number" }
    ]
  },
  {
    id: "mineral_royalty",
    name: "Mineral Royalty Return",
    category: "tax",
    authority: "Zambia Revenue Authority",
    description: "Quarterly mineral royalty payment for mining companies",
    deadline: "14th of following quarter",
    linkedObligation: "Mineral Royalty Payment",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "mining_license", label: "Mining License Number", type: "text" },
      { id: "quarter", label: "Quarter", type: "select", options: ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"] },
      { id: "mineral_type", label: "Mineral Type", type: "select", options: ["Copper", "Cobalt", "Gold", "Emeralds", "Other"] },
      { id: "gross_value", label: "Gross Value of Minerals (USD)", type: "number" },
      { id: "royalty_rate", label: "Royalty Rate (%)", type: "number" },
      { id: "royalty_payable", label: "Royalty Payable (ZMW)", type: "number" }
    ]
  },
  // Corporate Filings
  {
    id: "annual_return",
    name: "Annual Return (PACRA)",
    category: "corporate",
    authority: "PACRA",
    description: "Annual company return filing with corporate registry",
    deadline: "Anniversary of incorporation",
    linkedObligation: "Annual Return Filing",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "registration_number", label: "Company Registration Number", type: "text", prefill: "registration_number" },
      { id: "registered_address", label: "Registered Address", type: "textarea", prefill: "address" },
      { id: "business_address", label: "Principal Business Address", type: "textarea" },
      { id: "directors", label: "Current Directors", type: "textarea", placeholder: "List all directors with their addresses" },
      { id: "shareholders", label: "Shareholders", type: "textarea", placeholder: "List shareholders and their shareholdings" },
      { id: "share_capital", label: "Authorized Share Capital (ZMW)", type: "number" },
      { id: "issued_capital", label: "Issued Share Capital (ZMW)", type: "number" },
      { id: "agm_date", label: "Date of Last AGM", type: "date" },
      { id: "financial_year_end", label: "Financial Year End", type: "text" }
    ]
  },
  {
    id: "director_change",
    name: "Notice of Change of Directors",
    category: "corporate",
    authority: "PACRA",
    description: "Notification of appointment or resignation of directors",
    deadline: "Within 14 days of change",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "registration_number", label: "Company Registration Number", type: "text", prefill: "registration_number" },
      { id: "change_type", label: "Type of Change", type: "select", options: ["Appointment", "Resignation", "Both"] },
      { id: "director_name", label: "Director Full Name", type: "text" },
      { id: "director_nrc", label: "Director NRC/Passport", type: "text" },
      { id: "director_address", label: "Director Residential Address", type: "textarea" },
      { id: "effective_date", label: "Effective Date", type: "date" },
      { id: "reason", label: "Reason for Change", type: "textarea" }
    ]
  },
  // Employment & Labour
  {
    id: "employment_returns",
    name: "Annual Employment Returns",
    category: "employment",
    authority: "Ministry of Labour",
    description: "Annual workforce statistics submission",
    deadline: "February 28th annually",
    linkedObligation: "Submit Annual Employment Returns",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "tpin", label: "TPIN Number", type: "text", prefill: "registration_number" },
      { id: "sector", label: "Industry Sector", type: "text", prefill: "sector" },
      { id: "total_employees", label: "Total Employees", type: "number" },
      { id: "male_employees", label: "Male Employees", type: "number" },
      { id: "female_employees", label: "Female Employees", type: "number" },
      { id: "zambian_employees", label: "Zambian Employees", type: "number" },
      { id: "expatriate_employees", label: "Expatriate Employees", type: "number" },
      { id: "total_wages", label: "Total Annual Wages (ZMW)", type: "number" },
      { id: "training_expenditure", label: "Training Expenditure (ZMW)", type: "number" }
    ]
  },
  {
    id: "napsa",
    name: "NAPSA Contribution Form",
    category: "employment",
    authority: "NAPSA",
    description: "Monthly pension contribution submission",
    deadline: "14th of following month",
    linkedObligation: "NAPSA Contributions",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "napsa_number", label: "NAPSA Employer Number", type: "text" },
      { id: "contribution_month", label: "Contribution Month", type: "text", placeholder: "e.g., January 2026" },
      { id: "total_employees", label: "Number of Employees", type: "number" },
      { id: "total_earnings", label: "Total Earnings (ZMW)", type: "number" },
      { id: "employee_contribution", label: "Employee Contribution (5%)", type: "number" },
      { id: "employer_contribution", label: "Employer Contribution (5%)", type: "number" },
      { id: "total_contribution", label: "Total Contribution (ZMW)", type: "number" }
    ]
  },
  {
    id: "wcfcb",
    name: "Workers Compensation Form",
    category: "employment",
    authority: "WCFCB",
    description: "Annual workers compensation insurance",
    deadline: "January 31st annually",
    linkedObligation: "Workers Compensation Insurance Renewal",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "wcfcb_number", label: "WCFCB Registration Number", type: "text" },
      { id: "industry_class", label: "Industry Classification", type: "select", options: ["Mining", "Manufacturing", "Construction", "Services", "Agriculture"] },
      { id: "total_employees", label: "Total Employees", type: "number" },
      { id: "annual_wages", label: "Annual Wages Bill (ZMW)", type: "number" },
      { id: "premium_rate", label: "Premium Rate (%)", type: "number" },
      { id: "premium_payable", label: "Premium Payable (ZMW)", type: "number" },
      { id: "previous_claims", label: "Claims in Previous Year", type: "number" }
    ]
  },
  // Licenses & Permits
  {
    id: "mining_license",
    name: "Mining License Renewal",
    category: "licenses",
    authority: "Ministry of Mines",
    description: "Large-scale mining license renewal application",
    deadline: "3 months before expiry",
    linkedObligation: "Large-Scale Mining License Renewal",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "license_number", label: "Current License Number", type: "text" },
      { id: "license_type", label: "License Type", type: "select", options: ["Large-Scale Mining", "Small-Scale Mining", "Artisanal"] },
      { id: "mining_area", label: "Mining Area (km²)", type: "number" },
      { id: "location", label: "Location/Coordinates", type: "text" },
      { id: "minerals", label: "Minerals to be Mined", type: "text" },
      { id: "production_plan", label: "5-Year Production Plan", type: "textarea" },
      { id: "employment_plan", label: "Employment Plan", type: "textarea" },
      { id: "environmental_plan", label: "Environmental Management Plan", type: "textarea" },
      { id: "community_plan", label: "Community Development Plan", type: "textarea" }
    ]
  },
  {
    id: "eia",
    name: "Environmental Impact Assessment",
    category: "licenses",
    authority: "ZEMA",
    description: "Environmental impact assessment submission",
    deadline: "Before project commencement",
    linkedObligation: "Environmental Impact Assessment Report",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "project_name", label: "Project Name", type: "text" },
      { id: "project_location", label: "Project Location", type: "textarea" },
      { id: "project_description", label: "Project Description", type: "textarea" },
      { id: "environmental_impacts", label: "Potential Environmental Impacts", type: "textarea" },
      { id: "mitigation_measures", label: "Mitigation Measures", type: "textarea" },
      { id: "monitoring_plan", label: "Monitoring Plan", type: "textarea" },
      { id: "stakeholder_consultation", label: "Stakeholder Consultation Summary", type: "textarea" },
      { id: "consultant_name", label: "EIA Consultant Name", type: "text" },
      { id: "consultant_registration", label: "Consultant Registration Number", type: "text" }
    ]
  },
  // Operations
  {
    id: "production_returns",
    name: "Quarterly Production Returns",
    category: "operations",
    authority: "Ministry of Mines",
    description: "Quarterly mineral production statistics",
    deadline: "15th of following quarter",
    linkedObligation: "Quarterly Production Reports",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "license_number", label: "Mining License Number", type: "text" },
      { id: "quarter", label: "Reporting Quarter", type: "select", options: ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"] },
      { id: "ore_mined", label: "Ore Mined (tonnes)", type: "number" },
      { id: "ore_processed", label: "Ore Processed (tonnes)", type: "number" },
      { id: "concentrate_produced", label: "Concentrate Produced (tonnes)", type: "number" },
      { id: "metal_grade", label: "Metal Grade (%)", type: "number" },
      { id: "recovery_rate", label: "Recovery Rate (%)", type: "number" },
      { id: "sales_volume", label: "Sales Volume (tonnes)", type: "number" },
      { id: "sales_value", label: "Sales Value (USD)", type: "number" }
    ]
  },
  {
    id: "safety_certificate",
    name: "Mine Safety Certificate Application",
    category: "operations",
    authority: "Mine Safety Department",
    description: "Annual mine safety certification",
    deadline: "Annually",
    linkedObligation: "Mine Safety Certificate",
    fields: [
      { id: "company_name", label: "Company Name", type: "text", prefill: "name" },
      { id: "mine_name", label: "Mine Name", type: "text" },
      { id: "license_number", label: "Mining License Number", type: "text" },
      { id: "safety_officer", label: "Safety Officer Name", type: "text" },
      { id: "safety_officer_cert", label: "Safety Officer Certificate Number", type: "text" },
      { id: "incidents_reported", label: "Incidents in Past Year", type: "number" },
      { id: "fatalities", label: "Fatalities in Past Year", type: "number" },
      { id: "safety_training", label: "Safety Training Conducted", type: "textarea" },
      { id: "equipment_inspection", label: "Equipment Inspection Dates", type: "textarea" },
      { id: "emergency_plan", label: "Emergency Response Plan", type: "textarea" }
    ]
  }
];

// Form Status Types
const FORM_STATUS = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700", icon: Clock },
  pending: { label: "Pending Review", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700", icon: Send },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle }
};

export default function FormsRepository() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [vdrFiles, setVdrFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedForm, setSelectedForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [savedForms, setSavedForms] = useState([]);
  const [activeTab, setActiveTab] = useState("templates");

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [companyRes, vdrRes] = await Promise.all([
        companyId ? axios.get(`${API}/companies/${companyId}`) : Promise.resolve({ data: null }),
        axios.get(`${API}/vdr/files${companyId ? `?company_id=${companyId}` : ''}`)
      ]);
      
      setCompany(companyRes.data || getMockCompany());
      setVdrFiles(vdrRes.data?.files || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setCompany(getMockCompany());
      setVdrFiles(getMockVdrFiles());
    } finally {
      setLoading(false);
    }
  };

  const getMockCompany = () => ({
    id: "mock-1",
    name: "Test Mining Corp",
    registration_number: "RC-2025-12345",
    sector: "mining",
    sub_sector: "Base Metals",
    email: "info@testmining.zm",
    address: "Plot 123, Industrial Area, Kitwe, Zambia",
    phone: "+260 123 456 789"
  });

  const getMockVdrFiles = () => [
    { id: "1", name: "Company_Registration_Certificate.pdf", folder: "corporate" },
    { id: "2", name: "Board_Resolution_2025.pdf", folder: "corporate" },
    { id: "3", name: "Mining_License_2026.pdf", folder: "legal" },
    { id: "4", name: "Environmental_Permit.pdf", folder: "legal" },
    { id: "5", name: "Employment_Policy_Manual.pdf", folder: "hr" },
    { id: "6", name: "Safety_Certificate_2026.pdf", folder: "operations" }
  ];

  // Filter forms
  const filteredForms = FORM_TEMPLATES.filter(form => {
    const matchesSearch = searchQuery === "" || 
      form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || form.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Open form and pre-fill with company data
  const openForm = (template) => {
    const prefilled = {};
    template.fields.forEach(field => {
      if (field.prefill && company) {
        prefilled[field.id] = company[field.prefill] || "";
      } else {
        prefilled[field.id] = "";
      }
    });
    setFormData(prefilled);
    setAttachments([]);
    setSelectedForm(template);
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const addAttachment = (file) => {
    if (!attachments.find(a => a.id === file.id)) {
      setAttachments(prev => [...prev, file]);
    }
    setAttachmentDialogOpen(false);
  };

  const removeAttachment = (fileId) => {
    setAttachments(prev => prev.filter(a => a.id !== fileId));
  };

  const saveFormDraft = () => {
    const saved = {
      id: `form-${Date.now()}`,
      templateId: selectedForm.id,
      templateName: selectedForm.name,
      data: formData,
      attachments: attachments,
      status: "draft",
      savedAt: new Date().toISOString()
    };
    setSavedForms(prev => [...prev, saved]);
    toast.success("Form saved as draft");
    setSelectedForm(null);
  };

  const submitForm = async () => {
    // Validate required fields
    const emptyRequired = selectedForm.fields
      .filter(f => f.type !== 'checkbox')
      .some(f => !formData[f.id]);
    
    if (emptyRequired) {
      toast.error("Please fill in all required fields");
      return;
    }

    const submitted = {
      id: `form-${Date.now()}`,
      templateId: selectedForm.id,
      templateName: selectedForm.name,
      data: formData,
      attachments: attachments,
      status: "submitted",
      savedAt: new Date().toISOString()
    };
    setSavedForms(prev => [...prev, submitted]);
    
    // If linked to obligation, update its status
    if (selectedForm.linkedObligation) {
      toast.success(`Form submitted! "${selectedForm.linkedObligation}" marked as In Progress`);
    } else {
      toast.success("Form submitted successfully");
    }
    
    setSelectedForm(null);
  };

  const getCategoryData = (categoryId) => FORM_CATEGORIES.find(c => c.id === categoryId);

  if (loading) {
    return (
      <div className="min-h-screen bg-ft-salmon flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-cove-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cove-navy text-sm">Loading forms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ft-salmon">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E8D5C4] sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(companyId ? `/dashboard/${companyId}` : '/dashboard')}
                className="gap-1.5 text-cove-navy hover:bg-[#FFF1E5]"
                data-testid="back-btn"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-4 w-px bg-[#E8D5C4]" />
              <div className="flex items-center gap-2">
                <FileStack className="w-5 h-5 text-cove-teal" />
                <h1 className="font-semibold text-cove-navy">Forms Repository</h1>
              </div>
            </div>
            
            <img 
              src={COVE_LOGO}
              alt="Cove" 
              className="h-24 cursor-pointer"
              onClick={() => navigate('/')}
              data-testid="forms-logo"
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-white/60 border border-[#E8D5C4]">
              <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-white">
                <FileText className="w-4 h-4" />
                Form Templates
              </TabsTrigger>
              <TabsTrigger value="saved" className="gap-2 data-[state=active]:bg-white">
                <Save className="w-4 h-4" />
                My Forms
                {savedForms.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{savedForms.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Search & Filter */}
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B5B4F]" />
                <Input
                  placeholder="Search forms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white border-[#E8D5C4]"
                  data-testid="search-input"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 bg-white border-[#E8D5C4]" data-testid="category-filter">
                  <Filter className="w-4 h-4 mr-2 text-[#6B5B4F]" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {FORM_CATEGORIES.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Templates Tab */}
          <TabsContent value="templates">
            {/* Category Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {FORM_CATEGORIES.map(category => {
                const Icon = category.icon;
                const count = FORM_TEMPLATES.filter(f => f.category === category.id).length;
                const isActive = categoryFilter === category.id;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => setCategoryFilter(isActive ? "all" : category.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isActive 
                        ? 'border-cove-teal bg-white shadow-md' 
                        : 'border-transparent bg-white/60 hover:bg-white hover:border-[#E8D5C4]'
                    }`}
                    data-testid={`category-${category.id}`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-medium text-cove-navy text-sm">{category.name}</h3>
                    <p className="text-xs text-[#6B5B4F] mt-1">{count} forms</p>
                  </button>
                );
              })}
            </div>

            {/* Form Templates Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredForms.map((form, idx) => {
                const category = getCategoryData(form.category);
                const CategoryIcon = category?.icon || FileText;
                
                return (
                  <motion.div
                    key={form.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card 
                      className="border-[#E8D5C4] bg-white hover:shadow-lg transition-all cursor-pointer group"
                      onClick={() => openForm(form)}
                      data-testid={`form-template-${form.id}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 rounded-lg ${category?.color || 'bg-slate-100 text-slate-700'} flex items-center justify-center`}>
                            <CategoryIcon className="w-5 h-5" />
                          </div>
                          <ChevronRight className="w-5 h-5 text-[#A89888] group-hover:text-cove-teal group-hover:translate-x-1 transition-all" />
                        </div>
                        <h3 className="font-semibold text-cove-navy mb-1">{form.name}</h3>
                        <p className="text-sm text-[#6B5B4F] mb-3 line-clamp-2">{form.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {form.authority}
                          </Badge>
                          <span className="text-xs text-[#A89888]">
                            Due: {form.deadline}
                          </span>
                        </div>
                        {form.linkedObligation && (
                          <div className="mt-3 pt-3 border-t border-[#E8D5C4]">
                            <span className="text-xs text-cove-teal flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Links to: {form.linkedObligation}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {filteredForms.length === 0 && (
              <div className="text-center py-12 text-[#6B5B4F]">
                <FileStack className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No forms match your search</p>
              </div>
            )}
          </TabsContent>

          {/* Saved Forms Tab */}
          <TabsContent value="saved">
            {savedForms.length === 0 ? (
              <Card className="border-[#E8D5C4] bg-white/80">
                <CardContent className="py-12 text-center">
                  <Save className="w-12 h-12 mx-auto mb-3 text-[#A89888]" />
                  <h3 className="font-medium text-cove-navy mb-2">No Saved Forms</h3>
                  <p className="text-sm text-[#6B5B4F] mb-4">
                    Start filling out a form template to save drafts or submit
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab("templates")}
                  >
                    Browse Templates
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {savedForms.map((saved, idx) => {
                  const template = FORM_TEMPLATES.find(t => t.id === saved.templateId);
                  const status = FORM_STATUS[saved.status];
                  const StatusIcon = status?.icon || Clock;
                  
                  return (
                    <Card key={saved.id} className="border-[#E8D5C4] bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[#FFF8F2] flex items-center justify-center">
                              <FileText className="w-5 h-5 text-cove-navy" />
                            </div>
                            <div>
                              <h4 className="font-medium text-cove-navy">{saved.templateName}</h4>
                              <p className="text-xs text-[#6B5B4F]">
                                Saved {new Date(saved.savedAt).toLocaleDateString('en-GB', {
                                  day: 'numeric', month: 'short', year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={status?.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status?.label}
                            </Badge>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Form Fill Sheet */}
      <Sheet open={!!selectedForm} onOpenChange={() => setSelectedForm(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
          {selectedForm && (
            <>
              <SheetHeader className="pb-4 border-b border-[#E8D5C4]">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${getCategoryData(selectedForm.category)?.color || 'bg-slate-100'} flex items-center justify-center`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <SheetTitle className="text-cove-navy">{selectedForm.name}</SheetTitle>
                    <SheetDescription>{selectedForm.authority}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="py-6 space-y-6">
                  {/* Pre-filled Notice */}
                  {company && (
                    <div className="bg-[#E8F4F4] p-4 rounded-lg border border-cove-teal/20">
                      <p className="text-sm text-cove-teal flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Company details auto-populated from onboarding data
                      </p>
                    </div>
                  )}

                  {/* Form Fields */}
                  <div className="space-y-4">
                    {selectedForm.fields.map((field) => (
                      <div key={field.id}>
                        <Label className="text-cove-navy mb-2 block">
                          {field.label}
                          {field.prefill && (
                            <Badge variant="outline" className="ml-2 text-[10px]">Auto-filled</Badge>
                          )}
                        </Label>
                        
                        {field.type === "text" && (
                          <Input
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder}
                            className="bg-white border-[#E8D5C4]"
                          />
                        )}
                        
                        {field.type === "email" && (
                          <Input
                            type="email"
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className="bg-white border-[#E8D5C4]"
                          />
                        )}
                        
                        {field.type === "number" && (
                          <Input
                            type="number"
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className="bg-white border-[#E8D5C4]"
                          />
                        )}
                        
                        {field.type === "date" && (
                          <Input
                            type="date"
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className="bg-white border-[#E8D5C4]"
                          />
                        )}
                        
                        {field.type === "textarea" && (
                          <Textarea
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className="bg-white border-[#E8D5C4]"
                          />
                        )}
                        
                        {field.type === "select" && (
                          <Select 
                            value={formData[field.id] || ""}
                            onValueChange={(val) => handleFieldChange(field.id, val)}
                          >
                            <SelectTrigger className="bg-white border-[#E8D5C4]">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {field.type === "checkbox" && (
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData[field.id] || false}
                              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                              className="mt-1"
                            />
                            <span className="text-sm text-[#6B5B4F]">{field.text}</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Attachments */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-cove-navy">Attachments from My Cove</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttachmentDialogOpen(true)}
                        className="gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                    
                    {attachments.length === 0 ? (
                      <div className="p-4 border border-dashed border-[#D4C4B5] rounded-lg text-center">
                        <Paperclip className="w-6 h-6 mx-auto mb-2 text-[#A89888]" />
                        <p className="text-sm text-[#6B5B4F]">No attachments added</p>
                        <p className="text-xs text-[#A89888]">Add supporting documents from My Cove</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {attachments.map(file => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-[#FFF8F2] rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-cove-navy" />
                              <span className="text-sm text-cove-navy">{file.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeAttachment(file.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <SheetFooter className="pt-4 border-t border-[#E8D5C4] gap-2">
                <Button variant="outline" onClick={() => setSelectedForm(null)}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={saveFormDraft}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button 
                  onClick={submitForm}
                  style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Form
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Attachment Selection Dialog */}
      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-cove-navy">Add Attachment from My Cove</DialogTitle>
            <DialogDescription>
              Select documents from your Virtual Data Room to attach
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {vdrFiles.length === 0 ? (
                <div className="text-center py-8 text-[#6B5B4F]">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No files in My Cove</p>
                </div>
              ) : (
                vdrFiles.map(file => {
                  const isAttached = attachments.find(a => a.id === file.id);
                  return (
                    <button
                      key={file.id}
                      onClick={() => !isAttached && addAttachment(file)}
                      disabled={isAttached}
                      className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                        isAttached 
                          ? 'border-emerald-200 bg-emerald-50 cursor-not-allowed' 
                          : 'border-[#E8D5C4] hover:border-cove-teal hover:bg-[#FFF8F2]'
                      }`}
                    >
                      <FileText className={`w-5 h-5 ${isAttached ? 'text-emerald-600' : 'text-cove-navy'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isAttached ? 'text-emerald-700' : 'text-cove-navy'}`}>
                          {file.name}
                        </p>
                        <p className="text-xs text-[#6B5B4F] capitalize">{file.folder}</p>
                      </div>
                      {isAttached && (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
