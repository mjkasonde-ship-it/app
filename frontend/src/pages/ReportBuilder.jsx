import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft,
  FileBarChart,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Building2,
  Scale,
  Users,
  Briefcase,
  FileText,
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const COVE_LOGO = "https://customer-assets.emergentagent.com/job_ede56879-e7c8-4696-b14b-f3e4205ad2d7/artifacts/vpnavke8_Cove%20clean%20logo.png";

const REPORT_SECTIONS = [
  { id: "summary", name: "Compliance Summary", description: "Overall score, trends, and key metrics", icon: TrendingUp },
  { id: "status", name: "Obligations by Status", description: "Breakdown of pending, completed, and overdue items", icon: BarChart3 },
  { id: "category", name: "Obligations by Category", description: "Corporate, Legal, HR, Operations distribution", icon: PieChart }
];

const STATUS_COLORS = {
  completed: "#10b981",
  in_progress: "#3b82f6",
  pending: "#64748b",
  non_compliant: "#ef4444",
  overdue: "#f97316"
};

const CATEGORY_COLORS = {
  "Corporate": "#3b82f6",
  "Core Operations": "#f59e0b",
  "Business Operations": "#8b5cf6",
  "Environment": "#10b981"
};

export default function ReportBuilder() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const reportRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [obligations, setObligations] = useState([]);
  const [company, setCompany] = useState(null);
  const [selectedSections, setSelectedSections] = useState(["summary", "status", "category"]);
  const [showPreview, setShowPreview] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [oblResponse, companyResponse] = await Promise.all([
        axios.get(`${API}/obligations${companyId ? `?company_id=${companyId}` : ''}`),
        companyId ? axios.get(`${API}/companies/${companyId}`) : Promise.resolve({ data: null })
      ]);
      setObligations(oblResponse.data);
      setCompany(companyResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      // Mock data
      setObligations(getMockObligations());
      setCompany({ name: "Test Mining Corp", sector: "mining", sub_sector: "Base Metals" });
    } finally {
      setLoading(false);
    }
  };

  const getMockObligations = () => [
    { id: "1", statute: "Mines and Minerals Act", obligation: "Mining License Renewal", due_date: "2026-03-31", severity: "high", category: "Core Operations", owner: "Operations", status: "pending" },
    { id: "2", statute: "Environmental Management Act", obligation: "EIA Report", due_date: "2026-06-30", severity: "critical", category: "Environment", owner: "Compliance", status: "non_compliant" },
    { id: "3", statute: "Employment Act", obligation: "Employment Returns", due_date: "2026-02-28", severity: "medium", category: "Business Operations", owner: "HR", status: "pending" },
    { id: "4", statute: "Income Tax Act", obligation: "Corporate Tax Filing", due_date: "2026-06-21", severity: "critical", category: "Corporate", owner: "Finance", status: "pending" },
    { id: "5", statute: "Companies Act", obligation: "Annual Return Filing", due_date: "2026-04-30", severity: "high", category: "Corporate", owner: "Legal", status: "in_progress" },
    { id: "6", statute: "Workers Compensation Act", obligation: "Insurance Renewal", due_date: "2026-01-31", severity: "high", category: "Business Operations", owner: "HR", status: "overdue" },
    { id: "7", statute: "Mining Regulations", obligation: "Production Reports", due_date: "2026-04-15", severity: "medium", category: "Core Operations", owner: "Operations", status: "completed" },
    { id: "8", statute: "VAT Act", obligation: "VAT Returns", due_date: "2026-02-21", severity: "high", category: "Corporate", owner: "Finance", status: "completed" },
  ];

  // Calculate statistics
  const stats = {
    total: obligations.length,
    completed: obligations.filter(o => o.status === 'completed').length,
    pending: obligations.filter(o => o.status === 'pending').length,
    inProgress: obligations.filter(o => o.status === 'in_progress').length,
    overdue: obligations.filter(o => o.status === 'overdue').length,
    nonCompliant: obligations.filter(o => o.status === 'non_compliant').length,
    critical: obligations.filter(o => o.severity === 'critical').length,
    high: obligations.filter(o => o.severity === 'high').length
  };

  const complianceScore = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  // Group by status
  const byStatus = {
    completed: obligations.filter(o => o.status === 'completed'),
    in_progress: obligations.filter(o => o.status === 'in_progress'),
    pending: obligations.filter(o => o.status === 'pending'),
    non_compliant: obligations.filter(o => o.status === 'non_compliant'),
    overdue: obligations.filter(o => o.status === 'overdue')
  };

  // Group by category
  const byCategory = obligations.reduce((acc, obl) => {
    const cat = obl.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(obl);
    return acc;
  }, {});

  const toggleSection = (sectionId) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      let yPos = margin;

      // Colors
      const primaryColor = [68, 140, 150]; // Cove teal
      const textColor = [30, 58, 74]; // Cove navy
      const lightGray = [107, 91, 79]; // Muted brown

      // Header
      doc.setFillColor(255, 241, 229); // FT Salmon
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Compliance Report', margin, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightGray);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      })}`, margin, 35);

      if (company?.name) {
        doc.text(`Organization: ${company.name}`, pageWidth - margin - 60, 35);
      }

      yPos = 55;

      // Compliance Summary Section
      if (selectedSections.includes('summary')) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Compliance Summary', margin, yPos);
        yPos += 10;

        // Score card
        doc.setFillColor(240, 253, 244); // Light green
        doc.roundedRect(margin, yPos, 50, 35, 3, 3, 'F');
        
        doc.setFontSize(28);
        doc.setTextColor(16, 185, 129); // Emerald
        doc.text(`${complianceScore}%`, margin + 10, yPos + 22);
        doc.setFontSize(8);
        doc.setTextColor(...lightGray);
        doc.text('Compliance Score', margin + 5, yPos + 30);

        // Stats boxes
        const statsBoxes = [
          { label: 'Total', value: stats.total, color: [100, 116, 139] },
          { label: 'Completed', value: stats.completed, color: [16, 185, 129] },
          { label: 'Pending', value: stats.pending, color: [100, 116, 139] },
          { label: 'Critical', value: stats.critical, color: [239, 68, 68] }
        ];

        let xPos = margin + 60;
        statsBoxes.forEach((stat, idx) => {
          doc.setFillColor(249, 250, 251);
          doc.roundedRect(xPos, yPos, 30, 35, 3, 3, 'F');
          
          doc.setFontSize(18);
          doc.setTextColor(...stat.color);
          doc.text(String(stat.value), xPos + 10, yPos + 18);
          
          doc.setFontSize(7);
          doc.setTextColor(...lightGray);
          doc.text(stat.label, xPos + 5, yPos + 28);
          
          xPos += 35;
        });

        yPos += 50;
      }

      // Obligations by Status Section
      if (selectedSections.includes('status')) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Obligations by Status', margin, yPos);
        yPos += 8;

        const statusData = [
          ['Status', 'Count', 'Percentage'],
          ['Completed', String(stats.completed), `${Math.round((stats.completed/stats.total)*100)}%`],
          ['In Progress', String(stats.inProgress), `${Math.round((stats.inProgress/stats.total)*100)}%`],
          ['Pending', String(stats.pending), `${Math.round((stats.pending/stats.total)*100)}%`],
          ['Overdue', String(stats.overdue), `${Math.round((stats.overdue/stats.total)*100)}%`],
          ['Non-Compliant', String(stats.nonCompliant), `${Math.round((stats.nonCompliant/stats.total)*100)}%`]
        ];

        autoTable(doc, {
          startY: yPos,
          head: [statusData[0]],
          body: statusData.slice(1),
          theme: 'plain',
          headStyles: {
            fillColor: [255, 241, 229],
            textColor: textColor,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            textColor: lightGray,
            fontSize: 9
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' }
          },
          margin: { left: margin, right: margin },
          tableWidth: 110
        });

        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Obligations by Category Section
      if (selectedSections.includes('category')) {
        // Check if need new page
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Obligations by Category', margin, yPos);
        yPos += 8;

        const categoryData = Object.entries(byCategory).map(([cat, items]) => [
          cat,
          String(items.length),
          String(items.filter(i => i.status === 'completed').length),
          String(items.filter(i => i.severity === 'critical' || i.severity === 'high').length)
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Category', 'Total', 'Completed', 'High Priority']],
          body: categoryData,
          theme: 'plain',
          headStyles: {
            fillColor: [255, 241, 229],
            textColor: textColor,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            textColor: lightGray,
            fontSize: 9
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 30, halign: 'center' }
          },
          margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Detailed list
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Detailed Obligations List', margin, yPos);
        yPos += 8;

        const detailData = obligations.slice(0, 15).map(obl => [
          obl.obligation.substring(0, 35) + (obl.obligation.length > 35 ? '...' : ''),
          obl.category,
          obl.owner,
          obl.due_date,
          obl.status.replace('_', ' ')
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Obligation', 'Category', 'Owner', 'Due Date', 'Status']],
          body: detailData,
          theme: 'striped',
          headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          bodyStyles: {
            textColor: lightGray,
            fontSize: 8
          },
          alternateRowStyles: {
            fillColor: [255, 248, 242]
          },
          margin: { left: margin, right: margin }
        });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...lightGray);
        doc.text(
          `Page ${i} of ${pageCount} | Cove - Zambia Legal Tech`,
          margin,
          pageHeight - 10
        );
        doc.text(
          'Confidential',
          pageWidth - margin - 20,
          pageHeight - 10
        );
      }

      doc.save(`compliance-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Report exported successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ft-salmon flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-cove-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cove-navy text-sm">Loading report data...</p>
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
                <FileBarChart className="w-5 h-5 text-cove-teal" />
                <h1 className="font-semibold text-cove-navy">Report Builder</h1>
              </div>
            </div>
            
            <img 
              src={COVE_LOGO}
              alt="Cove" 
              className="h-24 cursor-pointer"
              onClick={() => navigate('/')}
              data-testid="report-logo"
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-[#E8D5C4] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg text-cove-navy">Report Sections</CardTitle>
                <CardDescription className="text-[#6B5B4F]">
                  Select sections to include in your report
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {REPORT_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isSelected = selectedSections.includes(section.id);
                  
                  return (
                    <div
                      key={section.id}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-cove-teal bg-[#E8F4F4]' 
                          : 'border-[#E8D5C4] hover:border-[#D4C4B5]'
                      }`}
                      onClick={() => toggleSection(section.id)}
                      data-testid={`section-${section.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleSection(section.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-cove-teal' : 'text-[#6B5B4F]'}`} />
                            <Label className="font-medium text-cove-navy cursor-pointer">
                              {section.name}
                            </Label>
                          </div>
                          <p className="text-xs text-[#6B5B4F]">{section.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Separator className="my-4" />

                <Button
                  className="w-full gap-2"
                  style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
                  onClick={generatePDF}
                  disabled={selectedSections.length === 0 || generating}
                  data-testid="export-pdf-btn"
                >
                  <Download className="w-4 h-4" />
                  {generating ? 'Generating...' : 'Export PDF Report'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowPreview(!showPreview)}
                  data-testid="toggle-preview-btn"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-[#E8D5C4] bg-white/90">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-cove-navy">Data Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B5B4F]">Total Obligations</span>
                  <Badge variant="secondary">{stats.total}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B5B4F]">Compliance Score</span>
                  <Badge className="bg-emerald-100 text-emerald-700">{complianceScore}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B5B4F]">Critical Items</span>
                  <Badge className="bg-red-100 text-red-700">{stats.critical}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B5B4F]">Categories</span>
                  <Badge variant="outline">{Object.keys(byCategory).length}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Report Preview */}
          <div className="lg:col-span-2">
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                ref={reportRef}
              >
                <Card className="border-[#E8D5C4] bg-white shadow-lg overflow-hidden">
                  {/* Report Header */}
                  <div className="bg-[#FFF1E5] p-6 border-b border-[#E8D5C4]">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-cove-navy">Compliance Report</h2>
                        <p className="text-sm text-[#6B5B4F] mt-1">
                          Generated: {new Date().toLocaleDateString('en-GB', { 
                            day: 'numeric', month: 'long', year: 'numeric' 
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-cove-navy">{company?.name || 'Organization'}</p>
                        <p className="text-xs text-[#6B5B4F] capitalize">{company?.sector} - {company?.sub_sector}</p>
                      </div>
                    </div>
                  </div>

                  <ScrollArea className="h-[600px]">
                    <div className="p-6 space-y-8">
                      {/* Compliance Summary */}
                      {selectedSections.includes('summary') && (
                        <section data-testid="preview-summary">
                          <h3 className="text-lg font-semibold text-cove-navy mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-cove-teal" />
                            Compliance Summary
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                              <p className="text-3xl font-bold text-emerald-600">{complianceScore}%</p>
                              <p className="text-xs text-emerald-700 mt-1">Compliance Score</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-3xl font-bold text-slate-700">{stats.total}</p>
                              <p className="text-xs text-slate-600 mt-1">Total Obligations</p>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                              <p className="text-3xl font-bold text-emerald-600">{stats.completed}</p>
                              <p className="text-xs text-emerald-700 mt-1">Completed</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                              <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
                              <p className="text-xs text-red-700 mt-1">Critical Items</p>
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Obligations by Status */}
                      {selectedSections.includes('status') && (
                        <section data-testid="preview-status">
                          <h3 className="text-lg font-semibold text-cove-navy mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-cove-teal" />
                            Obligations by Status
                          </h3>
                          <div className="space-y-3">
                            {[
                              { key: 'completed', label: 'Completed', count: stats.completed, color: 'bg-emerald-500', icon: CheckCircle },
                              { key: 'in_progress', label: 'In Progress', count: stats.inProgress, color: 'bg-blue-500', icon: Clock },
                              { key: 'pending', label: 'Pending', count: stats.pending, color: 'bg-slate-400', icon: Clock },
                              { key: 'overdue', label: 'Overdue', count: stats.overdue, color: 'bg-orange-500', icon: AlertTriangle },
                              { key: 'non_compliant', label: 'Non-Compliant', count: stats.nonCompliant, color: 'bg-red-500', icon: AlertCircle }
                            ].map(status => {
                              const percentage = stats.total > 0 ? (status.count / stats.total) * 100 : 0;
                              const Icon = status.icon;
                              return (
                                <div key={status.key} className="flex items-center gap-4">
                                  <div className="w-32 flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${status.color.replace('bg-', 'text-')}`} />
                                    <span className="text-sm text-[#6B5B4F]">{status.label}</span>
                                  </div>
                                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${status.color} rounded-full transition-all duration-500`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <div className="w-16 text-right">
                                    <span className="text-sm font-medium text-cove-navy">{status.count}</span>
                                    <span className="text-xs text-[#6B5B4F] ml-1">({Math.round(percentage)}%)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* Obligations by Category */}
                      {selectedSections.includes('category') && (
                        <section data-testid="preview-category">
                          <h3 className="text-lg font-semibold text-cove-navy mb-4 flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-cove-teal" />
                            Obligations by Category
                          </h3>
                          <div className="grid sm:grid-cols-2 gap-4 mb-6">
                            {Object.entries(byCategory).map(([category, items]) => {
                              const completed = items.filter(i => i.status === 'completed').length;
                              const percentage = Math.round((completed / items.length) * 100);
                              const color = CATEGORY_COLORS[category] || '#64748b';
                              
                              return (
                                <div 
                                  key={category} 
                                  className="p-4 rounded-xl border border-[#E8D5C4] bg-[#FFF8F2]"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-cove-navy">{category}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {items.length} items
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full rounded-full"
                                        style={{ width: `${percentage}%`, backgroundColor: color }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium text-[#6B5B4F]">{percentage}%</span>
                                  </div>
                                  <p className="text-xs text-[#6B5B4F] mt-2">
                                    {completed} of {items.length} completed
                                  </p>
                                </div>
                              );
                            })}
                          </div>

                          {/* Detail Table */}
                          <div className="border border-[#E8D5C4] rounded-xl overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-[#FFF1E5]">
                                <tr>
                                  <th className="text-left text-xs font-semibold text-cove-navy p-3">Obligation</th>
                                  <th className="text-left text-xs font-semibold text-cove-navy p-3 hidden sm:table-cell">Category</th>
                                  <th className="text-left text-xs font-semibold text-cove-navy p-3">Owner</th>
                                  <th className="text-left text-xs font-semibold text-cove-navy p-3 hidden md:table-cell">Due Date</th>
                                  <th className="text-left text-xs font-semibold text-cove-navy p-3">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E8D5C4]">
                                {obligations.slice(0, 8).map((obl, idx) => (
                                  <tr key={obl.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FFF8F2]'}>
                                    <td className="p-3">
                                      <p className="text-sm text-cove-navy truncate max-w-[200px]">{obl.obligation}</p>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell">
                                      <span className="text-xs text-[#6B5B4F]">{obl.category}</span>
                                    </td>
                                    <td className="p-3">
                                      <span className="text-xs text-[#6B5B4F]">{obl.owner}</span>
                                    </td>
                                    <td className="p-3 hidden md:table-cell">
                                      <span className="text-xs text-[#6B5B4F]">{obl.due_date}</span>
                                    </td>
                                    <td className="p-3">
                                      <Badge 
                                        className="text-[10px]"
                                        style={{ 
                                          backgroundColor: `${STATUS_COLORS[obl.status]}20`,
                                          color: STATUS_COLORS[obl.status]
                                        }}
                                      >
                                        {obl.status?.replace('_', ' ')}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {obligations.length > 8 && (
                              <div className="p-3 text-center text-xs text-[#6B5B4F] bg-[#FFF8F2] border-t border-[#E8D5C4]">
                                + {obligations.length - 8} more obligations in full report
                              </div>
                            )}
                          </div>
                        </section>
                      )}

                      {selectedSections.length === 0 && (
                        <div className="text-center py-12 text-[#6B5B4F]">
                          <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>Select sections to include in your report</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Report Footer */}
                  <div className="bg-[#FFF8F2] px-6 py-3 border-t border-[#E8D5C4] flex items-center justify-between">
                    <span className="text-xs text-[#6B5B4F]">Cove - Zambia Legal Tech</span>
                    <span className="text-xs text-[#6B5B4F]">Confidential</span>
                  </div>
                </Card>
              </motion.div>
            )}

            {!showPreview && (
              <div className="flex items-center justify-center h-[600px] text-[#6B5B4F]">
                <div className="text-center">
                  <Eye className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Preview Hidden</p>
                  <p className="text-sm">Click "Show Preview" to see your report</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
