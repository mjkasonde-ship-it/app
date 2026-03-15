import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  DollarSign,
  Building2,
  Shield,
  Bell,
  ChevronRight,
  FileCheck,
  Wallet,
  Scale,
  Stamp,
  AlertCircle,
  TrendingUp,
  History,
  Eye,
  Loader2
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert";

const API = process.env.REACT_APP_BACKEND_URL;

export default function RegFilingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [filings, setFilings] = useState({ overdue: [], due_soon: [], upcoming: [] });
  const [paymentOrders, setPaymentOrders] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [prioritization, setPrioritization] = useState(null);
  
  // Dialog states
  const [selectedFiling, setSelectedFiling] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [poDetailOpen, setPODetailOpen] = useState(false);
  
  const [processing, setProcessing] = useState(false);

  const companyId = "test-company-001";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Seed test data first and wait for it
      try {
        await axios.post(`${API}/api/regfiling/seed-test-data/${companyId}`);
      } catch (seedErr) {
        console.log("Seed might already exist:", seedErr);
      }
      
      // Small delay to ensure data is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const [filingsRes, posRes, auditRes, prioRes] = await Promise.all([
        axios.get(`${API}/api/regfiling/filings/${companyId}/upcoming?days=60`),
        axios.get(`${API}/api/regfiling/po/${companyId}`),
        axios.get(`${API}/api/regfiling/audit/${companyId}`),
        axios.post(`${API}/api/regfiling/payments/prioritize/${companyId}`)
      ]);
      
      setFilings(filingsRes.data);
      setPaymentOrders(posRes.data.payment_orders || []);
      setAuditTrail(auditRes.data.audit_records || []);
      setPrioritization(prioRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load filing data");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminders = async () => {
    setProcessing(true);
    try {
      const response = await axios.post(`${API}/api/regfiling/reminders/send`, {
        company_id: companyId,
        days_ahead: 30
      });
      toast.success(`Sent ${response.data.reminders_sent} reminders`);
    } catch (error) {
      toast.error("Failed to send reminders");
    } finally {
      setProcessing(false);
    }
  };

  const handleCalculateFees = async (filingId) => {
    setProcessing(true);
    try {
      const response = await axios.post(`${API}/api/regfiling/fees/calculate`, {
        filing_id: filingId
      });
      toast.success(`Fees calculated: ZMW ${response.data.total_amount.toLocaleString()}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to calculate fees");
    } finally {
      setProcessing(false);
    }
  };

  const handleGeneratePO = async (filingId) => {
    setProcessing(true);
    try {
      // First calculate fees
      await axios.post(`${API}/api/regfiling/fees/calculate`, { filing_id: filingId });
      
      // Then generate PO
      const response = await axios.post(`${API}/api/regfiling/po/generate`, {
        filing_id: filingId,
        include_penalty: true
      });
      toast.success(`Payment Order ${response.data.payment_order.po_number} generated`);
      setSelectedFiling(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate PO");
    } finally {
      setProcessing(false);
    }
  };

  const handleAuthorizePO = async (po) => {
    setProcessing(true);
    try {
      await axios.post(`${API}/api/regfiling/po/authorize`, {
        payment_order_id: po.id,
        authorized_by: "Current User",
        user_id: "user-001",
        user_email: "user@company.zm",
        user_role: "Finance Manager"
      });
      toast.success(`PO ${po.po_number} authorized`);
      setAuthDialogOpen(false);
      setSelectedPO(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to authorize PO");
    } finally {
      setProcessing(false);
    }
  };

  const handlePayPO = async (po) => {
    setProcessing(true);
    try {
      const response = await axios.post(`${API}/api/regfiling/po/pay`, {
        payment_order_id: po.id,
        use_wallet: true
      });
      toast.success(`Payment executed! Transaction: ${response.data.transaction_id}`);
      setPODetailOpen(false);
      setSelectedPO(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to execute payment");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const configs = {
      upcoming: { bg: "bg-slate-100", text: "text-slate-700", icon: Clock },
      due_soon: { bg: "bg-amber-100", text: "text-amber-700", icon: AlertTriangle },
      overdue: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
      po_generated: { bg: "bg-blue-100", text: "text-blue-700", icon: FileText },
      paid: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
      authorized: { bg: "bg-purple-100", text: "text-purple-700", icon: Shield },
      pending_auth: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
      draft: { bg: "bg-slate-100", text: "text-slate-700", icon: FileText },
    };
    const config = configs[status] || configs.upcoming;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bg} ${config.text} gap-1`}>
        <Icon className="w-3 h-3" />
        {status?.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const configs = {
      critical: { bg: "bg-red-500", text: "text-white" },
      high: { bg: "bg-orange-500", text: "text-white" },
      medium: { bg: "bg-amber-500", text: "text-white" },
      low: { bg: "bg-slate-400", text: "text-white" }
    };
    const config = configs[priority] || configs.medium;
    return (
      <Badge className={`${config.bg} ${config.text} text-[10px]`}>
        {priority?.toUpperCase()}
      </Badge>
    );
  };

  const allFilings = [...filings.overdue, ...filings.due_soon, ...filings.upcoming];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF5EE] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF5EE]" data-testid="regfiling-page">
      {/* Header */}
      <header className="bg-white border-b border-[#D4A574]/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="flex items-center gap-2">
                <Stamp className="w-5 h-5 text-[#8B4513]" />
                <h1 className="text-lg font-semibold text-[#2F1810]">Regulatory Filing</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendReminders}
                disabled={processing}
                className="gap-1.5"
              >
                <Bell className="w-4 h-4" />
                Send Reminders
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-red-100">Overdue</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{filings.overdue.length}</p>
              <p className="text-sm text-red-100">Requires immediate action</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-amber-100">Due Soon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{filings.due_soon.length}</p>
              <p className="text-sm text-amber-100">Within 7 days</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-blue-100">Upcoming</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{filings.upcoming.length}</p>
              <p className="text-sm text-blue-100">Next 60 days</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-purple-100">Payment Orders</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{paymentOrders.length}</p>
              <p className="text-sm text-purple-100">Pending authorization</p>
            </CardContent>
          </Card>
        </div>

        {/* Low Funds Alert */}
        {prioritization?.shortfall > 0 && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Insufficient Wallet Funds</AlertTitle>
            <AlertDescription className="text-amber-700">
              {prioritization.recommendation}
              <Button
                variant="link"
                className="text-amber-700 underline p-0 h-auto ml-2"
                onClick={() => navigate('/wallet')}
              >
                Fund Wallet →
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="filings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="filings" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Filings
              {allFilings.length > 0 && (
                <Badge variant="secondary" className="ml-1">{allFilings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5">
              <DollarSign className="w-4 h-4" />
              Payment Orders
              {paymentOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1">{paymentOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <History className="w-4 h-4" />
              Audit Trail
            </TabsTrigger>
          </TabsList>

          {/* Filings Tab */}
          <TabsContent value="filings">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Regulatory Filings</CardTitle>
                <CardDescription>Manage your compliance deadlines and payments</CardDescription>
              </CardHeader>
              <CardContent>
                {allFilings.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No pending filings</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filing</TableHead>
                        <TableHead>Authority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allFilings.map((filing) => (
                        <TableRow key={filing.id} className="group">
                          <TableCell>
                            <div>
                              <p className="font-medium">{filing.title}</p>
                              <p className="text-xs text-slate-500">{filing.filing_type}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              {filing.authority_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              {formatDate(filing.due_date)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(filing.total_amount || filing.base_fee)}
                            {filing.calculated_penalty > 0 && (
                              <span className="text-xs text-red-500 block">
                                +{formatCurrency(filing.calculated_penalty)} penalty
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{getPriorityBadge(filing.priority)}</TableCell>
                          <TableCell>{getStatusBadge(filing.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedFiling(filing)}
                                className="h-7 text-xs"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                              {!filing.payment_order_id && (
                                <Button
                                  size="sm"
                                  onClick={() => handleGeneratePO(filing.id)}
                                  disabled={processing}
                                  className="h-7 text-xs"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Gen PO
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Payment Orders</CardTitle>
                <CardDescription>Authorize and execute regulatory payments</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No payment orders</p>
                    <p className="text-sm">Generate POs from the Filings tab</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Obligation</TableHead>
                        <TableHead>Authority</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentOrders.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-sm">
                            {po.po_number}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{po.obligation_title}</p>
                          </TableCell>
                          <TableCell>{po.authority_name}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(po.total_amount)}
                            {po.penalty_amount > 0 && (
                              <span className="text-xs text-red-500 block">
                                incl. {formatCurrency(po.penalty_amount)} penalty
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{getPriorityBadge(po.priority)}</TableCell>
                          <TableCell>{getStatusBadge(po.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedPO(po); setPODetailOpen(true); }}
                                className="h-7 text-xs"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                              {po.status === "draft" && (
                                <Button
                                  size="sm"
                                  onClick={() => { setSelectedPO(po); setAuthDialogOpen(true); }}
                                  className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                                >
                                  <Shield className="w-3 h-3 mr-1" />
                                  Authorize
                                </Button>
                              )}
                              {po.status === "authorized" && (
                                <Button
                                  size="sm"
                                  onClick={() => handlePayPO(po)}
                                  disabled={processing}
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <Wallet className="w-3 h-3 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Trail Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Authorization Audit Trail</CardTitle>
                <CardDescription>Timestamped record of all authorization actions</CardDescription>
              </CardHeader>
              <CardContent>
                {auditTrail.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No audit records yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditTrail.map((audit) => (
                      <div 
                        key={audit.id}
                        className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Shield className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{audit.user_name}</span>
                            <Badge variant="outline" className="text-xs">{audit.user_role}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5">
                            <span className="font-medium capitalize">{audit.action}</span>
                            {" - "}PO #{audit.details?.po_number || "N/A"}
                            {" - "}{formatCurrency(audit.details?.amount)}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span>{formatDateTime(audit.timestamp)}</span>
                            <span>IP: {audit.ip_address}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Filing Detail Dialog */}
        <Dialog open={!!selectedFiling && !authDialogOpen} onOpenChange={() => setSelectedFiling(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedFiling?.title}</DialogTitle>
              <DialogDescription>{selectedFiling?.authority_name}</DialogDescription>
            </DialogHeader>
            {selectedFiling && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Due Date</p>
                    <p className="font-medium">{formatDate(selectedFiling.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Status</p>
                    {getStatusBadge(selectedFiling.status)}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Base Fee</p>
                    <p className="font-medium">{formatCurrency(selectedFiling.base_fee)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Penalty</p>
                    <p className="font-medium text-red-600">{formatCurrency(selectedFiling.calculated_penalty)}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Total Amount Due</p>
                  <p className="text-2xl font-bold">{formatCurrency(selectedFiling.total_amount)}</p>
                </div>
                <p className="text-sm text-slate-600">{selectedFiling.description}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedFiling(null)}>Close</Button>
              {selectedFiling && !selectedFiling.payment_order_id && (
                <Button onClick={() => handleGeneratePO(selectedFiling.id)} disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generate Payment Order
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Authorization Dialog */}
        <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Authorize Payment Order</DialogTitle>
              <DialogDescription>
                Review and authorize this payment for execution
              </DialogDescription>
            </DialogHeader>
            {selectedPO && (
              <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <p className="font-mono text-sm text-purple-700">{selectedPO.po_number}</p>
                  <p className="text-lg font-semibold mt-1">{selectedPO.obligation_title}</p>
                  <p className="text-sm text-slate-600">{selectedPO.authority_name}</p>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">Base Fee</span>
                    <span>{formatCurrency(selectedPO.base_fee)}</span>
                  </div>
                  {selectedPO.penalty_amount > 0 && (
                    <div className="flex justify-between items-center mb-2 text-red-600">
                      <span>Late Penalty</span>
                      <span>{formatCurrency(selectedPO.penalty_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t font-semibold">
                    <span>Total Amount</span>
                    <span className="text-lg">{formatCurrency(selectedPO.total_amount)}</span>
                  </div>
                </div>

                {selectedPO.non_compliance_consequences && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Non-Compliance Warning</AlertTitle>
                    <AlertDescription className="text-sm">
                      {selectedPO.non_compliance_consequences}
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-slate-500 text-center">
                  By clicking Authorize, you confirm this payment is valid and should be executed.
                  This action will be recorded with your details and timestamp.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAuthDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => handleAuthorizePO(selectedPO)}
                disabled={processing}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                Authorize Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PO Detail Dialog */}
        <Dialog open={poDetailOpen} onOpenChange={setPODetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Payment Order Details</DialogTitle>
              <DialogDescription>{selectedPO?.po_number}</DialogDescription>
            </DialogHeader>
            {selectedPO && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Status</p>
                    {getStatusBadge(selectedPO.status)}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Priority</p>
                    {getPriorityBadge(selectedPO.priority)}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-slate-500 uppercase">Obligation</p>
                  <p className="font-medium">{selectedPO.obligation_title}</p>
                </div>
                
                <div>
                  <p className="text-xs text-slate-500 uppercase">Authority</p>
                  <p>{selectedPO.authority_name}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-2xl font-bold">{formatCurrency(selectedPO.total_amount)}</p>
                  <p className="text-sm text-slate-500">Total Amount</p>
                </div>

                {selectedPO.authorized_by && (
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                    <p className="text-xs text-purple-600 uppercase">Authorized By</p>
                    <p className="font-medium">{selectedPO.authorized_by}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(selectedPO.authorized_at)}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPODetailOpen(false)}>Close</Button>
              {selectedPO?.status === "authorized" && (
                <Button 
                  onClick={() => handlePayPO(selectedPO)}
                  disabled={processing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                  Execute Payment
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
