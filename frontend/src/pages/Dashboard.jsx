import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  FileText, 
  Calendar, 
  Settings,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Bell,
  Building2,
  Scale,
  Briefcase,
  Leaf,
  Menu,
  ArrowUpRight,
  Shield,
  Target,
  Activity,
  FolderOpen,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
  Legend
} from "recharts";

// New Cove logo URL
const COVE_LOGO = "https://customer-assets.emergentagent.com/job_ede56879-e7c8-4696-b14b-f3e4205ad2d7/artifacts/vpnavke8_Cove%20clean%20logo.png";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const CATEGORY_ICONS = {
  "Corporate": Building2,
  "Core Operations": Briefcase,
  "Business Operations": Scale,
  "Environment": Leaf
};

const CATEGORY_COLORS = {
  "Corporate": { bg: "bg-blue-50", text: "text-blue-700", accent: "#3b82f6", ring: "ring-blue-200" },
  "Core Operations": { bg: "bg-amber-50", text: "text-amber-700", accent: "#f59e0b", ring: "ring-amber-200" },
  "Business Operations": { bg: "bg-violet-50", text: "text-violet-700", accent: "#8b5cf6", ring: "ring-violet-200" },
  "Environment": { bg: "bg-emerald-50", text: "text-emerald-700", accent: "#10b981", ring: "ring-emerald-200" }
};

const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f59e0b", 
  medium: "#3b82f6",
  low: "#10b981"
};

const SEVERITY_INSIGHTS = {
  Critical: "Requires immediate attention - potential legal/financial penalties",
  High: "Address within 7 days to avoid compliance risks",
  Medium: "Schedule for completion within 30 days",
  Low: "Can be addressed during regular review cycles"
};

// Enhanced Trend Chart Tooltip with insights
const TrendTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const scoreData = payload.find(p => p.dataKey === 'score');
    const completedData = payload.find(p => p.dataKey === 'completed');
    const score = scoreData?.value || 0;
    const completed = completedData?.value || 0;
    
    let insight = "";
    let insightColor = "text-slate-400";
    if (score >= 80) {
      insight = "Excellent compliance posture";
      insightColor = "text-emerald-400";
    } else if (score >= 60) {
      insight = "Good progress, continue momentum";
      insightColor = "text-blue-400";
    } else if (score >= 40) {
      insight = "Needs attention - prioritize critical items";
      insightColor = "text-amber-400";
    } else {
      insight = "Urgent action required";
      insightColor = "text-red-400";
    }
    
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-sm shadow-2xl border border-slate-700/50 min-w-[200px]">
        <p className="font-semibold text-base border-b border-slate-700 pb-2 mb-2">{label} 2025</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Compliance Score
            </span>
            <span className="font-bold text-emerald-400">{score}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Tasks Completed
            </span>
            <span className="font-bold text-blue-400">{completed}</span>
          </div>
        </div>
        <div className={`mt-3 pt-2 border-t border-slate-700 ${insightColor} text-xs`}>
          <span className="opacity-70">Insight:</span> {insight}
        </div>
      </div>
    );
  }
  return null;
};

// Enhanced Severity Pie Chart Tooltip
const SeverityTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const name = data.name;
    const value = data.value;
    const total = data.payload?.total || 24;
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    const insight = SEVERITY_INSIGHTS[name] || "";
    
    const colorMap = {
      Critical: "text-red-400",
      High: "text-amber-400",
      Medium: "text-blue-400",
      Low: "text-emerald-400"
    };
    
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-sm shadow-2xl border border-slate-700/50 min-w-[220px]">
        <div className="flex items-center gap-2 border-b border-slate-700 pb-2 mb-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload?.fill }}></span>
          <span className="font-semibold text-base">{name} Priority</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Obligations</span>
            <span className={`font-bold ${colorMap[name]}`}>{value} items</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Portfolio Share</span>
            <span className="font-medium">{percentage}%</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-700 text-xs text-slate-400">
          <span className="opacity-70">Action:</span> {insight}
        </div>
      </div>
    );
  }
  return null;
};

// Enhanced Category Bar Chart Tooltip
const CategoryTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const completed = payload.find(p => p.dataKey === 'completed')?.value || 0;
    const total = payload.find(p => p.dataKey === 'value')?.value || 0;
    const remaining = total;
    const allTotal = completed + remaining;
    const progress = allTotal > 0 ? Math.round((completed / allTotal) * 100) : 0;
    
    let statusText = "";
    let statusColor = "";
    if (progress >= 80) {
      statusText = "On track";
      statusColor = "text-emerald-400";
    } else if (progress >= 50) {
      statusText = "In progress";
      statusColor = "text-blue-400";
    } else if (progress >= 25) {
      statusText = "Needs focus";
      statusColor = "text-amber-400";
    } else {
      statusText = "Behind schedule";
      statusColor = "text-red-400";
    }
    
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-sm shadow-2xl border border-slate-700/50 min-w-[200px]">
        <p className="font-semibold text-base border-b border-slate-700 pb-2 mb-2">{label}</p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Completed
            </span>
            <span className="font-bold text-emerald-400">{completed}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Remaining
            </span>
            <span className="font-medium text-slate-300">{remaining}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-700">
            <span className="text-slate-400">Progress</span>
            <span className="font-bold">{progress}%</span>
          </div>
        </div>
        <div className={`mt-2 text-xs ${statusColor}`}>
          Status: {statusText}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats/${companyId}`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast.error("Failed to load dashboard data");
      setStats(getMockStats());
    } finally {
      setLoading(false);
    }
  };

  const fetchDemoData = async () => {
    try {
      const companiesRes = await axios.get(`${API}/companies`);
      if (companiesRes.data.length > 0) {
        const company = companiesRes.data[0];
        navigate(`/dashboard/${company.id}`, { replace: true });
        return;
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
    setStats(getMockStats());
    setLoading(false);
  };

  const getMockStats = () => ({
    company: { name: "Demo Mining Corp", sector: "mining", sub_sector: "Base Metals" },
    compliance_score: 75,
    previous_score: 68,
    total_obligations: 24,
    completed_obligations: 9,
    critical_items: 3,
    high_priority_items: 6,
    pending_items: 12,
    overdue_items: 2,
    upcoming_deadlines: [
      { id: "1", obligation: "Annual Mining License Renewal", due_date: "2026-03-31", severity: "high", statute: "Mines and Minerals Development Act" },
      { id: "2", obligation: "Environmental Impact Assessment", due_date: "2026-06-30", severity: "critical", statute: "Environmental Management Act" },
      { id: "3", obligation: "Submit Annual Employment Returns", due_date: "2026-02-28", severity: "medium", statute: "Employment Act" },
      { id: "4", obligation: "Quarterly Production Returns", due_date: "2026-04-15", severity: "high", statute: "Mines and Minerals Development Act" },
      { id: "5", obligation: "Mine Safety Certificate", due_date: "2026-02-28", severity: "critical", statute: "Mines and Minerals Development Act" },
    ],
    categories: {
      "Corporate": { total: 6, completed: 3, critical: 1, high: 2, medium: 2, low: 1 },
      "Core Operations": { total: 8, completed: 2, critical: 2, high: 3, medium: 2, low: 1 },
      "Business Operations": { total: 6, completed: 3, critical: 0, high: 1, medium: 3, low: 2 },
      "Environment": { total: 4, completed: 1, critical: 0, high: 2, medium: 1, low: 1 }
    },
    trend_data: [
      { month: "Jul", score: 58, completed: 4 },
      { month: "Aug", score: 62, completed: 5 },
      { month: "Sep", score: 65, completed: 6 },
      { month: "Oct", score: 68, completed: 7 },
      { month: "Nov", score: 72, completed: 8 },
      { month: "Dec", score: 75, completed: 9 }
    ],
    severity_breakdown: [
      { name: "Critical", value: 3, fill: SEVERITY_COLORS.critical },
      { name: "High", value: 6, fill: SEVERITY_COLORS.high },
      { name: "Medium", value: 8, fill: SEVERITY_COLORS.medium },
      { name: "Low", value: 7, fill: SEVERITY_COLORS.low }
    ]
  });

  useEffect(() => {
    if (companyId) {
      fetchDashboardData();
    } else {
      fetchDemoData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const getSeverityBadge = (severity) => {
    const styles = {
      critical: "bg-red-100 text-red-800 border-red-200",
      high: "bg-amber-100 text-amber-800 border-amber-200",
      medium: "bg-blue-100 text-blue-800 border-blue-200",
      low: "bg-emerald-100 text-emerald-800 border-emerald-200"
    };
    return styles[severity] || styles.medium;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getDaysUntil = (dateStr) => {
    const today = new Date();
    const dueDate = new Date(dateStr);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getScoreChange = () => {
    if (!stats) return 0;
    return stats.compliance_score - (stats.previous_score || 0);
  };

  // Prepare pie chart data for categories
  const categoryPieData = stats ? Object.entries(stats.categories).map(([name, data]) => ({
    name,
    value: data.total,
    completed: data.completed,
    fill: CATEGORY_COLORS[name]?.accent || "#64748b"
  })) : [];

  // Prepare severity data with total for tooltip percentages
  const severityDataWithTotal = stats?.severity_breakdown?.map(item => ({
    ...item,
    total: stats.total_obligations
  })) || [];

  // Radial chart data for compliance score
  const complianceRadialData = stats ? [
    { name: 'Score', value: stats.compliance_score, fill: '#10b981' }
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-ft-salmon flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cove-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderColor: 'hsl(193, 55%, 45%)', borderTopColor: 'transparent'}} />
          <p className="text-cove-navy">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ft-salmon">
      {/* Top Navigation */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E8D5C4] sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button 
                className="lg:hidden p-2 rounded-lg hover:bg-[#FFF1E5] transition-colors"
                onClick={() => setMobileMenuOpen(true)}
                data-testid="mobile-menu-btn"
              >
                <Menu className="w-5 h-5 text-cove-navy" />
              </button>
              <img 
                src={COVE_LOGO}
                alt="Cove" 
                className="h-32 cursor-pointer"
                onClick={() => navigate('/')}
                data-testid="dashboard-logo"
              />
            </div>
            
            <nav className="hidden lg:flex items-center gap-1">
              <Button variant="ghost" className="gap-2 text-cove-teal bg-[#E8F4F4]" data-testid="nav-dashboard">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              <Button 
                variant="ghost" 
                className="gap-2 text-cove-navy hover:bg-[#FFF1E5]"
                onClick={() => navigate(`/compliance/${companyId || ''}`)}
                data-testid="nav-compliance"
              >
                <FileText className="w-4 h-4" />
                Compliance Matrix
              </Button>
              <Button 
                variant="ghost" 
                className="gap-2 text-cove-navy hover:bg-[#FFF1E5]"
                onClick={() => navigate(`/vdr/${companyId || ''}`)}
                data-testid="nav-vdr"
              >
                <FolderOpen className="w-4 h-4" />
                My Cove
              </Button>
              <Button variant="ghost" className="gap-2 text-cove-navy hover:bg-[#FFF1E5]" data-testid="nav-calendar">
                <Calendar className="w-4 h-4" />
                Calendar
              </Button>
            </nav>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative hover:bg-[#FFF1E5]" data-testid="notifications-btn">
                <Bell className="w-5 h-5 text-cove-navy" />
                {(stats?.critical_items || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                    {stats?.critical_items}
                  </span>
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="hover:bg-[#FFF1E5]"
                onClick={() => navigate(`/settings/${companyId || ''}`)}
                data-testid="settings-btn"
              >
                <Settings className="w-5 h-5 text-cove-navy" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 bg-ft-salmon">
          <SheetHeader>
            <SheetTitle>
              <img 
                src={COVE_LOGO}
                alt="Cove" 
                className="h-40"
              />
            </SheetTitle>
          </SheetHeader>
          <nav className="mt-8 space-y-2">
            <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-white/50" onClick={() => setMobileMenuOpen(false)}>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 hover:bg-white/50"
              onClick={() => { setMobileMenuOpen(false); navigate(`/compliance/${companyId || ''}`); }}
            >
              <FileText className="w-4 h-4" />
              Compliance Matrix
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 hover:bg-white/50"
              onClick={() => { setMobileMenuOpen(false); navigate(`/vdr/${companyId || ''}`); }}
            >
              <FolderOpen className="w-4 h-4" />
              My Cove
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-white/50" onClick={() => setMobileMenuOpen(false)}>
              <Calendar className="w-4 h-4" />
              Calendar
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-white/50" onClick={() => { setMobileMenuOpen(false); navigate(`/settings/${companyId || ''}`); }}>
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-white/50" onClick={() => { setMobileMenuOpen(false); navigate('/admin'); }}>
              <Users className="w-4 h-4" />
              Admin Console
            </Button>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-cove-navy tracking-tight" data-testid="welcome-title">
                {stats?.company?.name || 'Dashboard'}
              </h1>
              <p className="text-[#6B5B4F] mt-1 flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/60 text-cove-navy capitalize">
                  {stats?.company?.sector}
                </span>
                <span className="text-[#D4C4B5]">|</span>
                <span className="text-sm">{stats?.company?.sub_sector}</span>
              </p>
            </div>
            <Button 
              onClick={() => navigate(`/compliance/${companyId || ''}`)}
              className="bg-cove-navy hover:bg-[#1a3a4a] text-white gap-2 shadow-lg"
              style={{backgroundColor: 'hsl(210, 60%, 25%)'}}
              data-testid="view-matrix-btn"
            >
              View Full Matrix
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Hero Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Compliance Score Card - Large */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4"
          >
            <Card className="h-full text-white border-0 shadow-xl overflow-hidden relative" style={{background: 'linear-gradient(135deg, hsl(193, 55%, 40%) 0%, hsl(210, 60%, 30%) 100%)'}} data-testid="compliance-score-card">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-white/80 text-sm font-medium mb-1">Compliance Score</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold">{stats?.compliance_score || 0}%</span>
                      <span className={`flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${
                        getScoreChange() >= 0 ? 'bg-emerald-500/30 text-emerald-100' : 'bg-red-500/30 text-red-100'
                      }`}>
                        {getScoreChange() >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(getScoreChange())}%
                      </span>
                    </div>
                  </div>
                  <div className="w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart 
                        cx="50%" 
                        cy="50%" 
                        innerRadius="70%" 
                        outerRadius="100%" 
                        data={complianceRadialData}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <RadialBar
                          background={{ fill: 'rgba(255,255,255,0.2)' }}
                          dataKey="value"
                          cornerRadius={10}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-emerald-500/30">
                  <div>
                    <p className="text-emerald-200 text-xs">Completed</p>
                    <p className="text-xl font-semibold">{stats?.completed_obligations || 0}/{stats?.total_obligations || 0}</p>
                  </div>
                  <div>
                    <p className="text-emerald-200 text-xs">This Month</p>
                    <p className="text-xl font-semibold">+{getScoreChange()}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="h-full border-slate-200/60 hover:shadow-md transition-all hover:border-slate-300" data-testid="total-obligations-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Target className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">TOTAL</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{stats?.total_obligations || 0}</p>
                  <p className="text-sm text-slate-500 mt-1">Obligations</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full border-red-100 bg-red-50/50 hover:shadow-md transition-all" data-testid="critical-items-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="text-xs text-red-400 font-medium">URGENT</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{stats?.critical_items || 0}</p>
                  <p className="text-sm text-red-600/70 mt-1">Critical</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="h-full border-amber-100 bg-amber-50/50 hover:shadow-md transition-all" data-testid="high-priority-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-xs text-amber-400 font-medium">PRIORITY</span>
                  </div>
                  <p className="text-3xl font-bold text-amber-600">{stats?.high_priority_items || 0}</p>
                  <p className="text-sm text-amber-600/70 mt-1">High Priority</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="h-full border-emerald-100 bg-emerald-50/50 hover:shadow-md transition-all" data-testid="completed-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-emerald-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-xs text-emerald-400 font-medium">DONE</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600">{stats?.completed_obligations || 0}</p>
                  <p className="text-sm text-emerald-600/70 mt-1">Completed</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Compliance Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-8"
          >
            <Card className="border-slate-200/60" data-testid="trend-chart-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Compliance Trend</CardTitle>
                    <CardDescription>6-month performance overview</CardDescription>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Score
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      Completed
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.trend_data || []}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        domain={[0, 100]}
                      />
                      <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        fill="url(#scoreGradient)"
                        name="Score %"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="completed" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        fill="url(#completedGradient)"
                        name="Completed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Severity Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-4"
          >
            <Card className="h-full border-slate-200/60" data-testid="severity-chart-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">By Severity</CardTitle>
                <CardDescription>Obligation distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityDataWithTotal}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {severityDataWithTotal.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<SeverityTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(stats?.severity_breakdown || []).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-slate-600">{item.name}</span>
                      <span className="text-slate-900 font-medium ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Categories & Deadlines Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Categories Section */}
          <div className="lg:col-span-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Card className="border-slate-200/60" data-testid="categories-card">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold">Legislation Categories</CardTitle>
                      <CardDescription>Click to view detailed obligations</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {Object.entries(stats?.categories || {}).map(([category, data], idx) => {
                      const IconComponent = CATEGORY_ICONS[category] || Briefcase;
                      const colors = CATEGORY_COLORS[category] || { bg: "bg-slate-50", text: "text-slate-700", accent: "#64748b", ring: "ring-slate-200" };
                      const progress = data.total > 0 ? (data.completed / data.total) * 100 : 0;
                      
                      return (
                        <motion.button
                          key={category}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * idx }}
                          onClick={() => navigate(`/compliance/${companyId || ''}?category=${encodeURIComponent(category)}`)}
                          className={`group p-5 rounded-xl border-2 text-left transition-all hover:shadow-lg ${colors.bg} border-transparent hover:border-current ring-1 ${colors.ring} hover:ring-2`}
                          style={{ '--tw-ring-color': colors.accent + '40' }}
                          data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}-btn`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className={`p-2.5 rounded-xl ${colors.bg} ring-1 ${colors.ring}`}>
                              <IconComponent className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <ChevronRight className={`w-5 h-5 ${colors.text} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-1">{category}</h3>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm text-slate-500">
                              {data.completed}/{data.total} completed
                            </span>
                            {data.critical > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-red-50 text-red-700 border-red-200">
                                {data.critical} critical
                              </Badge>
                            )}
                          </div>
                          <div className="relative h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%`, backgroundColor: colors.accent }}
                            />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Category Distribution Bar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-slate-200/60" data-testid="category-bar-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Category Overview</CardTitle>
                  <CardDescription>Obligations by category and status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryPieData} layout="vertical">
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#475569', fontSize: 12 }}
                          width={110}
                        />
                        <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                        <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Completed" />
                        <Bar dataKey="value" stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} name="Remaining" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Upcoming Deadlines */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="lg:col-span-4"
          >
            <Card className="h-fit border-slate-200/60 sticky top-24" data-testid="deadlines-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Upcoming Deadlines</CardTitle>
                    <CardDescription>Next 30 days</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {(stats?.upcoming_deadlines || []).length} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(stats?.upcoming_deadlines || []).slice(0, 5).map((deadline, idx) => {
                  const daysUntil = getDaysUntil(deadline.due_date);
                  return (
                    <motion.div
                      key={deadline.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="group p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer border border-transparent hover:border-slate-200"
                      onClick={() => navigate(`/compliance/${companyId || ''}`)}
                      data-testid={`deadline-${idx}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={`${getSeverityBadge(deadline.severity)} text-[10px] font-medium`}>
                          {deadline.severity}
                        </Badge>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          daysUntil <= 7 ? 'bg-red-100 text-red-700' : 
                          daysUntil <= 30 ? 'bg-amber-100 text-amber-700' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {daysUntil <= 0 ? 'Overdue!' : `${daysUntil}d`}
                        </span>
                      </div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                        {deadline.obligation}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(deadline.due_date)}
                      </p>
                    </motion.div>
                  );
                })}
                
                {(!stats?.upcoming_deadlines || stats.upcoming_deadlines.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No upcoming deadlines</p>
                  </div>
                )}

                <Button 
                  variant="outline" 
                  className="w-full mt-2 hover:bg-slate-900 hover:text-white transition-colors"
                  onClick={() => navigate(`/compliance/${companyId || ''}`)}
                  data-testid="view-all-deadlines-btn"
                >
                  View All Obligations
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
