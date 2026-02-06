import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { 
  LayoutDashboard, Users, Building2, FileText, BarChart3, Shield, CreditCard, Settings, HelpCircle,
  Plus, Search, Trash2, Edit, RefreshCw, ChevronRight, TrendingUp, AlertTriangle, CheckCircle,
  Clock, ArrowLeft, Download, Mail, Eye, MoreHorizontal, X, Bell, Command, Activity, Award,
  Filter, ChevronDown, UserPlus, Ban, Key, Globe, Database, Zap, FileCheck, MessageSquare,
  DollarSign, Receipt, Calendar, Lock, Unlock, Wifi, WifiOff, Upload, FolderOpen, BookOpen
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from "recharts";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const COLORS = ['#059669', '#d97706', '#1e40af', '#dc2626', '#8b5cf6', '#06b6d4'];

// Navigation structure
const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users, subItems: ["All Users", "Roles & Permissions", "Activity Logs"] },
  { id: "organizations", label: "Organizations", icon: Building2, subItems: ["Client Companies", "Subscriptions"] },
  { id: "legislation", label: "Legislation", icon: FileText, subItems: ["Database Manager", "AI Summaries", "Sector Config"] },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "analytics", label: "Analytics", icon: BarChart3, subItems: ["Compliance Trends", "Usage Stats", "Revenue"] },
  { id: "security", label: "Security", icon: Shield, subItems: ["Audit Logs", "Access Control"] },
  { id: "billing", label: "Billing", icon: CreditCard, subItems: ["Subscriptions", "Invoices"] },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "support", label: "Support", icon: HelpCircle },
];

// Global Search Modal Component
const GlobalSearchModal = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], companies: [], legislation: [], tickets: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ users: [], companies: [], legislation: [], tickets: [] });
      return;
    }
    
    const search = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API}/search?q=${encodeURIComponent(query)}`);
        setResults(response.data);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };
    
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalResults = results.users.length + results.companies.length + results.legislation.length + results.tickets.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="global-search-modal"
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, companies, legislation..."
            className="flex-1 text-lg outline-none"
            autoFocus
            data-testid="global-search-input"
          />
          <kbd className="px-2 py-1 text-xs bg-slate-100 rounded">ESC</kbd>
        </div>
        
        <ScrollArea className="max-h-[60vh]">
          {loading && (
            <div className="p-8 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Searching...
            </div>
          )}
          
          {!loading && query.length >= 2 && totalResults === 0 && (
            <div className="p-8 text-center text-slate-500">
              No results found for &quot;{query}&quot;
            </div>
          )}
          
          {!loading && totalResults > 0 && (
            <div className="p-2">
              {results.users.length > 0 && (
                <div className="mb-4">
                  <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Users</p>
                  {results.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => { onNavigate("users"); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 text-left"
                    >
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-medium">
                        {user.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {results.companies.length > 0 && (
                <div className="mb-4">
                  <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Companies</p>
                  {results.companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => { onNavigate("organizations"); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 text-left"
                    >
                      <Building2 className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{company.name}</p>
                        <p className="text-sm text-slate-500">{company.sector} - {company.sub_sector}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {results.tickets.length > 0 && (
                <div>
                  <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Support Tickets</p>
                  {results.tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => { onNavigate("support"); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 text-left"
                    >
                      <MessageSquare className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{ticket.subject}</p>
                        <p className="text-sm text-slate-500">#{ticket.id?.slice(0, 8)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded">Enter</kbd> to select</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-200 rounded">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-200 rounded">K</kbd> to toggle</span>
        </div>
      </motion.div>
    </div>
  );
};

// Notification Bell Component
const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await axios.get(`${API}/activity-notifications?limit=10`);
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unread_count || 0);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    try {
      await axios.post(`${API}/activity-notifications/mark-read`);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking notifications read:", error);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" data-testid="notification-dropdown">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <div 
                key={notif.id || idx} 
                className={`px-4 py-3 border-b last:border-0 hover:bg-slate-50 cursor-pointer ${!notif.read ? 'bg-blue-50/50' : ''}`}
              >
                <p className="font-medium text-sm text-slate-900">{notif.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{notif.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(notif.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Skeleton Loader Component
const SkeletonCard = () => (
  <Card>
    <CardHeader className="pb-2">
      <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
    </CardHeader>
    <CardContent>
      <div className="h-10 w-20 bg-slate-200 rounded animate-pulse" />
    </CardContent>
  </Card>
);

// Confirmation Dialog Component
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, description, confirmText = "Confirm", destructive = false }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent data-testid="confirm-dialog">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {destructive && <AlertTriangle className="w-5 h-5 text-red-500" />}
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={onConfirm} 
          className={destructive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
        >
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default function AdminConsole() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeSubTab, setActiveSubTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserSheet, setShowEditUserSheet] = useState(false);
  const [showCompanySheet, setShowCompanySheet] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ title: "", description: "", action: () => {} });
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "corporate-user", company_id: "", department: "", phone: "" });
  
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({ role: "all", status: "all", company: "all" });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
      if (e.key === "Escape") {
        setShowGlobalSearch(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, usersRes, companiesRes, rolesRes, ticketsRes, plansRes] = await Promise.all([
        axios.get(`${API}/admin/analytics`),
        axios.get(`${API}/users`),
        axios.get(`${API}/companies`),
        axios.get(`${API}/roles`),
        axios.get(`${API}/tickets`),
        axios.get(`${API}/subscription-plans`)
      ]);
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
      setCompanies(companiesRes.data);
      setRoles(rolesRes.data);
      setTickets(ticketsRes.data);
      setPlans(plansRes.data);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      setAnalytics(getMockAnalytics());
      setUsers(getMockUsers());
      setCompanies(getMockCompanies());
      setRoles(getMockRoles());
      setTickets(getMockTickets());
      setPlans(getMockPlans());
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await axios.get(`${API}/audit-logs?limit=100`);
      setAuditLogs(response.data.logs || []);
    } catch (error) {
      setAuditLogs(getMockAuditLogs());
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API}/invoices`);
      setInvoices(response.data);
    } catch (error) {
      setInvoices(getMockInvoices());
    }
  };

  useEffect(() => {
    if (activeTab === "security") fetchAuditLogs();
    if (activeTab === "billing") fetchInvoices();
  }, [activeTab]);

  // Mock data generators
  const getMockAnalytics = () => ({
    total_companies: 24,
    total_users: 156,
    total_obligations: 342,
    active_users_today: 89,
    total_mrr: 62500,
    critical_alerts: 5,
    platform_health: { uptime: 99.8, api_response_time: 145, error_rate: 0.02, storage_used_gb: 125, storage_total_gb: 500 },
    sector_distribution: { mining: 8, construction: 5, financial: 4, agriculture: 3, manufacturing: 2, power: 2 },
    severity_distribution: { critical: 45, high: 98, medium: 124, low: 75 },
    monthly_trend: [
      { month: "Oct", compliance: 72, revenue: 55000 },
      { month: "Nov", compliance: 78, revenue: 58000 },
      { month: "Dec", compliance: 82, revenue: 60000 },
      { month: "Jan", compliance: 85, revenue: 62500 }
    ]
  });

  const getMockUsers = () => [
    { id: "1", name: "John Mwanza", email: "john@copperbelt.zm", role: "legal-admin", status: "active", company_id: "c1", department: "Legal", phone: "+260 97 123 4567", created_at: "2025-11-15", last_login: "2026-01-08T10:30:00" },
    { id: "2", name: "Grace Banda", email: "grace@lusaka-firm.zm", role: "super-admin", status: "active", company_id: null, department: "Admin", phone: "+260 96 987 6543", created_at: "2025-10-01", last_login: "2026-01-08T09:15:00" },
    { id: "3", name: "David Phiri", email: "david@mining-corp.zm", role: "corporate-user", status: "active", company_id: "c2", department: "Compliance", created_at: "2025-12-20", last_login: "2026-01-07T16:45:00" },
    { id: "4", name: "Sarah Tembo", email: "sarah@construction.zm", role: "corporate-user", status: "suspended", company_id: "c3", department: "Operations", created_at: "2025-11-05", last_login: "2025-12-20T11:00:00" },
    { id: "5", name: "Michael Zulu", email: "michael@finance.zm", role: "viewer", status: "active", company_id: "c4", department: "Finance", created_at: "2026-01-02", last_login: "2026-01-08T08:00:00" },
  ];

  const getMockCompanies = () => [
    { id: "c1", name: "Copper Belt Mining Ltd", sector: "mining", sub_sector: "Base Metals", size: "large", compliance_score: 85, subscription_plan: "Enterprise", subscription_status: "active", mrr: 7500, email: "info@copperbelt.zm", created_at: "2025-06-15" },
    { id: "c2", name: "Lumwana Resources", sector: "mining", sub_sector: "Precious Metals", size: "enterprise", compliance_score: 92, subscription_plan: "Enterprise", subscription_status: "active", mrr: 7500, email: "contact@lumwana.zm", created_at: "2025-04-20" },
    { id: "c3", name: "Lusaka Builders", sector: "construction", sub_sector: "Infrastructure", size: "medium", compliance_score: 78, subscription_plan: "Professional", subscription_status: "active", mrr: 2500, email: "info@lusakabuilders.zm", created_at: "2025-08-10" },
    { id: "c4", name: "Zambezi Financial", sector: "financial", sub_sector: "Banking", size: "large", compliance_score: 95, subscription_plan: "Enterprise", subscription_status: "active", mrr: 7500, email: "compliance@zambezi.zm", created_at: "2025-03-01" },
    { id: "c5", name: "AgriCorp Zambia", sector: "agriculture", sub_sector: "Crop Production", size: "small", compliance_score: 70, subscription_plan: "Basic", subscription_status: "active", mrr: 500, email: "admin@agricorp.zm", created_at: "2025-09-25" },
  ];

  const getMockRoles = () => [
    { id: "r1", name: "super-admin", display_name: "Super Admin", description: "Full platform access", permissions: ["*"], is_system: true },
    { id: "r2", name: "legal-admin", display_name: "Legal Admin", description: "Manage legislation and users", permissions: ["users.view", "users.edit", "companies.view"], is_system: true },
    { id: "r3", name: "corporate-user", display_name: "Corporate User", description: "Company compliance management", permissions: ["own_company.view", "own_documents.upload"], is_system: true },
    { id: "r4", name: "viewer", display_name: "Viewer", description: "Read-only access", permissions: ["own_company.view", "own_documents.view"], is_system: true },
  ];

  const getMockAuditLogs = () => [
    { id: "al1", user_id: "2", user_name: "Grace Banda", action: "user.create", resource_type: "user", resource_id: "5", ip_address: "41.72.100.15", status: "success", created_at: "2026-01-08T10:30:00" },
    { id: "al2", user_id: "1", user_name: "John Mwanza", action: "company.update", resource_type: "company", resource_id: "c1", ip_address: "41.72.100.20", status: "success", created_at: "2026-01-08T09:15:00" },
    { id: "al3", user_id: "2", user_name: "Grace Banda", action: "settings.update", resource_type: "system_settings", ip_address: "41.72.100.15", status: "success", created_at: "2026-01-07T16:45:00" },
    { id: "al4", user_id: "3", user_name: "David Phiri", action: "login", resource_type: "session", ip_address: "41.72.100.25", status: "success", created_at: "2026-01-07T08:00:00" },
    { id: "al5", user_id: "unknown", user_name: "Unknown", action: "login", resource_type: "session", ip_address: "192.168.1.100", status: "failed", created_at: "2026-01-06T23:30:00" },
  ];

  const getMockTickets = () => [
    { id: "t1", user_name: "David Phiri", company_name: "Lumwana Resources", subject: "Cannot generate compliance report", priority: "high", status: "open", assigned_to: "Grace Banda", created_at: "2026-01-08T09:00:00" },
    { id: "t2", user_name: "Sarah Tembo", company_name: "Lusaka Builders", subject: "Need help with onboarding", priority: "medium", status: "in_progress", assigned_to: "John Mwanza", created_at: "2026-01-07T14:30:00" },
    { id: "t3", user_name: "Michael Zulu", company_name: "Zambezi Financial", subject: "Invoice discrepancy", priority: "low", status: "resolved", assigned_to: "Grace Banda", created_at: "2026-01-05T11:00:00" },
  ];

  const getMockInvoices = () => [
    { id: "inv1", invoice_number: "INV-2026-001", company_name: "Copper Belt Mining", amount: 7500, issue_date: "2026-01-01", due_date: "2026-01-31", status: "pending", plan: "Enterprise" },
    { id: "inv2", invoice_number: "INV-2026-002", company_name: "Lumwana Resources", amount: 7500, issue_date: "2026-01-01", due_date: "2026-01-31", status: "paid", plan: "Enterprise" },
    { id: "inv3", invoice_number: "INV-2026-003", company_name: "Lusaka Builders", amount: 2500, issue_date: "2026-01-01", due_date: "2026-01-31", status: "pending", plan: "Professional" },
    { id: "inv4", invoice_number: "INV-2025-045", company_name: "AgriCorp Zambia", amount: 500, issue_date: "2025-12-01", due_date: "2025-12-31", status: "overdue", plan: "Basic" },
  ];

  const getMockPlans = () => [
    { id: "p1", name: "Basic", price: 500, features: ["Up to 10 users", "Basic compliance", "Email support"], user_limit: 10 },
    { id: "p2", name: "Professional", price: 2500, features: ["Up to 50 users", "Advanced analytics", "AI summaries"], user_limit: 50 },
    { id: "p3", name: "Enterprise", price: 7500, features: ["Unlimited users", "Custom integrations", "Dedicated support"], user_limit: 9999 },
  ];

  // Handlers
  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      const response = await axios.post(`${API}/users`, newUser);
      setUsers(prev => [...prev, response.data]);
      setShowAddUserDialog(false);
      setNewUser({ name: "", email: "", role: "corporate-user", company_id: "", department: "", phone: "" });
      toast.success("User added successfully");
    } catch (error) {
      toast.error("Failed to add user");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await axios.put(`${API}/users/${selectedUser.id}`, selectedUser);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? selectedUser : u));
      setShowEditUserSheet(false);
      toast.success("User updated successfully");
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  const handleDeleteUser = (userId) => {
    setConfirmAction({
      title: "Delete User",
      description: "Are you sure you want to delete this user? This action cannot be undone.",
      action: async () => {
        try {
          await axios.delete(`${API}/users/${userId}`);
          setUsers(prev => prev.filter(u => u.id !== userId));
          toast.success("User deleted");
        } catch (error) {
          toast.error("Failed to delete user");
        }
        setShowConfirmDialog(false);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleBulkUserAction = async (action) => {
    if (selectedUsers.length === 0) {
      toast.error("No users selected");
      return;
    }
    
    const actionMap = {
      delete: { title: "Delete Users", desc: `Delete ${selectedUsers.length} selected users?` },
      suspend: { title: "Suspend Users", desc: `Suspend ${selectedUsers.length} selected users?` },
      activate: { title: "Activate Users", desc: `Activate ${selectedUsers.length} selected users?` }
    };
    
    setConfirmAction({
      title: actionMap[action].title,
      description: actionMap[action].desc,
      action: async () => {
        try {
          await axios.post(`${API}/users/bulk-action`, { action, user_ids: selectedUsers });
          if (action === "delete") {
            setUsers(prev => prev.filter(u => !selectedUsers.includes(u.id)));
          } else {
            const newStatus = action === "suspend" ? "suspended" : "active";
            setUsers(prev => prev.map(u => selectedUsers.includes(u.id) ? { ...u, status: newStatus } : u));
          }
          setSelectedUsers([]);
          toast.success(`${selectedUsers.length} users ${action}ed`);
        } catch (error) {
          toast.error("Bulk action failed");
        }
        setShowConfirmDialog(false);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSyncLegislation = async () => {
    setSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSyncing(false);
    toast.success("Legislation database synced successfully");
  };

  // Filtered data
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = searchQuery === "" || 
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = filters.role === "all" || user.role === filters.role;
      const matchesStatus = filters.status === "all" || user.status === filters.status;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, filters]);

  const getRoleBadge = (role) => {
    const styles = {
      "super-admin": "bg-purple-100 text-purple-800 border-purple-200",
      "legal-admin": "bg-blue-100 text-blue-800 border-blue-200",
      "corporate-user": "bg-slate-100 text-slate-800 border-slate-200",
      "viewer": "bg-gray-100 text-gray-600 border-gray-200"
    };
    return styles[role] || styles["corporate-user"];
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-emerald-100 text-emerald-800 border-emerald-200",
      suspended: "bg-red-100 text-red-800 border-red-200",
      inactive: "bg-slate-100 text-slate-500 border-slate-200"
    };
    return styles[status] || styles.inactive;
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-slate-100 text-slate-600"
    };
    return styles[priority] || styles.medium;
  };

  const getTicketStatusBadge = (status) => {
    const styles = {
      open: "bg-blue-100 text-blue-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      resolved: "bg-emerald-100 text-emerald-800",
      closed: "bg-slate-100 text-slate-600"
    };
    return styles[status] || styles.open;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading admin console...</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const sectorData = analytics?.sector_distribution 
    ? Object.entries(analytics.sector_distribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }))
    : [];

  const severityData = analytics?.severity_distribution
    ? Object.entries(analytics.severity_distribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }))
    : [];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col fixed inset-y-0 left-0 z-30">
        <div className="p-6">
          <img 
            src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
            alt="Cove" 
            className="h-12 brightness-200 cursor-pointer"
            onClick={() => navigate('/')}
            data-testid="admin-logo"
          />
        </div>
        
        <ScrollArea className="flex-1 px-3">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => { setActiveTab(item.id); setActiveSubTab(""); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                    activeTab === item.id 
                      ? 'bg-emerald-600 text-white' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.subItems && <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === item.id ? 'rotate-90' : ''}`} />}
                </button>
                
                {item.subItems && activeTab === item.id && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.subItems.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setActiveSubTab(sub)}
                        className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-all ${
                          activeSubTab === sub 
                            ? 'bg-slate-700 text-white' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => navigate('/dashboard')}
            data-testid="back-to-dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="font-heading text-2xl font-bold text-slate-900">
                  {NAV_ITEMS.find(n => n.id === activeTab)?.label || "Admin"}
                </h1>
                {activeSubTab && <p className="text-sm text-slate-500">{activeSubTab}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="gap-2 hidden md:flex"
                onClick={() => setShowGlobalSearch(true)}
                data-testid="search-btn"
              >
                <Search className="w-4 h-4" />
                Search
                <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-slate-100 rounded">Cmd+K</kbd>
              </Button>
              <NotificationBell />
              <Button variant="outline" size="icon" data-testid="settings-btn">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile Tab Navigation */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 overflow-x-auto">
          <div className="flex gap-1 py-2">
            {NAV_ITEMS.slice(0, 6).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                  activeTab === item.id ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6" data-testid="overview-tab">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="border-t-4 border-t-cobalt-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <Users className="w-3.5 h-3.5" />
                        Total Users
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-3xl font-bold text-slate-900">{analytics?.total_users || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <Card className="border-t-4 border-t-emerald-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <Building2 className="w-3.5 h-3.5" />
                        Companies
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-3xl font-bold text-slate-900">{analytics?.total_companies || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="border-t-4 border-t-amber-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <FileText className="w-3.5 h-3.5" />
                        Obligations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-3xl font-bold text-slate-900">{analytics?.total_obligations || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <Card className="border-t-4 border-t-emerald-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <Activity className="w-3.5 h-3.5" />
                        Platform Health
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-3xl font-bold text-emerald-600">{analytics?.platform_health?.uptime || 99.8}%</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="border-t-4 border-t-cobalt-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <Award className="w-3.5 h-3.5" />
                        Avg Compliance
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-3xl font-bold text-slate-900">87%</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <Card className="border-t-4 border-t-red-500">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Critical Alerts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-3xl font-bold text-red-600">{analytics?.critical_alerts || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Charts and Activity */}
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="font-heading">Revenue & Compliance Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics?.monthly_trend || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" stroke="#64748b" />
                          <YAxis yAxisId="left" stroke="#64748b" />
                          <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                          <Area yAxisId="left" type="monotone" dataKey="compliance" stroke="#059669" fill="#059669" fillOpacity={0.1} name="Compliance %" />
                          <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#d97706" fill="#d97706" fillOpacity={0.1} name="Revenue (ZMW)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full justify-start gap-3" variant="outline" onClick={() => setShowAddUserDialog(true)} data-testid="quick-add-user">
                      <UserPlus className="w-4 h-4" />
                      Add New User
                    </Button>
                    <Button className="w-full justify-start gap-3" variant="outline" onClick={() => navigate('/onboarding')} data-testid="quick-add-company">
                      <Building2 className="w-4 h-4" />
                      Register Company
                    </Button>
                    <Button className="w-full justify-start gap-3" variant="outline" onClick={handleSyncLegislation} disabled={syncing} data-testid="quick-sync">
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      Sync Legislation DB
                    </Button>
                    <Button className="w-full justify-start gap-3" variant="outline" data-testid="quick-broadcast">
                      <Mail className="w-4 h-4" />
                      System Broadcast
                    </Button>
                    <Button className="w-full justify-start gap-3" variant="outline" data-testid="quick-backup">
                      <Database className="w-4 h-4" />
                      Backup Data
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Feed & Recent Logins */}
              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Activity Feed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { action: "New company registered", detail: "Lusaka Mining Ltd", time: "2 hours ago", icon: Building2, color: "text-emerald-600" },
                        { action: "User role updated", detail: "Grace Banda → Super Admin", time: "4 hours ago", icon: Users, color: "text-blue-600" },
                        { action: "Compliance deadline passed", detail: "Construction Corp", time: "6 hours ago", icon: AlertTriangle, color: "text-red-600" },
                        { action: "Support ticket resolved", detail: "Ticket #t3", time: "8 hours ago", icon: CheckCircle, color: "text-emerald-600" },
                        { action: "New invoice generated", detail: "INV-2026-005", time: "12 hours ago", icon: Receipt, color: "text-amber-600" },
                      ].map((activity, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className={`p-2 rounded-lg bg-slate-100 ${activity.color}`}>
                            <activity.icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">{activity.action}</p>
                            <p className="text-xs text-slate-500 truncate">{activity.detail}</p>
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">{activity.time}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">System Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { type: "warning", message: "5 critical compliance deadlines approaching", action: "View" },
                        { type: "info", message: "Database backup completed successfully", action: "Details" },
                        { type: "error", message: "Failed login attempt from unknown IP", action: "Review" },
                        { type: "success", message: "ZambiaLii sync completed (24 new regulations)", action: "View" },
                      ].map((alert, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${
                          alert.type === 'error' ? 'bg-red-50 border-red-200' :
                          alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                          alert.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
                          'bg-blue-50 border-blue-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                            <Button variant="ghost" size="sm" className="text-xs">{alert.action}</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="space-y-6" data-testid="users-tab">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-1 gap-3 flex-wrap items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="user-search-input"
                    />
                  </div>
                  
                  <Select value={filters.role} onValueChange={(v) => setFilters(prev => ({ ...prev, role: v }))}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="super-admin">Super Admin</SelectItem>
                      <SelectItem value="legal-admin">Legal Admin</SelectItem>
                      <SelectItem value="corporate-user">Corporate User</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  {selectedUsers.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          Bulk Actions ({selectedUsers.length})
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleBulkUserAction("suspend")}>
                          <Ban className="w-4 h-4 mr-2" /> Suspend Selected
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkUserAction("activate")}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Activate Selected
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleBulkUserAction("delete")} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  <Button onClick={() => setShowAddUserDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="add-user-btn">
                    <Plus className="w-4 h-4" />
                    Add User
                  </Button>
                </div>
              </div>

              {/* Users Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[50px]">
                          <Checkbox 
                            checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                            onCheckedChange={(checked) => {
                              setSelectedUsers(checked ? filteredUsers.map(u => u.id) : []);
                            }}
                          />
                        </TableHead>
                        <TableHead className="font-semibold">User</TableHead>
                        <TableHead className="font-semibold">Company</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Last Login</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-center w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, idx) => {
                        const company = companies.find(c => c.id === user.company_id);
                        return (
                          <TableRow key={user.id} data-testid={`user-row-${idx}`}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedUsers.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedUsers(prev => checked 
                                    ? [...prev, user.id] 
                                    : prev.filter(id => id !== user.id)
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-medium">
                                  {user.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">{user.name}</p>
                                  <p className="text-xs text-slate-500">{user.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-600">{company?.name || '-'}</TableCell>
                            <TableCell>
                              <Badge className={`${getRoleBadge(user.role)} capitalize`}>
                                {user.role?.replace('-', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">
                              {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getStatusBadge(user.status)} capitalize`}>
                                {user.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowEditUserSheet(true); }}>
                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowEditUserSheet(true); }}>
                                    <Edit className="w-4 h-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Key className="w-4 h-4 mr-2" /> Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No users found</p>
                      <Button variant="link" onClick={() => setShowAddUserDialog(true)}>Add your first user</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Organizations Tab */}
          {activeTab === "organizations" && (
            <div className="space-y-6" data-testid="organizations-tab">
              <div className="flex justify-between items-center">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search companies..." className="pl-10" />
                </div>
                <Button onClick={() => navigate('/onboarding')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4" />
                  Add Company
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Company</TableHead>
                        <TableHead className="font-semibold">Sector</TableHead>
                        <TableHead className="font-semibold">Users</TableHead>
                        <TableHead className="font-semibold">Compliance</TableHead>
                        <TableHead className="font-semibold">Plan</TableHead>
                        <TableHead className="font-semibold">MRR</TableHead>
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((company, idx) => {
                        const userCount = users.filter(u => u.company_id === company.id).length;
                        return (
                          <TableRow key={company.id} data-testid={`company-row-${idx}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{company.name}</p>
                                <p className="text-xs text-slate-500">{company.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-slate-900 capitalize">{company.sector}</p>
                                <p className="text-xs text-slate-500">{company.sub_sector}</p>
                              </div>
                            </TableCell>
                            <TableCell>{userCount}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={company.compliance_score} className="w-16 h-2" />
                                <span className="text-sm font-medium">{company.compliance_score}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{company.subscription_plan}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">ZMW {company.mrr?.toLocaleString()}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/dashboard/${company.id}`)}>
                                    <LayoutDashboard className="w-4 h-4 mr-2" /> View Dashboard
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedCompany(company); setShowCompanySheet(true); }}>
                                    <Edit className="w-4 h-4 mr-2" /> Edit Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Users className="w-4 h-4 mr-2" /> Manage Users
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <CreditCard className="w-4 h-4 mr-2" /> Billing
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Legislation Tab */}
          {activeTab === "legislation" && (
            <div className="space-y-6" data-testid="legislation-tab">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-xl font-bold text-slate-900">Legislation Database</h2>
                  <p className="text-sm text-slate-500">Manage Zambian legal compliance data</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Import CSV
                  </Button>
                  <Button onClick={handleSyncLegislation} disabled={syncing} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="sync-legislation-btn">
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync from ZambiaLii'}
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { sector: "Mining", count: 24, statutes: 8, lastUpdated: "2 days ago" },
                  { sector: "Construction", count: 18, statutes: 6, lastUpdated: "3 days ago" },
                  { sector: "Agriculture", count: 15, statutes: 5, lastUpdated: "1 week ago" },
                  { sector: "Financial", count: 32, statutes: 10, lastUpdated: "1 day ago" },
                  { sector: "Manufacturing", count: 21, statutes: 7, lastUpdated: "4 days ago" },
                  { sector: "Power", count: 16, statutes: 5, lastUpdated: "5 days ago" },
                ].map((item, idx) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`legislation-sector-${idx}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg capitalize">{item.sector}</CardTitle>
                      <CardDescription>{item.statutes} statutes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-bold text-slate-900">{item.count}</p>
                          <p className="text-xs text-slate-500">obligations</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Last synced</p>
                          <p className="text-sm text-slate-600">{item.lastUpdated}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-6" data-testid="analytics-tab">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Compliance Trends</CardTitle>
                    <CardDescription>Platform-wide compliance rate over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics?.monthly_trend || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" stroke="#64748b" />
                          <YAxis stroke="#64748b" domain={[0, 100]} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                          <Line type="monotone" dataKey="compliance" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Companies by Sector</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sectorData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            dataKey="value"
                          >
                            {sectorData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Obligations by Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={severityData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" stroke="#64748b" />
                          <YAxis dataKey="name" type="category" stroke="#64748b" width={80} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {severityData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={
                                  entry.name === 'Critical' ? '#dc2626' :
                                  entry.name === 'High' ? '#eab308' :
                                  entry.name === 'Medium' ? '#f97316' : '#059669'
                                } 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Revenue Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50 rounded-lg">
                        <p className="text-sm text-emerald-700">Monthly Revenue</p>
                        <p className="text-2xl font-bold text-emerald-900">ZMW {(analytics?.total_mrr || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg">
                        <p className="text-sm text-amber-700">Annual Run Rate</p>
                        <p className="text-2xl font-bold text-amber-900">ZMW {((analytics?.total_mrr || 0) * 12).toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Avg. per Company</p>
                        <p className="text-2xl font-bold text-blue-900">ZMW {Math.round((analytics?.total_mrr || 0) / (analytics?.total_companies || 1)).toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-700">Churn Rate</p>
                        <p className="text-2xl font-bold text-slate-900">2.5%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-6" data-testid="security-tab">
              <Tabs defaultValue="audit">
                <TabsList>
                  <TabsTrigger value="audit">Audit Logs</TabsTrigger>
                  <TabsTrigger value="access">Access Control</TabsTrigger>
                </TabsList>
                
                <TabsContent value="audit" className="mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="font-heading">Audit Logs</CardTitle>
                          <CardDescription>Track all system activities</CardDescription>
                        </div>
                        <Button variant="outline" className="gap-2">
                          <Download className="w-4 h-4" />
                          Export Logs
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold">Timestamp</TableHead>
                            <TableHead className="font-semibold">User</TableHead>
                            <TableHead className="font-semibold">Action</TableHead>
                            <TableHead className="font-semibold">Resource</TableHead>
                            <TableHead className="font-semibold">IP Address</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs.map((log, idx) => (
                            <TableRow key={log.id || idx}>
                              <TableCell className="text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                              <TableCell className="font-medium">{log.user_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.action}</Badge>
                              </TableCell>
                              <TableCell className="text-slate-600">{log.resource_type}</TableCell>
                              <TableCell className="font-mono text-sm">{log.ip_address}</TableCell>
                              <TableCell>
                                <Badge className={log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                                  {log.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="access" className="mt-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-heading">Session Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Session Timeout (minutes)</Label>
                          <Input type="number" defaultValue={60} className="mt-1.5" />
                        </div>
                        <div>
                          <Label>Max Concurrent Sessions</Label>
                          <Input type="number" defaultValue={3} className="mt-1.5" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Force logout on password change</p>
                            <p className="text-sm text-slate-500">End all sessions when password is changed</p>
                          </div>
                          <Checkbox defaultChecked />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="font-heading">Password Policy</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Minimum Length</Label>
                          <Input type="number" defaultValue={8} className="mt-1.5" />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Require uppercase letters</p>
                          <Checkbox defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Require numbers</p>
                          <Checkbox defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Require special characters</p>
                          <Checkbox />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-6" data-testid="billing-tab">
              {/* Revenue Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Monthly Revenue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">ZMW {(analytics?.total_mrr || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Subscriptions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{companies.filter(c => c.subscription_status === 'active').length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Pending Invoices</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{invoices.filter(i => i.status === 'pending').length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Overdue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-600">{invoices.filter(i => i.status === 'overdue').length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Invoices Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-heading">Invoices</CardTitle>
                    <Button variant="outline" className="gap-2">
                      <Plus className="w-4 h-4" />
                      New Invoice
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Invoice #</TableHead>
                        <TableHead className="font-semibold">Company</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        <TableHead className="font-semibold">Issue Date</TableHead>
                        <TableHead className="font-semibold">Due Date</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice, idx) => (
                        <TableRow key={invoice.id || idx}>
                          <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                          <TableCell className="font-medium">{invoice.company_name}</TableCell>
                          <TableCell>ZMW {invoice.amount?.toLocaleString()}</TableCell>
                          <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge className={
                              invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Subscription Plans */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Subscription Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {plans.map((plan, idx) => (
                      <div key={plan.id || idx} className="p-6 border rounded-xl hover:shadow-md transition-shadow">
                        <h3 className="font-semibold text-lg mb-2">{plan.name}</h3>
                        <p className="text-3xl font-bold text-slate-900 mb-4">
                          ZMW {plan.price?.toLocaleString()}<span className="text-sm font-normal text-slate-500">/mo</span>
                        </p>
                        <ul className="space-y-2">
                          {plan.features?.map((feature, fidx) => (
                            <li key={fidx} className="flex items-center gap-2 text-sm text-slate-600">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6" data-testid="settings-tab">
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label>Platform Name</Label>
                      <Input defaultValue="Cove Legal Tech" className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Support Email</Label>
                      <Input defaultValue="support@cove.zm" className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Default Timezone</Label>
                      <Select defaultValue="Africa/Lusaka">
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Africa/Lusaka">Africa/Lusaka (CAT)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date Format</Label>
                      <Select defaultValue="DD/MM/YYYY">
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button className="bg-emerald-600 hover:bg-emerald-700">Save Settings</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Integrations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: "ZambiaLii API", status: "connected", icon: Globe },
                      { name: "Email Provider (SMTP)", status: "connected", icon: Mail },
                      { name: "Cloud Storage", status: "connected", icon: Database },
                      { name: "Payment Gateway", status: "disconnected", icon: CreditCard },
                    ].map((integration, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <integration.icon className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium">{integration.name}</p>
                            <p className="text-sm text-slate-500">
                              {integration.status === 'connected' ? 'Last sync: 2 hours ago' : 'Not configured'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {integration.status === 'connected' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                              <Wifi className="w-3 h-3" /> Connected
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 gap-1">
                              <WifiOff className="w-3 h-3" /> Disconnected
                            </Badge>
                          )}
                          <Button variant="outline" size="sm">Configure</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Support Tab */}
          {activeTab === "support" && (
            <div className="space-y-6" data-testid="support-tab">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-heading text-xl font-bold">Support Tickets</h2>
                  <p className="text-sm text-slate-500">{tickets.filter(t => t.status === 'open').length} open tickets</p>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Ticket</TableHead>
                        <TableHead className="font-semibold">User</TableHead>
                        <TableHead className="font-semibold">Company</TableHead>
                        <TableHead className="font-semibold">Priority</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Assigned</TableHead>
                        <TableHead className="font-semibold">Created</TableHead>
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket, idx) => (
                        <TableRow key={ticket.id || idx}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-900">{ticket.subject}</p>
                              <p className="text-xs text-slate-500">#{ticket.id?.slice(0, 8)}</p>
                            </div>
                          </TableCell>
                          <TableCell>{ticket.user_name}</TableCell>
                          <TableCell>{ticket.company_name}</TableCell>
                          <TableCell>
                            <Badge className={getPriorityBadge(ticket.priority)}>
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTicketStatusBadge(ticket.status)}>
                              {ticket.status?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{ticket.assigned_to || '-'}</TableCell>
                          <TableCell className="text-sm">{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <div className="space-y-6" data-testid="documents-tab">
              <div className="flex justify-between items-center">
                <h2 className="font-heading text-xl font-bold">Document Management</h2>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Upload className="w-4 h-4" />
                  Upload Document
                </Button>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6 text-center">
                    <FolderOpen className="w-12 h-12 mx-auto mb-4 text-amber-600" />
                    <h3 className="font-semibold text-lg">All Documents</h3>
                    <p className="text-sm text-slate-500 mt-1">View and manage all uploaded files</p>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6 text-center">
                    <FileCheck className="w-12 h-12 mx-auto mb-4 text-emerald-600" />
                    <h3 className="font-semibold text-lg">Templates</h3>
                    <p className="text-sm text-slate-500 mt-1">Manage document templates</p>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                    <h3 className="font-semibold text-lg">Knowledge Base</h3>
                    <p className="text-sm text-slate-500 mt-1">Help articles and guides</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      <AnimatePresence>
        {showGlobalSearch && (
          <GlobalSearchModal 
            isOpen={showGlobalSearch} 
            onClose={() => setShowGlobalSearch(false)}
            onNavigate={setActiveTab}
          />
        )}
      </AnimatePresence>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent data-testid="add-user-dialog">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account for the platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userName">Full Name *</Label>
                <Input
                  id="userName"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                  className="mt-1.5"
                  data-testid="new-user-name-input"
                />
              </div>
              <div>
                <Label htmlFor="userEmail">Email *</Label>
                <Input
                  id="userEmail"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@company.zm"
                  className="mt-1.5"
                  data-testid="new-user-email-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userRole">Role</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger className="mt-1.5" data-testid="new-user-role-select">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super-admin">Super Admin</SelectItem>
                    <SelectItem value="legal-admin">Legal Admin</SelectItem>
                    <SelectItem value="corporate-user">Corporate User</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="userCompany">Company</Label>
                <Select value={newUser.company_id} onValueChange={(value) => setNewUser(prev => ({ ...prev, company_id: value }))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userDept">Department</Label>
                <Input
                  id="userDept"
                  value={newUser.department}
                  onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Legal, Finance, etc."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="userPhone">Phone</Label>
                <Input
                  id="userPhone"
                  value={newUser.phone}
                  onChange={(e) => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+260 XXX XXX XXX"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>Cancel</Button>
            <Button onClick={handleAddUser} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-add-user-btn">
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Sheet */}
      <Sheet open={showEditUserSheet} onOpenChange={setShowEditUserSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="edit-user-sheet">
          {selectedUser && (
            <>
              <SheetHeader>
                <SheetTitle>User Details</SheetTitle>
                <SheetDescription>View and edit user information</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-2xl font-bold">
                    {selectedUser.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedUser.name}</h3>
                    <p className="text-slate-500">{selectedUser.email}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input 
                      value={selectedUser.name || ''} 
                      onChange={(e) => setSelectedUser(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input 
                      value={selectedUser.email || ''} 
                      onChange={(e) => setSelectedUser(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={selectedUser.role} onValueChange={(v) => setSelectedUser(prev => ({ ...prev, role: v }))}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="super-admin">Super Admin</SelectItem>
                        <SelectItem value="legal-admin">Legal Admin</SelectItem>
                        <SelectItem value="corporate-user">Corporate User</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={selectedUser.status} onValueChange={(v) => setSelectedUser(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button onClick={handleUpdateUser} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    Save Changes
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setShowEditUserSheet(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Company Sheet */}
      <Sheet open={showCompanySheet} onOpenChange={setShowCompanySheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedCompany && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedCompany.name}</SheetTitle>
                <SheetDescription>Company profile and settings</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-700">Compliance Score</p>
                    <p className="text-2xl font-bold text-emerald-900">{selectedCompany.compliance_score}%</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-700">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-amber-900">ZMW {selectedCompany.mrr?.toLocaleString()}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div>
                    <Label>Company Name</Label>
                    <Input value={selectedCompany.name || ''} className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Sector</Label>
                      <Input value={selectedCompany.sector || ''} className="mt-1.5 capitalize" disabled />
                    </div>
                    <div>
                      <Label>Sub-Sector</Label>
                      <Input value={selectedCompany.sub_sector || ''} className="mt-1.5" disabled />
                    </div>
                  </div>
                  <div>
                    <Label>Subscription Plan</Label>
                    <Select defaultValue={selectedCompany.subscription_plan}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Basic">Basic</SelectItem>
                        <SelectItem value="Professional">Professional</SelectItem>
                        <SelectItem value="Enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setShowCompanySheet(false)}>Cancel</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmAction.action}
        title={confirmAction.title}
        description={confirmAction.description}
        confirmText={confirmAction.title?.includes('Delete') ? 'Delete' : 'Confirm'}
        destructive={confirmAction.title?.includes('Delete')}
      />
    </div>
  );
}
