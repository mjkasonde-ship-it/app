import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  ArrowLeft,
  Search,
  Filter,
  Table2,
  BarChart3,
  Eye,
  CheckCircle,
  AlertTriangle,
  Calendar,
  FileText,
  Sparkles,
  BadgeCheck,
  Clock,
  ExternalLink,
  Users,
  Building2,
  Scale,
  Briefcase,
  ChevronDown,
  SlidersHorizontal,
  X,
  AlertCircle,
  CircleDot,
  CheckSquare,
  Square,
  Minus,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Wand2,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const COVE_LOGO = "https://customer-assets.emergentagent.com/job_ede56879-e7c8-4696-b14b-f3e4205ad2d7/artifacts/vpnavke8_Cove%20clean%20logo.png";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Owner options for filtering
const OWNERS = ["Legal", "HR", "Finance", "Operations", "Compliance", "Admin"];

// Status options
const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "non_compliant", label: "Non-Compliant" },
  { value: "overdue", label: "Overdue" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" }
];

// Column visibility options
const COLUMNS = [
  { id: "legislation", label: "Legislation", default: true },
  { id: "action", label: "Action Required", default: true },
  { id: "consequences", label: "Consequences", default: true },
  { id: "owner", label: "Owner", default: true },
  { id: "dueDate", label: "Due Date", default: true },
  { id: "status", label: "Status", default: true }
];

// Assign owner based on category
const getOwnerFromCategory = (category) => {
  const ownerMap = {
    "Corporate": "Legal",
    "Core Operations": "Operations",
    "Business Operations": "HR",
    "Environment": "Compliance"
  };
  return ownerMap[category] || "Legal";
};

// Generate legal reference URL with deep-linking to specific provision
const getLegalReferenceUrl = (statute, provision) => {
  const baseUrl = "https://zambialii.org/legislation/";
  const slug = statute.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 50);
  
  // Extract section/chapter number for deep-linking
  let anchor = "";
  if (provision) {
    const sectionMatch = provision.match(/(?:Section|Chapter|No\.?|Regulation)\s*(\d+)/i);
    if (sectionMatch) {
      anchor = `#section-${sectionMatch[1]}`;
    }
  }
  
  return `${baseUrl}${slug}${anchor}`;
};

// Extract provision from statute name
const extractProvision = (statute) => {
  const match = statute.match(/(?:No\.|Chapter|Act|Section)\s*(\d+(?:\s*of\s*\d+)?)/i);
  return match ? match[0] : "See Full Text";
};

export default function ComplianceMatrix() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [obligations, setObligations] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || "all");
  const [selectedObligation, setSelectedObligation] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.default }), {})
  );
  
  // Batch selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Rewrite all state
  const [rewriteStatus, setRewriteStatus] = useState({ total: 0, rewritten: 0, pending: 0, percentage: 0 });
  const [isRewriting, setIsRewriting] = useState(false);

  useEffect(() => {
    fetchObligations();
    fetchRewriteStatus();
  }, [companyId, categoryFilter]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, ownerFilter, searchQuery]);

  const fetchObligations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
      
      const response = await axios.get(`${API}/obligations?${params.toString()}`);
      // Enhance obligations with new fields
      const enhanced = response.data.map(obl => {
        const provision = obl.provision || extractProvision(obl.statute);
        return {
          ...obl,
          owner: obl.owner || getOwnerFromCategory(obl.category),
          provision: provision,
          legal_reference_url: obl.legal_reference_url || getLegalReferenceUrl(obl.statute, provision),
          consequences: obl.consequences || obl.penalty || "Non-compliance penalties apply"
        };
      });
      setObligations(enhanced);
    } catch (error) {
      console.error("Error fetching obligations:", error);
      setObligations(getMockObligations());
    } finally {
      setLoading(false);
    }
  };

  const getMockObligations = () => [
    { id: "1", statute: "Mines and Minerals Development Act No. 11 of 2015", provision: "Section 45", legal_reference_url: "https://zambialii.org/legislation/mines-minerals-development-act#section-45", obligation: "Annual Mining License Renewal", action_required: "Submit renewal application with updated environmental reports", consequences: "License revocation and ZMW 1,000,000 fine", due_date: "2026-03-31", severity: "high", category: "Core Operations", penalty: "ZMW 500,000 fine or license revocation", frequency: "Annual", responsible_authority: "Ministry of Mines", owner: "Operations", status: "pending" },
    { id: "2", statute: "Environmental Management Act No. 12 of 2011", provision: "Section 29", legal_reference_url: "https://zambialii.org/legislation/environmental-management-act#section-29", obligation: "Environmental Impact Assessment Report", action_required: "Commission and submit comprehensive EIA to ZEMA", consequences: "Operations suspension and rehabilitation order", due_date: "2026-06-30", severity: "critical", category: "Environment", penalty: "Operations suspension", frequency: "Every 3 years", responsible_authority: "ZEMA", owner: "Compliance", status: "non_compliant" },
    { id: "3", statute: "Employment Act Chapter 268", provision: "Section 127", legal_reference_url: "https://zambialii.org/legislation/employment-act-chapter-268#section-127", obligation: "Submit Annual Employment Returns", action_required: "File employment statistics with Labour Office", consequences: "ZMW 10,000 fine and possible audit", due_date: "2026-02-28", severity: "medium", category: "Business Operations", penalty: "ZMW 10,000 fine", frequency: "Annual", responsible_authority: "Ministry of Labour", owner: "HR", status: "pending" },
    { id: "4", statute: "Income Tax Act Chapter 323", provision: "Section 52", legal_reference_url: "https://zambialii.org/legislation/income-tax", obligation: "Corporate Tax Filing", action_required: "Submit annual corporate tax return with audited financials", consequences: "25% penalty plus interest on unpaid tax", due_date: "2026-06-21", severity: "critical", category: "Corporate", penalty: "Penalties and interest on unpaid tax", frequency: "Annual", responsible_authority: "ZRA", owner: "Finance", status: "pending" },
    { id: "5", statute: "Companies Act No. 10 of 2017", provision: "Section 256", legal_reference_url: "https://zambialii.org/legislation/companies-act", obligation: "Annual Return Filing", action_required: "File annual return with PACRA including director updates", consequences: "Company strike-off from register", due_date: "2026-04-30", severity: "high", category: "Corporate", penalty: "Company strike-off from register", frequency: "Annual", responsible_authority: "PACRA", owner: "Legal", status: "in_progress" },
    { id: "6", statute: "Workers Compensation Act Chapter 271", provision: "Section 15", legal_reference_url: "https://zambialii.org/legislation/workers-compensation", obligation: "Workers Compensation Insurance Renewal", action_required: "Renew workers compensation coverage", consequences: "ZMW 200,000 fine and criminal liability", due_date: "2026-01-31", severity: "high", category: "Business Operations", penalty: "ZMW 200,000 fine", frequency: "Annual", responsible_authority: "WCFCB", owner: "HR", status: "overdue" },
    { id: "7", statute: "Mining Regulations 2019", provision: "Regulation 23", legal_reference_url: "https://zambialii.org/legislation/mining-regulations", obligation: "Quarterly Production Reports", action_required: "Submit mineral production statistics", consequences: "ZMW 50,000 fine per quarter missed", due_date: "2026-04-15", severity: "medium", category: "Core Operations", penalty: "ZMW 50,000 fine", frequency: "Quarterly", responsible_authority: "Ministry of Mines", owner: "Operations", status: "completed" },
  ];

  // Fetch rewrite status
  const fetchRewriteStatus = async () => {
    try {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      const response = await axios.get(`${API}/obligations/rewrite-status?${params.toString()}`);
      setRewriteStatus(response.data);
    } catch (error) {
      console.error("Error fetching rewrite status:", error);
    }
  };

  // Handle Rewrite All
  const handleRewriteAll = async () => {
    if (rewriteStatus.pending === 0) {
      toast.info("All obligations have already been rewritten");
      return;
    }
    
    setIsRewriting(true);
    toast.info(`Starting batch rewrite of ${rewriteStatus.pending} obligations...`);
    
    try {
      // Get obligations without plain_language_summary
      const obligationsToRewrite = obligations.filter(o => !o.plain_language_summary);
      let processed = 0;
      let errors = 0;
      
      for (const obl of obligationsToRewrite.slice(0, 20)) { // Process max 20 at a time
        try {
          const response = await axios.post(`${API}/obligations/${obl.id}/rewrite`);
          if (response.data.plain_language_summary) {
            // Update local state
            setObligations(prev => prev.map(o => 
              o.id === obl.id 
                ? { ...o, plain_language_summary: response.data.plain_language_summary }
                : o
            ));
            processed++;
            // Update status display
            setRewriteStatus(prev => ({
              ...prev,
              rewritten: prev.rewritten + 1,
              pending: prev.pending - 1,
              percentage: Math.round(((prev.rewritten + 1) / prev.total) * 100 * 10) / 10
            }));
          }
        } catch (error) {
          console.error(`Error rewriting obligation ${obl.id}:`, error);
          errors++;
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (errors > 0) {
        toast.warning(`Rewritten ${processed} obligations. ${errors} failed.`);
      } else {
        toast.success(`Successfully rewritten ${processed} obligations`);
      }
      
      // Refresh status
      fetchRewriteStatus();
      
    } catch (error) {
      console.error("Error in batch rewrite:", error);
      toast.error("Failed to start batch rewrite");
    } finally {
      setIsRewriting(false);
    }
  };


  // Sort and filter obligations - Critical/Non-compliant at top by default
  const filteredObligations = useMemo(() => {
    let filtered = obligations.filter(obl => {
      const matchesSearch = searchQuery === "" || 
        obl.statute?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obl.obligation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obl.action_required?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || obl.status === statusFilter;
      const matchesOwner = ownerFilter === "all" || obl.owner === ownerFilter;
      const matchesCategory = categoryFilter === "all" || obl.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesOwner && matchesCategory;
    });

    // Default sort: Critical severity and non-compliant/overdue status at top
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { non_compliant: 0, overdue: 1, pending: 2, in_progress: 3, completed: 4 };
    
    filtered.sort((a, b) => {
      // First by status (non-compliant/overdue first)
      const statusDiff = (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2);
      if (statusDiff !== 0) return statusDiff;
      
      // Then by severity
      const severityDiff = (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
      if (severityDiff !== 0) return severityDiff;
      
      // Then by due date
      return new Date(a.due_date) - new Date(b.due_date);
    });

    return filtered;
  }, [obligations, searchQuery, statusFilter, ownerFilter, categoryFilter]);

  const getStatusConfig = (status) => {
    const configs = {
      non_compliant: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: AlertCircle, label: "Non-Compliant" },
      overdue: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: AlertTriangle, label: "Overdue" },
      pending: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", icon: Clock, label: "Pending" },
      in_progress: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: CircleDot, label: "In Progress" },
      completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle, label: "Completed" }
    };
    return configs[status] || configs.pending;
  };

  const getSeverityConfig = (severity) => {
    const configs = {
      critical: { bg: "bg-red-500", text: "text-white", dot: "bg-red-500" },
      high: { bg: "bg-amber-500", text: "text-white", dot: "bg-amber-500" },
      medium: { bg: "bg-blue-500", text: "text-white", dot: "bg-blue-500" },
      low: { bg: "bg-emerald-500", text: "text-white", dot: "bg-emerald-500" }
    };
    return configs[severity] || configs.medium;
  };

  const getOwnerIcon = (owner) => {
    const icons = {
      Legal: Scale,
      HR: Users,
      Finance: Building2,
      Operations: Briefcase,
      Compliance: FileText,
      Admin: Building2
    };
    return icons[owner] || Briefcase;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getDaysUntil = (dateStr) => {
    const today = new Date();
    const dueDate = new Date(dateStr);
    const diffTime = dueDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const handleStatusChange = async (obligationId, newStatus) => {
    try {
      await axios.patch(`${API}/obligations/${obligationId}/status`, null, {
        params: { status: newStatus }
      });
      setObligations(prev => prev.map(o => 
        o.id === obligationId ? { ...o, status: newStatus } : o
      ));
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  // Batch selection handlers
  const toggleSelectItem = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredObligations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredObligations.map(o => o.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedIds.size === 0) return;
    
    setBulkUpdating(true);
    const idsArray = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    try {
      // Try bulk endpoint first
      const response = await axios.post(`${API}/obligations/bulk-status`, {
        obligation_ids: idsArray,
        status: newStatus
      });
      
      if (response.data.updated_count) {
        successCount = response.data.updated_count;
      }
    } catch (bulkError) {
      // Fallback to individual updates if bulk endpoint doesn't exist
      const updatePromises = idsArray.map(async (id) => {
        try {
          await axios.patch(`${API}/obligations/${id}/status`, null, {
            params: { status: newStatus }
          });
          return { success: true, id };
        } catch (error) {
          return { success: false, id };
        }
      });

      const results = await Promise.all(updatePromises);
      successCount = results.filter(r => r.success).length;
      failCount = results.filter(r => !r.success).length;
    }

    // Update local state
    setObligations(prev => prev.map(o => 
      selectedIds.has(o.id) ? { ...o, status: newStatus } : o
    ));
    
    // Clear selection and show toast
    setSelectedIds(new Set());
    setBulkUpdating(false);
    
    const statusLabel = newStatus.replace('_', ' ');
    if (failCount > 0) {
      toast.warning(`Updated ${successCount} items to ${statusLabel}. ${failCount} failed.`);
    } else {
      toast.success(`Updated ${successCount} items to ${statusLabel}`);
    }
  };

  // Mark Overdue function
  const handleMarkOverdue = async () => {
    try {
      const response = await axios.post(`${API}/obligations/mark-overdue`, null, {
        params: companyId ? { company_id: companyId } : {}
      });
      
      if (response.data.updated_count > 0) {
        toast.success(`Marked ${response.data.updated_count} obligations as overdue`);
        fetchObligations(); // Refresh the list
      } else {
        toast.info("No overdue obligations found");
      }
    } catch (error) {
      console.error("Error marking overdue:", error);
      toast.error("Failed to mark overdue obligations");
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredObligations.map(obl => ({
      "Legislation": obl.statute,
      "Provision": obl.provision,
      "Obligation": obl.obligation,
      "Action Required": obl.action_required,
      "Consequences": obl.consequences,
      "Owner": obl.owner,
      "Due Date": obl.due_date,
      "Status": obl.status?.replace('_', ' ').toUpperCase(),
      "Severity": obl.severity?.toUpperCase(),
      "Category": obl.category
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compliance Matrix");
    
    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.min(maxWidth, Math.max(key.length, ...exportData.map(row => String(row[key] || '').length)))
    }));
    worksheet['!cols'] = colWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `compliance-matrix-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel file downloaded");
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129); // Emerald color
    doc.text("Compliance Matrix Report", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    })}`, 14, 28);
    doc.text(`Total Obligations: ${filteredObligations.length}`, 14, 34);

    // Summary stats
    const stats = {
      completed: filteredObligations.filter(o => o.status === 'completed').length,
      pending: filteredObligations.filter(o => o.status === 'pending').length,
      overdue: filteredObligations.filter(o => o.status === 'overdue').length,
      critical: filteredObligations.filter(o => o.severity === 'critical').length
    };
    doc.text(`Completed: ${stats.completed} | Pending: ${stats.pending} | Overdue: ${stats.overdue} | Critical: ${stats.critical}`, 14, 40);

    // Table data
    const tableData = filteredObligations.map(obl => [
      obl.statute?.substring(0, 30) + (obl.statute?.length > 30 ? '...' : ''),
      obl.obligation?.substring(0, 40) + (obl.obligation?.length > 40 ? '...' : ''),
      obl.owner,
      obl.due_date,
      obl.status?.replace('_', ' '),
      obl.severity
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Legislation', 'Obligation', 'Owner', 'Due Date', 'Status', 'Severity']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [16, 185, 129], 
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 70 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 }
      },
      didDrawCell: (data) => {
        // Color-code status cells
        if (data.column.index === 4 && data.cell.section === 'body') {
          const status = data.cell.raw?.toLowerCase();
          if (status === 'overdue' || status === 'non compliant') {
            doc.setFillColor(254, 226, 226);
          } else if (status === 'completed') {
            doc.setFillColor(209, 250, 229);
          }
        }
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount} | Cove - Zambia Legal Tech`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`compliance-matrix-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF file downloaded");
  };

  const isAllSelected = filteredObligations.length > 0 && selectedIds.size === filteredObligations.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredObligations.length;

  const toggleColumn = (columnId) => {
    setVisibleColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const activeFiltersCount = [
    statusFilter !== "all",
    ownerFilter !== "all",
    categoryFilter !== "all"
  ].filter(Boolean).length;

  // Gantt Chart Data
  const ganttData = useMemo(() => {
    const currentYear = 2026;
    return filteredObligations.map(obl => {
      const dueDate = new Date(obl.due_date);
      const monthIndex = dueDate.getMonth();
      const dayOfMonth = dueDate.getDate();
      const daysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
      const position = ((monthIndex * 100) / 12) + ((dayOfMonth / daysInMonth) * (100 / 12));
      return { ...obl, monthIndex, position: Math.min(position, 100) };
    });
  }, [filteredObligations]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimalist Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(companyId ? `/dashboard/${companyId}` : '/dashboard')}
                className="gap-1.5 text-slate-600"
                data-testid="back-btn"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-4 w-px bg-slate-200" />
              <h1 className="font-semibold text-slate-900">Compliance Matrix</h1>
              <Badge variant="secondary" className="text-xs">
                {filteredObligations.length}
              </Badge>
            </div>
            
            <img 
              src={COVE_LOGO}
              alt="Cove" 
              className="h-24 cursor-pointer"
              onClick={() => navigate('/')}
            />
          </div>
        </div>
      </header>

      {/* Compact Controls Bar */}
      <div className="bg-white border-b border-slate-100 py-3">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Search and Filters */}
            <div className="flex flex-1 gap-2 flex-wrap items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  data-testid="search-input"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 text-sm" data-testid="status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[130px] h-9 text-sm" data-testid="owner-filter">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {OWNERS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-9 text-xs text-slate-500"
                  onClick={() => {
                    setStatusFilter("all");
                    setOwnerFilter("all");
                    setCategoryFilter("all");
                  }}
                >
                  Clear ({activeFiltersCount})
                </Button>
              )}
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-2">
              {/* Column Visibility */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMNS.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleColumns[col.id]}
                      onCheckedChange={() => toggleColumn(col.id)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="export-btn">
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer" data-testid="export-excel-btn">
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                    Export to Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer" data-testid="export-pdf-btn">
                    <FileText className="w-4 h-4 mr-2 text-red-600" />
                    Export to PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mark Overdue Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                onClick={handleMarkOverdue}
                data-testid="mark-overdue-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark Overdue</span>
              </Button>

              {/* Rewrite All Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                onClick={handleRewriteAll}
                disabled={isRewriting || rewriteStatus.pending === 0}
                data-testid="rewrite-all-btn"
              >
                {isRewriting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isRewriting ? "Rewriting..." : `Rewrite All`}
                </span>
                {rewriteStatus.pending > 0 && !isRewriting && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700">
                    {rewriteStatus.pending}
                  </Badge>
                )}
              </Button>

              {/* View Toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 rounded-none gap-1.5"
                  onClick={() => setViewMode("table")}
                  data-testid="table-view-btn"
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </Button>
                <Button
                  variant={viewMode === "gantt" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 rounded-none gap-1.5"
                  onClick={() => setViewMode("gantt")}
                  data-testid="gantt-view-btn"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Timeline</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <AnimatePresence mode="wait">
          {viewMode === "table" ? (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Bulk Action Bar */}
              <AnimatePresence>
                {selectedIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-4 rounded-t-lg"
                    data-testid="bulk-action-bar"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium">{selectedIds.size} selected</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-slate-300 hover:text-white hover:bg-slate-800 h-7"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 hidden sm:inline">Set status:</span>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        onClick={() => handleBulkStatusUpdate('completed')}
                        disabled={bulkUpdating}
                        data-testid="bulk-complete-btn"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Complete
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        onClick={() => handleBulkStatusUpdate('in_progress')}
                        disabled={bulkUpdating}
                        data-testid="bulk-progress-btn"
                      >
                        <CircleDot className="w-3.5 h-3.5" />
                        In Progress
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="h-8 bg-amber-600 hover:bg-amber-700 text-white gap-1.5 hidden sm:flex"
                        onClick={() => handleBulkStatusUpdate('pending')}
                        disabled={bulkUpdating}
                        data-testid="bulk-pending-btn"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-slate-300 hover:text-white hover:bg-slate-800"
                            disabled={bulkUpdating}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>More Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem 
                            onClick={() => handleBulkStatusUpdate('pending')}
                            className="sm:hidden"
                          >
                            Set Pending
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem onClick={() => handleBulkStatusUpdate('non_compliant')}>
                            Set Non-Compliant
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem onClick={() => handleBulkStatusUpdate('overdue')}>
                            Set Overdue
                          </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Card className={`border-slate-200/60 shadow-sm ${selectedIds.size > 0 ? 'rounded-t-none' : ''}`} data-testid="compliance-table">
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-220px)]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                        <TableRow className="hover:bg-slate-50/95">
                          {/* Select All Checkbox */}
                          <TableHead className="w-[50px] pr-0">
                            <Checkbox 
                              checked={isAllSelected}
                              onCheckedChange={toggleSelectAll}
                              className={`${isSomeSelected ? 'data-[state=checked]:bg-slate-600' : ''}`}
                              data-testid="select-all-checkbox"
                            />
                          </TableHead>
                          {visibleColumns.legislation && (
                            <TableHead className="font-medium text-slate-700 text-xs uppercase tracking-wide w-[320px]">
                              Legislation
                            </TableHead>
                          )}
                          {visibleColumns.action && (
                            <TableHead className="font-medium text-slate-700 text-xs uppercase tracking-wide">
                              Action Required
                            </TableHead>
                          )}
                          {visibleColumns.consequences && (
                            <TableHead className="font-medium text-slate-700 text-xs uppercase tracking-wide hidden lg:table-cell">
                              Consequences
                            </TableHead>
                          )}
                          {visibleColumns.owner && (
                            <TableHead className="font-medium text-slate-700 text-xs uppercase tracking-wide w-[100px]">
                              Owner
                            </TableHead>
                          )}
                          {visibleColumns.dueDate && (
                            <TableHead className="font-medium text-slate-700 text-xs uppercase tracking-wide w-[100px]">
                              Due
                            </TableHead>
                          )}
                          {visibleColumns.status && (
                            <TableHead className="font-medium text-slate-700 text-xs uppercase tracking-wide w-[130px]">
                              Status
                            </TableHead>
                          )}
                          <TableHead className="w-[60px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredObligations.map((obl, idx) => {
                          const statusConfig = getStatusConfig(obl.status);
                          const severityConfig = getSeverityConfig(obl.severity);
                          const OwnerIcon = getOwnerIcon(obl.owner);
                          const daysUntil = getDaysUntil(obl.due_date);
                          const isSelected = selectedIds.has(obl.id);
                          
                          return (
                            <TableRow 
                              key={obl.id} 
                              className={`group hover:bg-slate-50/80 transition-colors ${
                                isSelected ? 'bg-emerald-50/50' :
                                obl.status === 'non_compliant' || obl.status === 'overdue' 
                                  ? 'bg-red-50/30' 
                                  : ''
                              }`}
                              data-testid={`obligation-row-${idx}`}
                            >
                              {/* Row Checkbox */}
                              <TableCell className="pr-0">
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelectItem(obl.id)}
                                  data-testid={`checkbox-${idx}`}
                                />
                              </TableCell>
                              {visibleColumns.legislation && (
                                <TableCell className="py-3">
                                  <div className="flex items-start gap-2">
                                    {/* Severity indicator */}
                                    <div className={`w-1 h-14 rounded-full flex-shrink-0 ${severityConfig.dot}`} />
                                    <div className="min-w-0 flex-1">
                                      {/* Statute name */}
                                      <p className="text-sm font-medium text-slate-900 line-clamp-1" title={obl.statute}>
                                        {obl.statute}
                                      </p>
                                      {/* Section reference as clickable link */}
                                      <a
                                        href={obl.legal_reference_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline mt-0.5 group/link"
                                        data-testid={`section-link-${idx}`}
                                      >
                                        <Scale className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{obl.provision}</span>
                                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                                      </a>
                                      {/* Obligation description */}
                                      <p className="text-xs text-slate-500 mt-1 line-clamp-1" title={obl.obligation}>
                                        {obl.obligation}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.action && (
                                <TableCell className="py-3">
                                  <p className="text-sm text-slate-700 line-clamp-2" title={obl.action_required}>
                                    {obl.action_required}
                                  </p>
                                </TableCell>
                              )}
                              {visibleColumns.consequences && (
                                <TableCell className="py-3 hidden lg:table-cell">
                                  <p className="text-sm text-slate-500 line-clamp-2" title={obl.consequences}>
                                    {obl.consequences}
                                  </p>
                                </TableCell>
                              )}
                              {visibleColumns.owner && (
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-1.5">
                                    <OwnerIcon className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-sm text-slate-600">{obl.owner}</span>
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.dueDate && (
                                <TableCell className="py-3">
                                  <div className="text-sm">
                                    <span className={`font-medium ${
                                      daysUntil < 0 ? 'text-red-600' :
                                      daysUntil <= 7 ? 'text-amber-600' :
                                      'text-slate-700'
                                    }`}>
                                      {formatDate(obl.due_date)}
                                    </span>
                                    {daysUntil <= 14 && daysUntil >= 0 && (
                                      <p className="text-[10px] text-amber-600">{daysUntil}d left</p>
                                    )}
                                    {daysUntil < 0 && (
                                      <p className="text-[10px] text-red-600">{Math.abs(daysUntil)}d overdue</p>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.status && (
                                <TableCell className="py-3">
                                  <Select 
                                    value={obl.status} 
                                    onValueChange={(val) => handleStatusChange(obl.id, val)}
                                  >
                                    <SelectTrigger className={`h-7 text-xs border ${statusConfig.border} ${statusConfig.bg} ${statusConfig.text} w-[110px]`}>
                                      <statusConfig.icon className="w-3 h-3 mr-1" />
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                                      <SelectItem value="overdue">Overdue</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              )}
                              <TableCell className="py-3">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleViewDetails(obl)}
                                  data-testid={`view-details-btn-${idx}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    
                    {filteredObligations.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No obligations match your filters</p>
                        <Button 
                          variant="link" 
                          className="text-sm mt-2"
                          onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("all");
                            setOwnerFilter("all");
                          }}
                        >
                          Clear all filters
                        </Button>
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
              <Card className="border-slate-200/60 shadow-sm" data-testid="gantt-chart">
                <CardHeader className="py-4 px-6">
                  <CardTitle className="text-base font-semibold">Timeline - 2026</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    {/* Month Headers */}
                    <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="w-56 flex-shrink-0 p-3 text-xs font-medium text-slate-500 border-r border-slate-100">
                        Obligation
                      </div>
                      <div className="flex-1 flex">
                        {MONTHS.map((month, idx) => (
                          <div 
                            key={month} 
                            className={`flex-1 p-2 text-center text-xs font-medium text-slate-500 ${idx % 2 === 0 ? 'bg-slate-50/50' : ''}`}
                          >
                            {month}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gantt Rows */}
                    {ganttData.map((obl, idx) => {
                      const severityConfig = getSeverityConfig(obl.severity);
                      const statusConfig = getStatusConfig(obl.status);
                      
                      return (
                        <div 
                          key={obl.id} 
                          className={`flex border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${
                            obl.status === 'non_compliant' || obl.status === 'overdue' ? 'bg-red-50/20' : ''
                          }`}
                          data-testid={`gantt-row-${idx}`}
                        >
                          <div className="w-56 flex-shrink-0 p-3 border-r border-slate-100">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-8 rounded-full ${severityConfig.dot}`} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate" title={obl.obligation}>
                                  {obl.obligation}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                    {obl.owner}
                                  </Badge>
                                  <statusConfig.icon className={`w-3 h-3 ${statusConfig.text}`} />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 relative py-3">
                            {/* Month grid */}
                            <div className="absolute inset-0 flex">
                              {MONTHS.map((_, idx) => (
                                <div key={idx} className={`flex-1 border-r border-slate-50 ${idx % 2 === 0 ? 'bg-slate-50/30' : ''}`} />
                              ))}
                            </div>
                            
                            {/* Deadline marker */}
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 cursor-pointer group"
                              style={{ left: `${obl.position}%` }}
                              onClick={() => handleViewDetails(obl)}
                            >
                              <div className={`w-3 h-3 rounded-full shadow-sm transition-transform group-hover:scale-150 ${severityConfig.dot}`} />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20">
                                {formatDate(obl.due_date)} - {obl.owner}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {ganttData.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No obligations to display</p>
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
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-8 rounded-full ${getSeverityConfig(selectedObligation.severity).dot}`} />
                  <div>
                    <Badge className={`${getStatusConfig(selectedObligation.status).bg} ${getStatusConfig(selectedObligation.status).text} ${getStatusConfig(selectedObligation.status).border} text-xs`}>
                      {getStatusConfig(selectedObligation.status).label}
                    </Badge>
                  </div>
                </div>
                <SheetTitle className="text-lg leading-tight">
                  {selectedObligation.obligation}
                </SheetTitle>
                <SheetDescription asChild>
                  <div>
                    <a 
                      href={selectedObligation.legal_reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700"
                    >
                      {selectedObligation.statute}
                      <span className="text-[10px] ml-1 px-1.5 py-0.5 border rounded bg-white">{selectedObligation.provision}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Key Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Due Date</p>
                    <p className="text-sm font-semibold text-slate-900">{formatDate(selectedObligation.due_date)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Owner</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedObligation.owner}</p>
                  </div>
                </div>

                {/* 5-Section Plain Language Summary */}
                {selectedObligation.plain_language_summary ? (
                  <div className="space-y-4" data-testid="plain-language-summary">
                    {/* Section 1: Statute & Jurisdiction */}
                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Scale className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wide">1. Statute & Jurisdiction</h4>
                      </div>
                      <p className="text-sm text-blue-800">{selectedObligation.plain_language_summary.statute_jurisdiction}</p>
                    </div>

                    {/* Section 2: Core Obligations */}
                    <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">2. Core Obligations</h4>
                      </div>
                      <p className="text-sm text-emerald-800">{selectedObligation.plain_language_summary.core_obligations}</p>
                    </div>

                    {/* Section 3: Practical Implications */}
                    <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-4 h-4 text-purple-600" />
                        <h4 className="text-xs font-semibold text-purple-900 uppercase tracking-wide">3. Practical Implications</h4>
                      </div>
                      <p className="text-sm text-purple-800">{selectedObligation.plain_language_summary.practical_implications}</p>
                    </div>

                    {/* Section 4: Key Deadlines & Triggers */}
                    <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-semibold text-amber-900 uppercase tracking-wide">4. Key Deadlines & Triggers</h4>
                      </div>
                      <p className="text-sm text-amber-800">{selectedObligation.plain_language_summary.deadlines_triggers}</p>
                    </div>

                    {/* Section 5: Non-Compliance Risks */}
                    <div className="bg-red-50/50 p-4 rounded-lg border border-red-100">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wide">5. Non-Compliance Risks</h4>
                      </div>
                      <p className="text-sm text-red-800">{selectedObligation.plain_language_summary.non_compliance_risks}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Fallback: Original Action Required */}
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Action Required</h4>
                      <p className="text-sm text-slate-700">{selectedObligation.action_required}</p>
                    </div>

                    {/* Fallback: Original Consequences */}
                    <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-medium text-amber-900 uppercase tracking-wide">Consequences</h4>
                      </div>
                      <p className="text-sm text-amber-800">{selectedObligation.consequences}</p>
                    </div>

                    {/* Generate Plain Language Button */}
                    <div className="border-t pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wide">Plain Language Summary</h4>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            setLoadingAI(true);
                            try {
                              const response = await axios.post(`${API}/obligations/${selectedObligation.id}/rewrite`);
                              if (response.data.plain_language_summary) {
                                setSelectedObligation({
                                  ...selectedObligation,
                                  plain_language_summary: response.data.plain_language_summary
                                });
                                // Also update in the main list
                                setObligations(prev => prev.map(o => 
                                  o.id === selectedObligation.id 
                                    ? { ...o, plain_language_summary: response.data.plain_language_summary }
                                    : o
                                ));
                                toast.success("Plain language summary generated");
                              }
                            } catch (error) {
                              console.error("Error generating summary:", error);
                              toast.error("Failed to generate summary");
                            } finally {
                              setLoadingAI(false);
                            }
                          }}
                          disabled={loadingAI}
                          className="h-7 text-xs gap-1.5"
                          data-testid="generate-plain-language-btn"
                        >
                          <Sparkles className="w-3 h-3" />
                          {loadingAI ? "Generating..." : "Generate"}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        Generate an AI-powered 5-section breakdown of this obligation in plain English for non-lawyers.
                      </p>
                    </div>
                  </>
                )}

                {/* AI Summary (legacy) - only show if no plain language summary */}
                {!selectedObligation.plain_language_summary && (
                  <div className="border-t pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wide">Quick AI Summary</h4>
                      </div>
                      {!aiSummary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={fetchAISummary}
                          disabled={loadingAI}
                          className="h-7 text-xs"
                          data-testid="generate-ai-summary-btn"
                        >
                          {loadingAI ? "Generating..." : "Quick Summary"}
                        </Button>
                      )}
                    </div>

                    {aiSummary && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-50 p-4 rounded-lg text-sm"
                        data-testid="ai-summary-content"
                      >
                        <p className="text-slate-700 mb-3">{aiSummary.summary}</p>
                        {aiSummary.key_points?.length > 0 && (
                          <ul className="space-y-1.5">
                            {aiSummary.key_points.map((point, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-slate-600">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span className="text-xs">{point}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center gap-3 pt-3 mt-3 border-t border-slate-200">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3" />
                            {aiSummary.approved_by}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Select 
                    value={selectedObligation.status} 
                    onValueChange={(val) => {
                      handleStatusChange(selectedObligation.id, val);
                      setSelectedObligation({ ...selectedObligation, status: val });
                    }}
                  >
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-9" data-testid="set-reminder-btn">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    Remind
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
