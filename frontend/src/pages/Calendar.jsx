import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  FileText,
  Scale,
  Users,
  Briefcase,
  Building2,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { ScrollArea } from "../components/ui/scroll-area";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const COVE_LOGO = "https://customer-assets.emergentagent.com/job_ede56879-e7c8-4696-b14b-f3e4205ad2d7/artifacts/vpnavke8_Cove%20clean%20logo.png";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SEVERITY_COLORS = {
  critical: { bg: "bg-red-500", text: "text-red-700", light: "bg-red-100" },
  high: { bg: "bg-amber-500", text: "text-amber-700", light: "bg-amber-100" },
  medium: { bg: "bg-blue-500", text: "text-blue-700", light: "bg-blue-100" },
  low: { bg: "bg-emerald-500", text: "text-emerald-700", light: "bg-emerald-100" }
};

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-slate-600", bg: "bg-slate-100" },
  in_progress: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100" },
  completed: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
  non_compliant: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100" },
  overdue: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100" }
};

const OWNER_ICONS = {
  Legal: Scale,
  HR: Users,
  Finance: Building2,
  Operations: Briefcase,
  Compliance: FileText,
  Admin: Building2
};

export default function Calendar() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 1)); // Feb 2026
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedObligation, setSelectedObligation] = useState(null);

  useEffect(() => {
    fetchObligations();
  }, [companyId]);

  const fetchObligations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      
      const response = await axios.get(`${API}/obligations?${params.toString()}`);
      setObligations(response.data);
    } catch (error) {
      console.error("Error fetching obligations:", error);
      // Mock data fallback
      setObligations(getMockObligations());
    } finally {
      setLoading(false);
    }
  };

  const getMockObligations = () => [
    { id: "1", statute: "Mines and Minerals Development Act No. 11 of 2015", obligation: "Annual Mining License Renewal", action_required: "Submit renewal application", due_date: "2026-03-31", severity: "high", category: "Core Operations", owner: "Operations", status: "pending" },
    { id: "2", statute: "Environmental Management Act No. 12 of 2011", obligation: "Environmental Impact Assessment Report", action_required: "Commission and submit EIA", due_date: "2026-06-30", severity: "critical", category: "Environment", owner: "Compliance", status: "non_compliant" },
    { id: "3", statute: "Employment Act Chapter 268", obligation: "Submit Annual Employment Returns", action_required: "File employment statistics", due_date: "2026-02-28", severity: "medium", category: "Business Operations", owner: "HR", status: "pending" },
    { id: "4", statute: "Income Tax Act Chapter 323", obligation: "Corporate Tax Filing", action_required: "Submit annual tax return", due_date: "2026-06-21", severity: "critical", category: "Corporate", owner: "Finance", status: "pending" },
    { id: "5", statute: "Companies Act No. 10 of 2017", obligation: "Annual Return Filing", action_required: "File with PACRA", due_date: "2026-04-30", severity: "high", category: "Corporate", owner: "Legal", status: "in_progress" },
    { id: "6", statute: "Workers Compensation Act Chapter 271", obligation: "Workers Compensation Insurance Renewal", action_required: "Renew coverage", due_date: "2026-01-31", severity: "high", category: "Business Operations", owner: "HR", status: "overdue" },
    { id: "7", statute: "Mining Regulations 2019", obligation: "Quarterly Production Reports", action_required: "Submit production statistics", due_date: "2026-04-15", severity: "medium", category: "Core Operations", owner: "Operations", status: "completed" },
    { id: "8", statute: "Value Added Tax Act Chapter 331", obligation: "VAT Returns Filing", action_required: "Submit monthly VAT returns", due_date: "2026-02-21", severity: "high", category: "Corporate", owner: "Finance", status: "pending" },
    { id: "9", statute: "NAPSA Act No. 40 of 1996", obligation: "NAPSA Contributions", action_required: "Remit pension contributions", due_date: "2026-02-14", severity: "high", category: "Business Operations", owner: "HR", status: "pending" },
    { id: "10", statute: "OHS Act No. 36 of 2010", obligation: "OHS Compliance Certificate", action_required: "Obtain annual certification", due_date: "2026-03-31", severity: "high", category: "Business Operations", owner: "Operations", status: "pending" },
  ];

  // Get calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const days = [];
    
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i)
      });
    }
    
    // Current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      });
    }
    
    // Next month padding
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      });
    }
    
    return days;
  }, [currentDate]);

  // Get obligations for a specific date
  const getObligationsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return obligations.filter(obl => obl.due_date === dateStr);
  };

  // Get obligations grouped by date for current month
  const obligationsByDate = useMemo(() => {
    const grouped = {};
    obligations.forEach(obl => {
      const date = obl.due_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(obl);
    });
    return grouped;
  }, [obligations]);

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date(2026, 1, 9)); // Current date in app context
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const isToday = (date) => {
    const today = new Date(2026, 1, 9); // Feb 9, 2026 in app context
    return date.toDateString() === today.toDateString();
  };

  const selectedDateObligations = selectedDate ? getObligationsForDate(selectedDate) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-ft-salmon flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-cove-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cove-navy text-sm">Loading calendar...</p>
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
                <CalendarIcon className="w-5 h-5 text-cove-teal" />
                <h1 className="font-semibold text-cove-navy">Compliance Calendar</h1>
              </div>
            </div>
            
            <img 
              src={COVE_LOGO}
              alt="Cove" 
              className="h-24 cursor-pointer"
              onClick={() => navigate('/')}
              data-testid="calendar-logo"
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <Card className="border-[#E8D5C4] bg-white/90">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateMonth(-1)}
                      className="h-9 w-9"
                      data-testid="prev-month-btn"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-xl font-semibold text-cove-navy min-w-[200px] text-center">
                      {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateMonth(1)}
                      className="h-9 w-9"
                      data-testid="next-month-btn"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToToday}
                    className="text-cove-teal border-cove-teal hover:bg-[#E8F4F4]"
                    data-testid="today-btn"
                  >
                    Today
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Day Headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-sm font-medium text-[#6B5B4F] py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarData.map((dayData, idx) => {
                    const dateStr = dayData.date.toISOString().split('T')[0];
                    const dayObligations = obligationsByDate[dateStr] || [];
                    const hasObligations = dayObligations.length > 0;
                    const hasCritical = dayObligations.some(o => o.severity === 'critical');
                    const hasOverdue = dayObligations.some(o => o.status === 'overdue' || o.status === 'non_compliant');
                    const today = isToday(dayData.date);
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => hasObligations && setSelectedDate(dayData.date)}
                        disabled={!hasObligations}
                        className={`
                          relative min-h-[100px] p-2 rounded-lg border transition-all text-left
                          ${dayData.isCurrentMonth ? 'bg-white' : 'bg-[#FFF8F2]/50'}
                          ${today ? 'ring-2 ring-cove-teal' : ''}
                          ${hasObligations ? 'cursor-pointer hover:shadow-md hover:border-cove-teal' : 'cursor-default'}
                          ${hasOverdue ? 'border-red-200' : hasCritical ? 'border-amber-200' : 'border-[#E8D5C4]'}
                        `}
                        data-testid={`calendar-day-${dayData.day}`}
                      >
                        <span className={`
                          text-sm font-medium
                          ${!dayData.isCurrentMonth ? 'text-[#A89888]' : today ? 'text-cove-teal' : 'text-cove-navy'}
                        `}>
                          {dayData.day}
                        </span>
                        
                        {today && (
                          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cove-teal" />
                        )}
                        
                        {/* Obligation Indicators */}
                        {hasObligations && dayData.isCurrentMonth && (
                          <div className="mt-1 space-y-1">
                            {dayObligations.slice(0, 3).map((obl, oblIdx) => (
                              <div
                                key={oblIdx}
                                className={`
                                  text-[10px] px-1.5 py-0.5 rounded truncate
                                  ${SEVERITY_COLORS[obl.severity]?.light || 'bg-slate-100'}
                                  ${SEVERITY_COLORS[obl.severity]?.text || 'text-slate-700'}
                                `}
                                title={obl.obligation}
                              >
                                {obl.obligation.substring(0, 20)}...
                              </div>
                            ))}
                            {dayObligations.length > 3 && (
                              <div className="text-[10px] text-[#6B5B4F] font-medium">
                                +{dayObligations.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Upcoming Deadlines */}
          <div className="lg:col-span-1">
            <Card className="border-[#E8D5C4] bg-white/90 sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-cove-navy">Upcoming Deadlines</CardTitle>
                <CardDescription className="text-[#6B5B4F]">Next 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-3">
                    {obligations
                      .filter(obl => {
                        const dueDate = new Date(obl.due_date);
                        const today = new Date(2026, 1, 9);
                        const diff = (dueDate - today) / (1000 * 60 * 60 * 24);
                        return diff >= -7 && diff <= 30;
                      })
                      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                      .map((obl, idx) => {
                        const StatusIcon = STATUS_CONFIG[obl.status]?.icon || Clock;
                        const OwnerIcon = OWNER_ICONS[obl.owner] || Briefcase;
                        
                        return (
                          <button
                            key={obl.id}
                            onClick={() => setSelectedObligation(obl)}
                            className="w-full p-3 rounded-lg bg-[#FFF8F2] hover:bg-[#FFF1E5] transition-colors text-left border border-transparent hover:border-[#E8D5C4]"
                            data-testid={`deadline-${idx}`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${SEVERITY_COLORS[obl.severity]?.bg || 'bg-slate-400'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-cove-navy truncate">
                                  {obl.obligation}
                                </p>
                                <p className="text-xs text-[#6B5B4F] mt-0.5">
                                  {new Date(obl.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-3.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                <OwnerIcon className="w-3 h-3 mr-1" />
                                {obl.owner}
                              </Badge>
                              <StatusIcon className={`w-3.5 h-3.5 ${STATUS_CONFIG[obl.status]?.color || 'text-slate-500'}`} />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-[#6B5B4F]">
          <span className="font-medium">Severity:</span>
          {Object.entries(SEVERITY_COLORS).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${value.bg}`} />
              <span className="capitalize">{key}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Date Detail Sheet */}
      <Sheet open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-cove-navy">
              {selectedDate && formatDate(selectedDate)}
            </SheetTitle>
            <SheetDescription>
              {selectedDateObligations.length} obligation(s) due
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-150px)] mt-6 pr-2">
            <div className="space-y-4">
              {selectedDateObligations.map((obl, idx) => {
                const StatusIcon = STATUS_CONFIG[obl.status]?.icon || Clock;
                const OwnerIcon = OWNER_ICONS[obl.owner] || Briefcase;
                
                return (
                  <div
                    key={obl.id}
                    className="p-4 rounded-lg border border-[#E8D5C4] bg-[#FFF8F2]"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-1.5 h-full min-h-[60px] rounded-full ${SEVERITY_COLORS[obl.severity]?.bg || 'bg-slate-400'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${STATUS_CONFIG[obl.status]?.bg} ${STATUS_CONFIG[obl.status]?.color} text-xs`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {obl.status?.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {obl.severity}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-cove-navy mb-1">{obl.obligation}</h4>
                        <p className="text-sm text-[#6B5B4F] mb-3">{obl.action_required}</p>
                        <div className="flex items-center gap-4 text-xs text-[#6B5B4F]">
                          <span className="flex items-center gap-1">
                            <OwnerIcon className="w-3.5 h-3.5" />
                            {obl.owner}
                          </span>
                          <span>{obl.category}</span>
                        </div>
                        <p className="text-xs text-[#A89888] mt-2 truncate">{obl.statute}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 text-cove-teal border-cove-teal hover:bg-[#E8F4F4]"
                      onClick={() => navigate(`/compliance/${companyId || ''}`)}
                    >
                      View in Compliance Matrix
                      <ExternalLink className="w-3.5 h-3.5 ml-2" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Obligation Detail Sheet */}
      <Sheet open={!!selectedObligation} onOpenChange={() => setSelectedObligation(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selectedObligation && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-8 rounded-full ${SEVERITY_COLORS[selectedObligation.severity]?.bg || 'bg-slate-400'}`} />
                  <Badge className={`${STATUS_CONFIG[selectedObligation.status]?.bg} ${STATUS_CONFIG[selectedObligation.status]?.color} text-xs`}>
                    {selectedObligation.status?.replace('_', ' ')}
                  </Badge>
                </div>
                <SheetTitle className="text-cove-navy">{selectedObligation.obligation}</SheetTitle>
                <SheetDescription>{selectedObligation.statute}</SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#FFF8F2] p-3 rounded-lg">
                    <p className="text-[10px] text-[#6B5B4F] uppercase tracking-wide mb-1">Due Date</p>
                    <p className="text-sm font-semibold text-cove-navy">
                      {new Date(selectedObligation.due_date).toLocaleDateString('en-GB', { 
                        day: 'numeric', month: 'short', year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div className="bg-[#FFF8F2] p-3 rounded-lg">
                    <p className="text-[10px] text-[#6B5B4F] uppercase tracking-wide mb-1">Owner</p>
                    <p className="text-sm font-semibold text-cove-navy">{selectedObligation.owner}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium text-[#6B5B4F] uppercase tracking-wide mb-2">Action Required</h4>
                  <p className="text-sm text-cove-navy">{selectedObligation.action_required}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium text-[#6B5B4F] uppercase tracking-wide mb-2">Category</h4>
                  <Badge variant="outline">{selectedObligation.category}</Badge>
                </div>

                <Button
                  className="w-full mt-4"
                  style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
                  onClick={() => navigate(`/compliance/${companyId || ''}`)}
                >
                  Open in Compliance Matrix
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
