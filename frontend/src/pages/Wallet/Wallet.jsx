import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useWalletNotifications } from "../../hooks/useWalletNotifications";
import {
  ArrowLeft,
  Wallet,
  CreditCard,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Send,
  History,
  Settings,
  Crown,
  Shield,
  Zap,
  ExternalLink,
  Copy,
  AlertTriangle,
  ArrowDown,
  Ban,
  Play,
  Eye,
  FileText
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";

const API = process.env.REACT_APP_BACKEND_URL;

const ZAMBIAN_BANKS = [
  { code: "ZNCB", name: "Zanaco" },
  { code: "ABSA", name: "Absa Bank Zambia" },
  { code: "STAN", name: "Stanbic Bank" },
  { code: "SBZA", name: "Standard Chartered" },
  { code: "FNBZ", name: "First National Bank" },
  { code: "ATNZ", name: "Atlas Mara Bank" },
  { code: "INBZ", name: "Indo Zambia Bank" },
  { code: "CITI", name: "Citibank Zambia" },
  { code: "UBAZ", name: "United Bank for Africa" },
  { code: "ACBZ", name: "Access Bank Zambia" },
];

const PULL_PURPOSE_OPTIONS = [
  { value: "regulatory_payment", label: "Regulatory Payment" },
  { value: "subscription", label: "Subscription" },
  { value: "invoice", label: "Invoice Payment" },
  { value: "other", label: "Other" },
];

const WS_EVENT_LABELS = {
  "pull_order.created": "Pull order created",
  "pull_order.approved": "Pull order approved",
  "pull_order.rejected": "Pull order rejected",
  "pull_order.executed": "Pull order executed",
  "pull_order.cancelled": "Pull order cancelled",
};

export default function WalletPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [pullOrders, setPullOrders] = useState([]);
  
  // Dialog states
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [linkBankDialogOpen, setLinkBankDialogOpen] = useState(false);
  const [pullOrderDialogOpen, setPullOrderDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Form states
  const [fundAmount, setFundAmount] = useState("");
  const [fundEmail, setFundEmail] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutBank, setPayoutBank] = useState("");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [payoutName, setPayoutName] = useState("");
  const [payoutNarration, setPayoutNarration] = useState("");
  const [linkBankCode, setLinkBankCode] = useState("");
  const [linkAccountNumber, setLinkAccountNumber] = useState("");
  const [linkAccountName, setLinkAccountName] = useState("");
  
  // Pull order form states
  const [pullAmount, setPullAmount] = useState("");
  const [pullDescription, setPullDescription] = useState("");
  const [pullBankAccountId, setPullBankAccountId] = useState("");
  const [pullPurpose, setPullPurpose] = useState("");
  const [pullPurposeRef, setPullPurposeRef] = useState("");
  
  // Approve/Reject states
  const [selectedPullOrder, setSelectedPullOrder] = useState(null);
  const [approveClientName, setApproveClientName] = useState("");
  const [approveClientEmail, setApproveClientEmail] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectClientName, setRejectClientName] = useState("");
  
  // Pull order detail
  const [pullOrderDetail, setPullOrderDetail] = useState(null);
  
  const [processing, setProcessing] = useState(false);

  const companyId = "test-company-001";

  // Real-time WebSocket notifications
  const handleWsEvent = useCallback((msg) => {
    const label = WS_EVENT_LABELS[msg.type] || msg.type;
    const ref = msg.data?.reference || "";

    if (msg.type === "pull_order.executed") {
      toast.success(`${label}: ${ref}`, {
        description: `Balance updated — ${new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW' }).format(msg.data?.new_balance || 0)}`,
      });
    } else if (msg.type === "pull_order.rejected") {
      toast.error(`${label}: ${ref}`, { description: msg.data?.reason });
    } else {
      toast.info(`${label}: ${ref}`);
    }

    // Refresh wallet data on any event
    fetchWalletData();
  }, []);

  useWalletNotifications(companyId, handleWsEvent);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      let walletData;
      try {
        const walletRes = await axios.get(`${API}/api/wallet/sub-accounts/${companyId}`);
        walletData = walletRes.data;
      } catch (err) {
        if (err.response?.status === 404) {
          const createRes = await axios.post(`${API}/api/wallet/sub-accounts`, {
            company_id: companyId,
            company_name: "Demo Company",
            subscription_tier: "basic",
            currency: "ZMW"
          });
          walletData = createRes.data;
        } else {
          throw err;
        }
      }
      setWallet(walletData);

      const [balanceRes, subRes, txnRes, bankRes, pullRes] = await Promise.all([
        axios.get(`${API}/api/wallet/balance/${companyId}`),
        axios.get(`${API}/api/wallet/subscription/${companyId}`),
        axios.get(`${API}/api/wallet/transactions/${companyId}`),
        axios.get(`${API}/api/wallet/bank-accounts/${companyId}`),
        axios.get(`${API}/api/wallet/pull-orders/${companyId}`)
      ]);

      setBalance(balanceRes.data);
      setSubscription(subRes.data);
      setTransactions(txnRes.data.transactions || []);
      setBankAccounts(bankRes.data || []);
      setPullOrders(pullRes.data.pull_orders || []);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!fundEmail) {
      toast.error("Please enter your email");
      return;
    }

    setProcessing(true);
    try {
      const response = await axios.post(`${API}/api/wallet/fund/${companyId}`, {
        amount: parseFloat(fundAmount),
        currency: "ZMW",
        customer_email: fundEmail,
        description: "Wallet Funding"
      });

      if (response.data.payment_url) {
        toast.success("Payment link generated!");
        window.open(response.data.payment_url, "_blank");
      } else {
        toast.success("Funding initiated. Check your email for payment instructions.");
      }

      setFundDialogOpen(false);
      setFundAmount("");
      setFundEmail("");
      fetchWalletData();
    } catch (error) {
      console.error("Fund error:", error);
      toast.error(error.response?.data?.detail || "Failed to initiate funding");
    } finally {
      setProcessing(false);
    }
  };

  const handlePayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!payoutBank || !payoutAccount || !payoutName) {
      toast.error("Please fill in all bank details");
      return;
    }

    setProcessing(true);
    try {
      await axios.post(`${API}/api/wallet/payout/${companyId}`, {
        amount: parseFloat(payoutAmount),
        currency: "ZMW",
        bank_code: payoutBank,
        account_number: payoutAccount,
        account_name: payoutName,
        narration: payoutNarration || "Payout"
      });

      toast.success("Payout initiated successfully!");
      setPayoutDialogOpen(false);
      setPayoutAmount("");
      setPayoutBank("");
      setPayoutAccount("");
      setPayoutName("");
      setPayoutNarration("");
      fetchWalletData();
    } catch (error) {
      console.error("Payout error:", error);
      toast.error(error.response?.data?.detail || "Failed to initiate payout");
    } finally {
      setProcessing(false);
    }
  };

  const handleLinkBank = async () => {
    if (!linkBankCode || !linkAccountNumber || !linkAccountName) {
      toast.error("Please fill in all bank details");
      return;
    }

    setProcessing(true);
    try {
      await axios.post(`${API}/api/wallet/bank-accounts/${companyId}/link`, {
        bank_code: linkBankCode,
        account_number: linkAccountNumber,
        account_name: linkAccountName,
        set_as_primary: bankAccounts.length === 0
      });

      toast.success("Bank account linked successfully!");
      setLinkBankDialogOpen(false);
      setLinkBankCode("");
      setLinkAccountNumber("");
      setLinkAccountName("");
      fetchWalletData();
    } catch (error) {
      console.error("Link bank error:", error);
      toast.error(error.response?.data?.detail || "Failed to link bank account");
    } finally {
      setProcessing(false);
    }
  };

  // ===== PULL ORDER HANDLERS =====

  const handleCreatePullOrder = async () => {
    if (!pullAmount || parseFloat(pullAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!pullDescription) {
      toast.error("Please enter a description");
      return;
    }
    if (!pullBankAccountId) {
      toast.error("Please select a source bank account");
      return;
    }
    if (!pullPurpose) {
      toast.error("Please select a purpose");
      return;
    }

    setProcessing(true);
    try {
      await axios.post(`${API}/api/wallet/pull-orders/${companyId}/create`, {
        amount: parseFloat(pullAmount),
        description: pullDescription,
        source_bank_account_id: pullBankAccountId,
        purpose: pullPurpose,
        purpose_reference: pullPurposeRef || null
      });

      toast.success("Pull order created. Awaiting client approval.");
      setPullOrderDialogOpen(false);
      setPullAmount("");
      setPullDescription("");
      setPullBankAccountId("");
      setPullPurpose("");
      setPullPurposeRef("");
      fetchWalletData();
    } catch (error) {
      console.error("Create pull order error:", error);
      toast.error(error.response?.data?.detail || "Failed to create pull order");
    } finally {
      setProcessing(false);
    }
  };

  const handleApprovePullOrder = async () => {
    if (!approveClientName || !approveClientEmail) {
      toast.error("Please fill in client name and email");
      return;
    }
    if (!selectedPullOrder) return;

    setProcessing(true);
    try {
      await axios.post(`${API}/api/wallet/pull-orders/approve`, {
        approval_token: selectedPullOrder.approval_token,
        client_name: approveClientName,
        client_email: approveClientEmail
      });

      toast.success("Pull order approved successfully!");
      setApproveDialogOpen(false);
      setSelectedPullOrder(null);
      setApproveClientName("");
      setApproveClientEmail("");
      fetchWalletData();
    } catch (error) {
      console.error("Approve pull order error:", error);
      toast.error(error.response?.data?.detail || "Failed to approve pull order");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectPullOrder = async () => {
    if (!rejectReason) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    if (!selectedPullOrder) return;

    setProcessing(true);
    try {
      await axios.post(`${API}/api/wallet/pull-orders/reject`, {
        approval_token: selectedPullOrder.approval_token,
        reason: rejectReason,
        client_name: rejectClientName || null
      });

      toast.success("Pull order rejected.");
      setRejectDialogOpen(false);
      setSelectedPullOrder(null);
      setRejectReason("");
      setRejectClientName("");
      fetchWalletData();
    } catch (error) {
      console.error("Reject pull order error:", error);
      toast.error(error.response?.data?.detail || "Failed to reject pull order");
    } finally {
      setProcessing(false);
    }
  };

  const handleExecutePullOrder = async (pullOrderId) => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API}/api/wallet/pull-orders/${pullOrderId}/execute`);
      toast.success(`Pull executed! ${formatCurrency(res.data.net_credited)} credited to wallet.`);
      fetchWalletData();
    } catch (error) {
      console.error("Execute pull order error:", error);
      toast.error(error.response?.data?.detail || "Failed to execute pull order");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelPullOrder = async (pullOrderId) => {
    setProcessing(true);
    try {
      await axios.post(`${API}/api/wallet/pull-orders/${pullOrderId}/cancel`);
      toast.success("Pull order cancelled.");
      fetchWalletData();
    } catch (error) {
      console.error("Cancel pull order error:", error);
      toast.error(error.response?.data?.detail || "Failed to cancel pull order");
    } finally {
      setProcessing(false);
    }
  };

  const handleViewPullOrderDetail = async (pullOrderId) => {
    try {
      const res = await axios.get(`${API}/api/wallet/pull-orders/detail/${pullOrderId}`);
      setPullOrderDetail(res.data);
      setDetailDialogOpen(true);
    } catch (error) {
      console.error("Get pull order detail error:", error);
      toast.error("Failed to load pull order details");
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
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const configs = {
      pending: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
      pending_approval: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
      processing: { bg: "bg-blue-100", text: "text-blue-700", icon: RefreshCw },
      completed: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
      approved: { bg: "bg-sky-100", text: "text-sky-700", icon: CheckCircle },
      failed: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
      rejected: { bg: "bg-red-100", text: "text-red-700", icon: Ban },
      cancelled: { bg: "bg-slate-100", text: "text-slate-700", icon: XCircle },
      expired: { bg: "bg-slate-100", text: "text-slate-500", icon: Clock }
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bg} ${config.text} gap-1`} data-testid={`status-badge-${status}`}>
        <Icon className="w-3 h-3" />
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getTypeBadge = (type) => {
    if (type === "fund") {
      return (
        <div className="flex items-center gap-1.5 text-emerald-600">
          <ArrowDownLeft className="w-4 h-4" />
          <span>Received</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-red-600">
        <ArrowUpRight className="w-4 h-4" />
        <span>Sent</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF5EE] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF5EE]" data-testid="wallet-page">
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
                data-testid="back-btn"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#8B4513]" />
                <h1 className="text-lg font-semibold text-[#2F1810]">Smart Wallet</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" data-testid="live-indicator">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs text-emerald-600 font-medium">Live</span>
              </div>
              {subscription?.current_tier === "premium" ? (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white gap-1">
                  <Crown className="w-3 h-3" />
                  Premium
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  Basic
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
              <CardHeader className="pb-2">
                <CardDescription className="text-emerald-100">Available Balance</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="available-balance">
                  {formatCurrency(balance?.available_balance)}
                </p>
                <p className="text-sm text-emerald-100 mt-1">Ready to use</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
              <CardHeader className="pb-2">
                <CardDescription className="text-amber-100">Pending</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="pending-balance">
                  {formatCurrency(balance?.pending_balance)}
                </p>
                <p className="text-sm text-amber-100 mt-1">Processing</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-gradient-to-br from-slate-500 to-slate-600 text-white border-0">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-200">Reserved</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="reserved-balance">
                  {formatCurrency(balance?.reserved_balance)}
                </p>
                <p className="text-sm text-slate-200 mt-1">For payouts</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="h-auto py-4 flex-col gap-2 bg-emerald-600 hover:bg-emerald-700"
                data-testid="fund-wallet-btn"
              >
                <Plus className="w-5 h-5" />
                <span>Fund Wallet</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fund Your Wallet</DialogTitle>
                <DialogDescription>Add funds via bank transfer or mobile money</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Amount (ZMW)</Label>
                  <Input type="number" placeholder="Enter amount" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} data-testid="fund-amount-input" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" placeholder="your@email.com" value={fundEmail} onChange={(e) => setFundEmail(e.target.value)} data-testid="fund-email-input" />
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Fee:</span> {subscription?.fee_percentage || 2.5}%
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFundDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleFund} disabled={processing}>
                  {processing ? "Processing..." : "Continue to Payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="h-auto py-4 flex-col gap-2"
                variant={subscription?.current_tier === "premium" ? "default" : "outline"}
                disabled={subscription?.current_tier !== "premium"}
                data-testid="payout-btn"
              >
                <Send className="w-5 h-5" />
                <span>Send Payout</span>
                {subscription?.current_tier !== "premium" && (
                  <Badge variant="secondary" className="text-[10px]">Premium</Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Payout</DialogTitle>
                <DialogDescription>Transfer funds to a bank account</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Amount (ZMW)</Label>
                  <Input type="number" placeholder="Enter amount" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                  <p className="text-xs text-slate-500 mt-1">Daily limit remaining: {formatCurrency(balance?.daily_payout_remaining)}</p>
                </div>
                <div>
                  <Label>Bank</Label>
                  <Select value={payoutBank} onValueChange={setPayoutBank}>
                    <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>
                      {ZAMBIAN_BANKS.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input placeholder="Enter account number" value={payoutAccount} onChange={(e) => setPayoutAccount(e.target.value)} />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input placeholder="Account holder name" value={payoutName} onChange={(e) => setPayoutName(e.target.value)} />
                </div>
                <div>
                  <Label>Narration (Optional)</Label>
                  <Input placeholder="Payment description" value={payoutNarration} onChange={(e) => setPayoutNarration(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>Cancel</Button>
                <Button onClick={handlePayout} disabled={processing}>
                  {processing ? "Processing..." : "Send Payout"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Pull Funds Button */}
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2 border-sky-200 hover:bg-sky-50 text-sky-700"
            onClick={() => {
              if (bankAccounts.length === 0) {
                toast.error("Please link a bank account first");
                return;
              }
              setPullOrderDialogOpen(true);
            }}
            data-testid="pull-funds-btn"
          >
            <ArrowDown className="w-5 h-5" />
            <span>Pull Funds</span>
          </Button>

          <Dialog open={linkBankDialogOpen} onOpenChange={setLinkBankDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" data-testid="link-bank-btn">
                <Building2 className="w-5 h-5" />
                <span>Link Bank</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Bank Account</DialogTitle>
                <DialogDescription>Connect your bank account for easy funding</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Bank</Label>
                  <Select value={linkBankCode} onValueChange={setLinkBankCode}>
                    <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>
                      {ZAMBIAN_BANKS.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input placeholder="Enter account number" value={linkAccountNumber} onChange={(e) => setLinkAccountNumber(e.target.value)} />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input placeholder="Account holder name" value={linkAccountName} onChange={(e) => setLinkAccountName(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkBankDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleLinkBank} disabled={processing}>
                  {processing ? "Verifying..." : "Link Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={fetchWalletData}
            data-testid="refresh-btn"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions" className="gap-1.5" data-testid="tab-transactions">
              <History className="w-4 h-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="pull-orders" className="gap-1.5" data-testid="tab-pull-orders">
              <ArrowDown className="w-4 h-4" />
              Pull Orders
              {pullOrders.filter(po => po.status === "pending_approval").length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {pullOrders.filter(po => po.status === "pending_approval").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="banks" className="gap-1.5" data-testid="tab-banks">
              <Building2 className="w-4 h-4" />
              Bank Accounts
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5" data-testid="tab-settings">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Your recent wallet activity</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No transactions yet</p>
                    <p className="text-sm">Fund your wallet to get started</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell>{getTypeBadge(txn.type)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(txn.amount)}</TableCell>
                          <TableCell className="text-slate-500">{formatCurrency(txn.fee)}</TableCell>
                          <TableCell>{getStatusBadge(txn.status)}</TableCell>
                          <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                          <TableCell className="text-sm text-slate-500">{formatDate(txn.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pull Orders Tab */}
          <TabsContent value="pull-orders" data-testid="pull-orders-tab-content">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pull Orders</CardTitle>
                    <CardDescription>Fund requests from linked bank accounts</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      if (bankAccounts.length === 0) {
                        toast.error("Please link a bank account first");
                        return;
                      }
                      setPullOrderDialogOpen(true);
                    }}
                    data-testid="create-pull-order-btn"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Pull Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pullOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <ArrowDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No pull orders yet</p>
                    <p className="text-sm">Create a pull order to request funds from a linked bank account</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Source Account</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pullOrders.map((po) => (
                        <TableRow key={po.id} data-testid={`pull-order-row-${po.id}`}>
                          <TableCell className="font-mono text-xs">{po.reference}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(po.amount)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="text-slate-700">{po.source_account_name}</span>
                              <br />
                              <span className="text-slate-400 text-xs">{po.source_account_number_masked}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {po.purpose?.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(po.status)}</TableCell>
                          <TableCell className="text-sm text-slate-500">{formatDate(po.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPullOrderDetail(po.id)}
                                title="View details"
                                data-testid={`view-pull-order-${po.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {po.status === "pending_approval" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => {
                                      setSelectedPullOrder(po);
                                      setApproveDialogOpen(true);
                                    }}
                                    title="Approve"
                                    data-testid={`approve-pull-order-${po.id}`}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      setSelectedPullOrder(po);
                                      setRejectDialogOpen(true);
                                    }}
                                    title="Reject"
                                    data-testid={`reject-pull-order-${po.id}`}
                                  >
                                    <Ban className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-500 hover:text-slate-700"
                                    onClick={() => handleCancelPullOrder(po.id)}
                                    title="Cancel"
                                    data-testid={`cancel-pull-order-${po.id}`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {po.status === "approved" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                                  onClick={() => handleExecutePullOrder(po.id)}
                                  disabled={processing}
                                  title="Execute Pull"
                                  data-testid={`execute-pull-order-${po.id}`}
                                >
                                  <Play className="w-4 h-4" />
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

          {/* Bank Accounts Tab */}
          <TabsContent value="banks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Linked Bank Accounts</CardTitle>
                    <CardDescription>Manage your connected bank accounts</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setLinkBankDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Account
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {bankAccounts.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No bank accounts linked</p>
                    <p className="text-sm">Link a bank account to fund your wallet easily</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bankAccounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`bank-account-${account.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium">{account.bank_name}</p>
                            <p className="text-sm text-slate-500">{account.account_number_masked} &bull; {account.account_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {account.is_primary && <Badge variant="secondary">Primary</Badge>}
                          <Badge className={account.status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                            {account.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {subscription?.current_tier === "premium" ? <Crown className="w-5 h-5 text-amber-500" /> : <Zap className="w-5 h-5" />}
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Current Plan</span>
                    <Badge className={subscription?.current_tier === "premium" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" : ""}>
                      {subscription?.current_tier?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Transaction Fee</span>
                    <span className="font-medium">{subscription?.fee_percentage}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">API Access</span>
                    <span className="font-medium">{subscription?.api_access ? "Enabled" : "Disabled"}</span>
                  </div>
                  {subscription?.upgrade_available && (
                    <div className="pt-4 border-t">
                      <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                        <Crown className="w-4 h-4 mr-2" />
                        Upgrade to Premium
                      </Button>
                      <p className="text-xs text-center text-slate-500 mt-2">Unlock payouts, lower fees, and API access</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {subscription?.features?.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Payout Limits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Daily Limit</p>
                      <span className="text-2xl font-bold">{formatCurrency(subscription?.limits?.daily_payout_limit)}</span>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((subscription?.limits?.daily_payout_used || 0) / (subscription?.limits?.daily_payout_limit || 1)) * 100}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Used: {formatCurrency(subscription?.limits?.daily_payout_used)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Monthly Limit</p>
                      <span className="text-2xl font-bold">{formatCurrency(subscription?.limits?.monthly_payout_limit)}</span>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((subscription?.limits?.monthly_payout_used || 0) / (subscription?.limits?.monthly_payout_limit || 1)) * 100}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Used: {formatCurrency(subscription?.limits?.monthly_payout_used)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ===== PULL ORDER DIALOGS ===== */}

      {/* Create Pull Order Dialog */}
      <Dialog open={pullOrderDialogOpen} onOpenChange={setPullOrderDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Pull Order</DialogTitle>
            <DialogDescription>
              Request funds from a linked bank account. The account holder must approve before funds are pulled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Source Bank Account</Label>
              <Select value={pullBankAccountId} onValueChange={setPullBankAccountId}>
                <SelectTrigger data-testid="pull-bank-select">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.filter(ba => ba.status === "verified").map(ba => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.bank_name} &bull; {ba.account_number_masked} &bull; {ba.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (ZMW)</Label>
              <Input
                type="number"
                placeholder="Enter amount to pull"
                value={pullAmount}
                onChange={(e) => setPullAmount(e.target.value)}
                data-testid="pull-amount-input"
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Select value={pullPurpose} onValueChange={setPullPurpose}>
                <SelectTrigger data-testid="pull-purpose-select">
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  {PULL_PURPOSE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the reason for this pull order"
                value={pullDescription}
                onChange={(e) => setPullDescription(e.target.value)}
                data-testid="pull-description-input"
              />
            </div>
            <div>
              <Label>Reference (Optional)</Label>
              <Input
                placeholder="e.g., Filing ID, Invoice Number"
                value={pullPurposeRef}
                onChange={(e) => setPullPurposeRef(e.target.value)}
                data-testid="pull-reference-input"
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  The account holder will receive an approval request. Funds will only be pulled after explicit approval.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPullOrderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePullOrder} disabled={processing} data-testid="submit-pull-order-btn">
              {processing ? "Creating..." : "Create Pull Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Pull Order Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Pull Order</DialogTitle>
            <DialogDescription>
              Confirm approval to debit {selectedPullOrder && formatCurrency(selectedPullOrder.amount)} from the linked bank account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPullOrder && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono">{selectedPullOrder.reference}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold">{formatCurrency(selectedPullOrder.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Source</span>
                  <span>{selectedPullOrder.source_account_name} ({selectedPullOrder.source_account_number_masked})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Description</span>
                  <span>{selectedPullOrder.description}</span>
                </div>
              </div>
            )}
            <div>
              <Label>Client Name (Approver)</Label>
              <Input
                placeholder="Enter your full name"
                value={approveClientName}
                onChange={(e) => setApproveClientName(e.target.value)}
                data-testid="approve-client-name"
              />
            </div>
            <div>
              <Label>Client Email</Label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={approveClientEmail}
                onChange={(e) => setApproveClientEmail(e.target.value)}
                data-testid="approve-client-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveDialogOpen(false); setSelectedPullOrder(null); }}>Cancel</Button>
            <Button onClick={handleApprovePullOrder} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-approve-btn">
              {processing ? "Approving..." : "Approve Pull Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Pull Order Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Pull Order</DialogTitle>
            <DialogDescription>
              Reject the debit request of {selectedPullOrder && formatCurrency(selectedPullOrder.amount)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPullOrder && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono">{selectedPullOrder.reference}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold">{formatCurrency(selectedPullOrder.amount)}</span>
                </div>
              </div>
            )}
            <div>
              <Label>Your Name (Optional)</Label>
              <Input
                placeholder="Enter your name"
                value={rejectClientName}
                onChange={(e) => setRejectClientName(e.target.value)}
                data-testid="reject-client-name"
              />
            </div>
            <div>
              <Label>Reason for Rejection</Label>
              <Textarea
                placeholder="Please provide a reason for rejecting this pull order"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                data-testid="reject-reason-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setSelectedPullOrder(null); }}>Cancel</Button>
            <Button onClick={handleRejectPullOrder} disabled={processing} variant="destructive" data-testid="confirm-reject-btn">
              {processing ? "Rejecting..." : "Reject Pull Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pull Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pull Order Details</DialogTitle>
          </DialogHeader>
          {pullOrderDetail && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono">{pullOrderDetail.pull_order?.reference}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold">{formatCurrency(pullOrderDetail.pull_order?.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fee</span>
                  <span>{formatCurrency(pullOrderDetail.pull_order?.fee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Net Amount</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(pullOrderDetail.pull_order?.net_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  {getStatusBadge(pullOrderDetail.pull_order?.status)}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Source</span>
                  <span>{pullOrderDetail.pull_order?.source_account_name} ({pullOrderDetail.pull_order?.source_account_number_masked})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Purpose</span>
                  <span className="capitalize">{pullOrderDetail.pull_order?.purpose?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Description</span>
                  <span className="text-right max-w-[200px]">{pullOrderDetail.pull_order?.description}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Created</span>
                  <span>{formatDate(pullOrderDetail.pull_order?.created_at)}</span>
                </div>
                {pullOrderDetail.pull_order?.approved_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Approved At</span>
                    <span>{formatDate(pullOrderDetail.pull_order?.approved_at)}</span>
                  </div>
                )}
                {pullOrderDetail.pull_order?.approved_by && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Approved By</span>
                    <span>{pullOrderDetail.pull_order?.approved_by}</span>
                  </div>
                )}
                {pullOrderDetail.pull_order?.executed_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Executed At</span>
                    <span>{formatDate(pullOrderDetail.pull_order?.executed_at)}</span>
                  </div>
                )}
                {pullOrderDetail.pull_order?.rejection_reason && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Rejection Reason</span>
                    <span className="text-red-600 text-right max-w-[200px]">{pullOrderDetail.pull_order?.rejection_reason}</span>
                  </div>
                )}
              </div>

              {/* Audit Trail */}
              {pullOrderDetail.audit_trail?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    Audit Trail
                  </h4>
                  <div className="space-y-2">
                    {pullOrderDetail.audit_trail.map((audit, idx) => (
                      <div key={idx} className="text-xs border rounded-md p-2 bg-white">
                        <div className="flex justify-between">
                          <Badge variant="outline" className="capitalize text-[10px]">{audit.action}</Badge>
                          <span className="text-slate-400">{formatDate(audit.timestamp)}</span>
                        </div>
                        {audit.client_name && <p className="mt-1 text-slate-600">By: {audit.client_name}</p>}
                        {audit.reason && <p className="mt-1 text-slate-600">Reason: {audit.reason}</p>}
                        <p className="mt-1 text-slate-400">IP: {audit.ip_address}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
