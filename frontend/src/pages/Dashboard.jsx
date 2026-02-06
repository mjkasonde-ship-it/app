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
  Bell,
  Building2,
  Scale,
  Briefcase,
  Leaf,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const CATEGORY_ICONS = {
  "Corporate": Building2,
  "Core Operations": Briefcase,
  "Business Operations": Scale,
  "Environment": Leaf
};

const CATEGORY_COLORS = {
  "Corporate": "bg-cobalt-100 text-cobalt-700 border-cobalt-200",
  "Core Operations": "bg-amber-100 text-amber-700 border-amber-200",
  "Business Operations": "bg-purple-100 text-purple-700 border-purple-200",
  "Environment": "bg-emerald-100 text-emerald-700 border-emerald-200"
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchDashboardData();
    } else {
      // Demo mode - fetch first company or use mock data
      fetchDemoData();
    }
  }, [companyId]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats/${companyId}`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast.error("Failed to load dashboard data");
      // Use mock data on error
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
    // Use mock data
    setStats(getMockStats());
    setLoading(false);
  };

  const getMockStats = () => ({
    company: { name: "Demo Mining Corp", sector: "mining", sub_sector: "Base Metals" },
    compliance_score: 75,
    total_obligations: 12,
    completed_obligations: 3,
    critical_items: 2,
    high_priority_items: 4,
    upcoming_deadlines: [
      { id: "1", obligation: "Annual Mining License Renewal", due_date: "2026-03-31", severity: "high", statute: "Mines and Minerals Development Act" },
      { id: "2", obligation: "Environmental Impact Assessment", due_date: "2026-06-30", severity: "critical", statute: "Environmental Management Act" },
      { id: "3", obligation: "Submit Annual Employment Returns", due_date: "2026-02-28", severity: "medium", statute: "Employment Act" },
    ],
    categories: {
      "Corporate": { total: 3, completed: 1 },
      "Core Operations": { total: 4, completed: 1 },
      "Business Operations": { total: 3, completed: 1 },
      "Environment": { total: 2, completed: 0 }
    }
  });

  const getSeverityBadge = (severity) => {
    const styles = {
      critical: "bg-red-100 text-red-800 border-red-200",
      high: "bg-yellow-100 text-yellow-800 border-yellow-200",
      medium: "bg-orange-100 text-orange-800 border-orange-200",
      low: "bg-emerald-100 text-emerald-800 border-emerald-200"
    };
    return styles[severity] || styles.medium;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDaysUntil = (dateStr) => {
    const today = new Date();
    const dueDate = new Date(dateStr);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button 
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                onClick={() => setMobileMenuOpen(true)}
                data-testid="mobile-menu-btn"
              >
                <Menu className="w-5 h-5" />
              </button>
              <img 
                src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
                alt="Cove" 
                className="h-8 cursor-pointer"
                onClick={() => navigate('/')}
                data-testid="dashboard-logo"
              />
            </div>
            
            <nav className="hidden lg:flex items-center gap-1">
              <Button variant="ghost" className="gap-2" data-testid="nav-dashboard">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              <Button 
                variant="ghost" 
                className="gap-2"
                onClick={() => navigate(`/compliance/${companyId || ''}`)}
                data-testid="nav-compliance"
              >
                <FileText className="w-4 h-4" />
                Compliance Matrix
              </Button>
              <Button variant="ghost" className="gap-2" data-testid="nav-calendar">
                <Calendar className="w-4 h-4" />
                Calendar
              </Button>
            </nav>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                  {stats?.critical_items || 0}
                </span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/admin')}
                data-testid="admin-btn"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>
              <img 
                src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
                alt="Cove" 
                className="h-8"
              />
            </SheetTitle>
          </SheetHeader>
          <nav className="mt-8 space-y-2">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setMobileMenuOpen(false)}>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={() => { setMobileMenuOpen(false); navigate(`/compliance/${companyId || ''}`); }}
            >
              <FileText className="w-4 h-4" />
              Compliance Matrix
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setMobileMenuOpen(false)}>
              <Calendar className="w-4 h-4" />
              Calendar
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => { setMobileMenuOpen(false); navigate('/admin'); }}>
              <Settings className="w-4 h-4" />
              Admin Console
            </Button>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 mb-2" data-testid="welcome-title">
            Welcome back, {stats?.company?.name || 'User'}
          </h1>
          <p className="text-slate-600">
            Here&apos;s your compliance overview for {stats?.company?.sector} - {stats?.company?.sub_sector}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-t-4 border-t-emerald-600 hover:shadow-lg transition-shadow" data-testid="compliance-score-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Compliance Score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900">{stats?.compliance_score || 0}%</span>
                </div>
                <Progress value={stats?.compliance_score || 0} className="mt-3 h-2" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-t-4 border-t-slate-600 hover:shadow-lg transition-shadow" data-testid="total-obligations-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Total Obligations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900">{stats?.total_obligations || 0}</span>
                  <span className="text-sm text-slate-500 mb-1">
                    {stats?.completed_obligations || 0} completed
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-t-4 border-t-red-500 hover:shadow-lg transition-shadow" data-testid="critical-items-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Critical Items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-4xl font-bold text-red-600">{stats?.critical_items || 0}</span>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-t-4 border-t-yellow-500 hover:shadow-lg transition-shadow" data-testid="high-priority-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  High Priority
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-4xl font-bold text-yellow-600">{stats?.high_priority_items || 0}</span>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Categories & Deadlines Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Categories */}
          <div className="lg:col-span-2">
            <Card data-testid="categories-card">
              <CardHeader>
                <CardTitle className="font-heading">Legislation Categories</CardTitle>
                <CardDescription>Click a category to view detailed obligations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {Object.entries(stats?.categories || {}).map(([category, data], idx) => {
                    const IconComponent = CATEGORY_ICONS[category] || Briefcase;
                    const progress = data.total > 0 ? (data.completed / data.total) * 100 : 0;
                    
                    return (
                      <motion.button
                        key={category}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 * idx }}
                        onClick={() => navigate(`/compliance/${companyId || ''}?category=${encodeURIComponent(category)}`)}
                        className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                          selectedCategory === category 
                            ? 'border-emerald-600 bg-emerald-50' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}-btn`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-2.5 rounded-lg ${CATEGORY_COLORS[category]?.split(' ')[0] || 'bg-slate-100'}`}>
                            <IconComponent className={`w-5 h-5 ${CATEGORY_COLORS[category]?.split(' ')[1] || 'text-slate-600'}`} />
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-1">{category}</h3>
                        <p className="text-sm text-slate-500 mb-3">
                          {data.completed} of {data.total} completed
                        </p>
                        <Progress value={progress} className="h-1.5" />
                      </motion.button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Business Operations Sub-categories */}
            <Card className="mt-6" data-testid="business-ops-card">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Business Operations Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {["Local Government", "ICT", "Marketing", "Consumer Affairs", "Property", "Finance", "People"].map((sub) => (
                    <Button
                      key={sub}
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => navigate(`/compliance/${companyId || ''}?category=Business%20Operations&sub=${encodeURIComponent(sub)}`)}
                      data-testid={`business-ops-${sub.toLowerCase().replace(/\s+/g, '-')}-btn`}
                    >
                      {sub}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Deadlines */}
          <div>
            <Card className="h-fit" data-testid="deadlines-card">
              <CardHeader>
                <CardTitle className="font-heading">Upcoming Deadlines</CardTitle>
                <CardDescription>Next 30 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(stats?.upcoming_deadlines || []).slice(0, 5).map((deadline, idx) => {
                  const daysUntil = getDaysUntil(deadline.due_date);
                  return (
                    <motion.div
                      key={deadline.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/compliance/${companyId || ''}`)}
                      data-testid={`deadline-${idx}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={`${getSeverityBadge(deadline.severity)} text-xs`}>
                          {deadline.severity}
                        </Badge>
                        <span className={`text-xs font-medium ${daysUntil <= 7 ? 'text-red-600' : daysUntil <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {daysUntil <= 0 ? 'Overdue!' : `${daysUntil} days`}
                        </span>
                      </div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        {deadline.obligation}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Due: {formatDate(deadline.due_date)}
                      </p>
                    </motion.div>
                  );
                })}
                
                {(!stats?.upcoming_deadlines || stats.upcoming_deadlines.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                    <p>No upcoming deadlines!</p>
                  </div>
                )}

                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate(`/compliance/${companyId || ''}`)}
                  data-testid="view-all-deadlines-btn"
                >
                  View All Obligations
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
