import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { 
  ArrowLeft,
  Search,
  Filter,
  Table2,
  BarChart3,
  ChevronDown,
  Eye,
  CheckCircle,
  AlertTriangle,
  Calendar,
  FileText,
  X,
  Sparkles,
  BadgeCheck,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ScrollArea } from "../components/ui/scroll-area";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ComplianceMatrix() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [obligations, setObligations] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || "all");
  const [selectedObligation, setSelectedObligation] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    fetchObligations();
  }, [companyId, categoryFilter]);

  const fetchObligations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
      
      const response = await axios.get(`${API}/obligations?${params.toString()}`);
      setObligations(response.data);
    } catch (error) {
      console.error("Error fetching obligations:", error);
      // Use mock data on error
      setObligations(getMockObligations());
    } finally {
      setLoading(false);
    }
  };

  const getMockObligations = () => [
    { id: "1", statute: "Mines and Minerals Development Act No. 11 of 2015", obligation: "Annual Mining License Renewal", action_required: "Submit renewal application with updated environmental reports", due_date: "2026-03-31", severity: "high", category: "Core Operations", penalty: "ZMW 500,000 fine or license revocation", frequency: "Annual", responsible_authority: "Ministry of Mines and Minerals Development", status: "pending" },
    { id: "2", statute: "Environmental Management Act No. 12 of 2011", obligation: "Environmental Impact Assessment Report", action_required: "Commission and submit comprehensive EIA to ZEMA", due_date: "2026-06-30", severity: "critical", category: "Environment", penalty: "Operations suspension", frequency: "Every 3 years", responsible_authority: "Zambia Environmental Management Agency", status: "pending" },
    { id: "3", statute: "Employment Act Chapter 268", obligation: "Submit Annual Employment Returns", action_required: "File employment statistics with Labour Office", due_date: "2026-02-28", severity: "medium", category: "Business Operations", penalty: "ZMW 10,000 fine", frequency: "Annual", responsible_authority: "Ministry of Labour", status: "pending" },
    { id: "4", statute: "Income Tax Act Chapter 323", obligation: "Corporate Tax Filing", action_required: "Submit annual corporate tax return with audited financials", due_date: "2026-06-21", severity: "critical", category: "Corporate", penalty: "Penalties and interest on unpaid tax", frequency: "Annual", responsible_authority: "Zambia Revenue Authority", status: "pending" },
    { id: "5", statute: "Companies Act No. 10 of 2017", obligation: "Annual Return Filing", action_required: "File annual return with PACRA including director updates", due_date: "2026-04-30", severity: "high", category: "Corporate", penalty: "Company strike-off from register", frequency: "Annual", responsible_authority: "Patents and Companies Registration Agency", status: "pending" },
    { id: "6", statute: "Workers Compensation Act Chapter 271", obligation: "Workers Compensation Insurance Renewal", action_required: "Renew workers compensation coverage", due_date: "2026-01-31", severity: "high", category: "Business Operations", penalty: "ZMW 200,000 fine", frequency: "Annual", responsible_authority: "Workers Compensation Fund Control Board", status: "completed" },
    { id: "7", statute: "Mining Regulations 2019", obligation: "Quarterly Production Reports", action_required: "Submit mineral production statistics", due_date: "2026-04-15", severity: "medium", category: "Core Operations", penalty: "ZMW 50,000 fine", frequency: "Quarterly", responsible_authority: "Ministry of Mines", status: "pending" },
  ];

  const filteredObligations = useMemo(() => {
    return obligations.filter(obl => {
      const matchesSearch = searchQuery === "" || 
        obl.statute?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obl.obligation?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity = severityFilter === "all" || obl.severity === severityFilter;
      const matchesCategory = categoryFilter === "all" || obl.category === categoryFilter;
      return matchesSearch && matchesSeverity && matchesCategory;
    });
  }, [obligations, searchQuery, severityFilter, categoryFilter]);

  const getSeverityBadge = (severity) => {
    const styles = {
      critical: "bg-red-100 text-red-800 border-red-200",
      high: "bg-yellow-100 text-yellow-800 border-yellow-200",
      medium: "bg-orange-100 text-orange-800 border-orange-200",
      low: "bg-emerald-100 text-emerald-800 border-emerald-200"
    };
    return styles[severity] || styles.medium;
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: "#dc2626",
      high: "#eab308",
      medium: "#f97316",
      low: "#059669"
    };
    return colors[severity] || colors.medium;
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
      pending: "bg-slate-100 text-slate-800 border-slate-200",
      in_progress: "bg-blue-100 text-blue-800 border-blue-200",
      overdue: "bg-red-100 text-red-800 border-red-200"
    };
    return styles[status] || styles.pending;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleViewDetails = async (obligation) => {
    setSelectedObligation(obligation);
    setAiSummary(null);
  };

  const fetchAISummary = async () => {
    if (!selectedObligation) return;
    
    setLoadingAI(true);
    try {
      const response = await axios.post(`${API}/ai/summary`, {
        statute: selectedObligation.statute,
        obligation: selectedObligation.obligation,
        action_required: selectedObligation.action_required
      });
      setAiSummary(response.data);
    } catch (error) {
      console.error("Error fetching AI summary:", error);
      toast.error("Failed to generate AI summary");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleMarkComplete = async (obligationId) => {
    try {
      await axios.patch(`${API}/obligations/${obligationId}/status`, null, {
        params: { status: 'completed' }
      });
      setObligations(prev => prev.map(o => 
        o.id === obligationId ? { ...o, status: 'completed' } : o
      ));
      toast.success("Obligation marked as complete");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  // Gantt Chart Data
  const ganttData = useMemo(() => {
    const currentYear = 2026;
    return filteredObligations.map(obl => {
      const dueDate = new Date(obl.due_date);
      const monthIndex = dueDate.getMonth();
      const dayOfMonth = dueDate.getDate();
      const daysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
      const position = ((monthIndex * 100) / 12) + ((dayOfMonth / daysInMonth) * (100 / 12));
      
      return {
        ...obl,
        monthIndex,
        position: Math.min(position, 100)
      };
    });
  }, [filteredObligations]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(companyId ? `/dashboard/${companyId}` : '/dashboard')}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-heading text-xl font-bold text-slate-900">Compliance Matrix</h1>
                <p className="text-sm text-slate-500">{filteredObligations.length} obligations</p>
              </div>
            </div>
            
            <img 
              src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
              alt="Cove" 
              className="h-10 cursor-pointer"
              onClick={() => navigate('/')}
            />
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="bg-white border-b border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-1 gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search obligations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
              
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[150px]" data-testid="severity-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]" data-testid="category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                  <SelectItem value="Core Operations">Core Operations</SelectItem>
                  <SelectItem value="Business Operations">Business Operations</SelectItem>
                  <SelectItem value="Environment">Environment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Toggle */}
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
              <TabsList className="grid grid-cols-2 w-[200px]">
                <TabsTrigger value="table" className="gap-2" data-testid="table-view-btn">
                  <Table2 className="w-4 h-4" />
                  Table
                </TabsTrigger>
                <TabsTrigger value="gantt" className="gap-2" data-testid="gantt-view-btn">
                  <BarChart3 className="w-4 h-4" />
                  Gantt
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          {viewMode === "table" ? (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card data-testid="compliance-table">
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-[100px] font-semibold">Severity</TableHead>
                          <TableHead className="font-semibold">Statute</TableHead>
                          <TableHead className="font-semibold">Obligation</TableHead>
                          <TableHead className="font-semibold hidden lg:table-cell">Action Required</TableHead>
                          <TableHead className="w-[120px] font-semibold">Due Date</TableHead>
                          <TableHead className="w-[100px] font-semibold">Status</TableHead>
                          <TableHead className="w-[100px] font-semibold text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredObligations.map((obl, idx) => (
                          <TableRow 
                            key={obl.id} 
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                            data-testid={`obligation-row-${idx}`}
                          >
                            <TableCell>
                              <Badge className={`${getSeverityBadge(obl.severity)} capitalize`}>
                                {obl.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-slate-900 max-w-[200px]">
                              <div className="truncate" title={obl.statute}>
                                {obl.statute}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate" title={obl.obligation}>
                                {obl.obligation}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell max-w-[200px]">
                              <div className="truncate text-slate-600" title={obl.action_required}>
                                {obl.action_required}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(obl.due_date)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getStatusBadge(obl.status)} capitalize`}>
                                {obl.status?.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleViewDetails(obl)}
                                  data-testid={`view-details-btn-${idx}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {obl.status !== 'completed' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleMarkComplete(obl.id)}
                                    data-testid={`complete-btn-${idx}`}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {filteredObligations.length === 0 && (
                      <div className="text-center py-12 text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No obligations found matching your filters</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="gantt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card data-testid="gantt-chart">
                <CardHeader>
                  <CardTitle className="font-heading">Timeline View - 2026</CardTitle>
                  <CardDescription>Compliance deadlines throughout the year</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[calc(100vh-350px)]">
                    {/* Month Headers */}
                    <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="w-64 flex-shrink-0 p-3 font-semibold text-slate-700 border-r border-slate-200">
                        Obligation
                      </div>
                      <div className="flex-1 flex">
                        {MONTHS.map((month, idx) => (
                          <div 
                            key={month} 
                            className={`flex-1 p-3 text-center text-sm font-medium ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
                          >
                            {month}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gantt Rows */}
                    {ganttData.map((obl, idx) => (
                      <div 
                        key={obl.id} 
                        className={`flex border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                        data-testid={`gantt-row-${idx}`}
                      >
                        <div className="w-64 flex-shrink-0 p-3 border-r border-slate-200">
                          <div className="flex items-start gap-2">
                            <Badge className={`${getSeverityBadge(obl.severity)} capitalize flex-shrink-0 mt-0.5`}>
                              {obl.severity?.slice(0, 1).toUpperCase()}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate" title={obl.obligation}>
                                {obl.obligation}
                              </p>
                              <p className="text-xs text-slate-500 truncate" title={obl.statute}>
                                {obl.statute}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 relative py-3 px-2">
                          {/* Month grid lines */}
                          <div className="absolute inset-0 flex">
                            {MONTHS.map((_, idx) => (
                              <div 
                                key={idx} 
                                className={`flex-1 border-r border-slate-100 ${idx % 2 === 0 ? 'bg-slate-50/50' : ''}`} 
                              />
                            ))}
                          </div>
                          
                          {/* Deadline marker */}
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 transform cursor-pointer group"
                            style={{ left: `${obl.position}%` }}
                            onClick={() => handleViewDetails(obl)}
                          >
                            <div 
                              className="w-4 h-4 rounded-full shadow-md transition-transform group-hover:scale-125"
                              style={{ backgroundColor: getSeverityColor(obl.severity) }}
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20">
                              {formatDate(obl.due_date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {ganttData.length === 0 && (
                      <div className="text-center py-12 text-slate-500">
                        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No obligations to display in timeline</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Detail Sheet */}
      <Sheet open={!!selectedObligation} onOpenChange={() => setSelectedObligation(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="obligation-detail-sheet">
          {selectedObligation && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={`${getSeverityBadge(selectedObligation.severity)} capitalize`}>
                    {selectedObligation.severity}
                  </Badge>
                  <Badge className={`${getStatusBadge(selectedObligation.status)} capitalize`}>
                    {selectedObligation.status?.replace('_', ' ')}
                  </Badge>
                </div>
                <SheetTitle className="font-heading text-xl">
                  {selectedObligation.obligation}
                </SheetTitle>
                <SheetDescription>
                  {selectedObligation.statute}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Key Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Due Date</p>
                    <p className="font-semibold text-slate-900">{formatDate(selectedObligation.due_date)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Frequency</p>
                    <p className="font-semibold text-slate-900">{selectedObligation.frequency || 'Once'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg col-span-2">
                    <p className="text-xs text-slate-500 mb-1">Responsible Authority</p>
                    <p className="font-semibold text-slate-900">{selectedObligation.responsible_authority || '-'}</p>
                  </div>
                </div>

                {/* Action Required */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Action Required</h4>
                  <p className="text-slate-600">{selectedObligation.action_required}</p>
                </div>

                {/* Penalty */}
                {selectedObligation.penalty && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <h4 className="font-semibold text-red-900">Non-Compliance Penalty</h4>
                    </div>
                    <p className="text-red-700">{selectedObligation.penalty}</p>
                  </div>
                )}

                {/* AI Summary Section */}
                <div className="border-t border-slate-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-600" />
                      <h4 className="font-semibold text-slate-900">AI Legal Summary</h4>
                    </div>
                    {!aiSummary && (
                      <Button
                        size="sm"
                        onClick={fetchAISummary}
                        disabled={loadingAI}
                        className="bg-amber-600 hover:bg-amber-700"
                        data-testid="generate-ai-summary-btn"
                      >
                        {loadingAI ? (
                          <>
                            <span className="animate-spin mr-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </span>
                            Generating...
                          </>
                        ) : (
                          'Generate Summary'
                        )}
                      </Button>
                    )}
                  </div>

                  {aiSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-50 p-4 rounded-lg border border-amber-200"
                      data-testid="ai-summary-content"
                    >
                      <p className="text-slate-700 mb-4">{aiSummary.summary}</p>
                      
                      {aiSummary.key_points && aiSummary.key_points.length > 0 && (
                        <div className="mb-4">
                          <h5 className="font-medium text-slate-900 mb-2">Key Points:</h5>
                          <ul className="space-y-1">
                            {aiSummary.key_points.map((point, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center gap-4 pt-3 border-t border-amber-200">
                        <div className="flex items-center gap-1.5 text-xs text-amber-700">
                          <BadgeCheck className="w-4 h-4" />
                          {aiSummary.approved_by}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(aiSummary.last_updated).toLocaleDateString()}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  {selectedObligation.status !== 'completed' && (
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        handleMarkComplete(selectedObligation.id);
                        setSelectedObligation(null);
                      }}
                      data-testid="mark-complete-btn"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" data-testid="set-reminder-btn">
                    <Calendar className="w-4 h-4 mr-2" />
                    Set Reminder
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
