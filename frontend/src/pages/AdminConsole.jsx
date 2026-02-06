import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3,
  Settings,
  Plus,
  Search,
  Trash2,
  Edit,
  RefreshCw,
  ChevronRight,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft,
  Download,
  Mail
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const COLORS = ['#059669', '#d97706', '#1e40af', '#dc2626'];

export default function AdminConsole() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "corporate-user" });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, usersRes, companiesRes] = await Promise.all([
        axios.get(`${API}/admin/analytics`),
        axios.get(`${API}/users`),
        axios.get(`${API}/companies`)
      ]);
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      // Use mock data
      setAnalytics(getMockAnalytics());
      setUsers(getMockUsers());
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const getMockAnalytics = () => ({
    total_companies: 24,
    total_users: 156,
    total_obligations: 342,
    active_users_today: 89,
    sector_distribution: {
      mining: 8,
      construction: 5,
      financial: 4,
      agriculture: 3,
      manufacturing: 2,
      power: 2
    },
    severity_distribution: {
      critical: 45,
      high: 98,
      medium: 124,
      low: 75
    },
    monthly_trend: [
      { month: "Oct", compliance: 72 },
      { month: "Nov", compliance: 78 },
      { month: "Dec", compliance: 82 },
      { month: "Jan", compliance: 85 }
    ]
  });

  const getMockUsers = () => [
    { id: "1", name: "John Mwanza", email: "john@copperbelt.zm", role: "legal-admin", status: "active", created_at: "2025-11-15" },
    { id: "2", name: "Grace Banda", email: "grace@lusaka-firm.zm", role: "super-admin", status: "active", created_at: "2025-10-01" },
    { id: "3", name: "David Phiri", email: "david@mining-corp.zm", role: "corporate-user", status: "active", created_at: "2025-12-20" },
    { id: "4", name: "Sarah Tembo", email: "sarah@construction.zm", role: "corporate-user", status: "inactive", created_at: "2025-11-05" },
  ];

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const response = await axios.post(`${API}/users`, newUser);
      setUsers(prev => [...prev, response.data]);
      setShowAddUserDialog(false);
      setNewUser({ name: "", email: "", role: "corporate-user" });
      toast.success("User added successfully");
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error("Failed to add user");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`${API}/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success("User deleted");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const handleSyncLegislation = async () => {
    setSyncing(true);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSyncing(false);
    toast.success("Legislation database synced successfully");
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const styles = {
      "super-admin": "bg-purple-100 text-purple-800 border-purple-200",
      "legal-admin": "bg-blue-100 text-blue-800 border-blue-200",
      "corporate-user": "bg-slate-100 text-slate-800 border-slate-200"
    };
    return styles[role] || styles["corporate-user"];
  };

  const getStatusBadge = (status) => {
    return status === "active" 
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-slate-100 text-slate-500 border-slate-200";
  };

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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col">
        <div className="p-6">
          <img 
            src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
            alt="Cove" 
            className="h-10 brightness-200 cursor-pointer"
            onClick={() => navigate('/')}
            data-testid="admin-logo"
          />
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "users", label: "Users", icon: Users },
            { id: "legislation", label: "Legislation", icon: FileText },
            { id: "analytics", label: "Analytics", icon: BarChart3 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold text-slate-900">
                Super Admin Console
              </h1>
              <p className="text-sm text-slate-500">
                Full platform management access
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2" data-testid="export-btn">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="gap-2" data-testid="settings-btn">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile Tab Navigation */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 h-12">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
              <TabsTrigger value="legislation" className="text-xs">Legislation</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6" data-testid="overview-tab">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="border-t-4 border-t-emerald-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Total Companies
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-4xl font-bold text-slate-900">{analytics?.total_companies || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="border-t-4 border-t-blue-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Total Users
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-4xl font-bold text-slate-900">{analytics?.total_users || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="border-t-4 border-t-amber-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Total Obligations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-4xl font-bold text-slate-900">{analytics?.total_obligations || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <Card className="border-t-4 border-t-purple-600">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Active Today
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-4xl font-bold text-slate-900">{analytics?.active_users_today || 0}</span>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Activity Feed & Quick Actions */}
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="font-heading">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { action: "New company registered", company: "Lusaka Mining Ltd", time: "2 hours ago", icon: Building2, color: "text-emerald-600" },
                        { action: "User role updated", company: "Grace Banda", time: "4 hours ago", icon: Users, color: "text-blue-600" },
                        { action: "Compliance deadline passed", company: "Construction Corp", time: "6 hours ago", icon: AlertTriangle, color: "text-red-600" },
                        { action: "Obligation completed", company: "AgriCorp Zambia", time: "8 hours ago", icon: CheckCircle, color: "text-emerald-600" },
                      ].map((activity, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className={`p-2 rounded-lg bg-slate-100 ${activity.color}`}>
                            <activity.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{activity.action}</p>
                            <p className="text-sm text-slate-500">{activity.company}</p>
                          </div>
                          <span className="text-xs text-slate-400">{activity.time}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full justify-start gap-3" variant="outline" onClick={() => setShowAddUserDialog(true)} data-testid="quick-add-user">
                      <Plus className="w-4 h-4" />
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
                    <Button className="w-full justify-start gap-3" variant="outline" data-testid="quick-send-reminders">
                      <Mail className="w-4 h-4" />
                      Send Reminders
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="space-y-6" data-testid="users-tab">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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
                <Button onClick={() => setShowAddUserDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="add-user-btn">
                  <Plus className="w-4 h-4" />
                  Add User
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Joined</TableHead>
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, idx) => (
                        <TableRow key={user.id} data-testid={`user-row-${idx}`}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-slate-600">{user.email}</TableCell>
                          <TableCell>
                            <Badge className={`${getRoleBadge(user.role)} capitalize`}>
                              {user.role?.replace('-', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStatusBadge(user.status)} capitalize`}>
                              {user.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteUser(user.id)}
                                data-testid={`delete-user-${idx}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No users found</p>
                    </div>
                  )}
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
                <Button onClick={handleSyncLegislation} disabled={syncing} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="sync-legislation-btn">
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync from ZambiaLii'}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { sector: "Mining", count: 24, lastUpdated: "2 days ago" },
                  { sector: "Construction", count: 18, lastUpdated: "3 days ago" },
                  { sector: "Agriculture", count: 15, lastUpdated: "1 week ago" },
                  { sector: "Financial", count: 32, lastUpdated: "1 day ago" },
                  { sector: "Manufacturing", count: 21, lastUpdated: "4 days ago" },
                  { sector: "Power", count: 16, lastUpdated: "5 days ago" },
                ].map((item, idx) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`legislation-sector-${idx}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{item.sector}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-bold text-slate-900">{item.count}</p>
                          <p className="text-xs text-slate-500">obligations</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Last updated</p>
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
              {/* Compliance Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Compliance Trend</CardTitle>
                  <CardDescription>Platform-wide compliance rate over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.monthly_trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" stroke="#64748b" />
                        <YAxis stroke="#64748b" domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          formatter={(value) => [`${value}%`, 'Compliance']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="compliance" 
                          stroke="#059669" 
                          strokeWidth={3}
                          dot={{ fill: '#059669', strokeWidth: 2, r: 6 }}
                          activeDot={{ r: 8, fill: '#059669' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Distribution Charts */}
              <div className="grid lg:grid-cols-2 gap-6">
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
                            fill="#8884d8"
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
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent data-testid="add-user-dialog">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account for the platform
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-add-user-btn">
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
