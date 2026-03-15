import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
  AlertTriangle
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

export default function WalletPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  
  // Dialog states
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [linkBankDialogOpen, setLinkBankDialogOpen] = useState(false);
  
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
  
  const [processing, setProcessing] = useState(false);

  // Demo company ID (in production, get from auth context)
  const companyId = "test-company-001";

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      // Fetch or create sub-account
      let walletData;
      try {
        const walletRes = await axios.get(`${API}/wallet/sub-accounts/${companyId}`);
        walletData = walletRes.data;
      } catch (err) {
        if (err.response?.status === 404) {
          // Create new sub-account
          const createRes = await axios.post(`${API}/wallet/sub-accounts`, {
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

      // Fetch balance, subscription, transactions in parallel
      const [balanceRes, subRes, txnRes, bankRes] = await Promise.all([
        axios.get(`${API}/wallet/balance/${companyId}`),
        axios.get(`${API}/wallet/subscription/${companyId}`),
        axios.get(`${API}/wallet/transactions/${companyId}`),
        axios.get(`${API}/wallet/bank-accounts/${companyId}`)
      ]);

      setBalance(balanceRes.data);
      setSubscription(subRes.data);
      setTransactions(txnRes.data.transactions || []);
      setBankAccounts(bankRes.data || []);
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
      const response = await axios.post(`${API}/wallet/fund/${companyId}`, {
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
      await axios.post(`${API}/wallet/payout/${companyId}`, {
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
      await axios.post(`${API}/wallet/bank-accounts/${companyId}/link`, {
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
      processing: { bg: "bg-blue-100", text: "text-blue-700", icon: RefreshCw },
      completed: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
      failed: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
      cancelled: { bg: "bg-slate-100", text: "text-slate-700", icon: XCircle }
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bg} ${config.text} gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
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
            <div className="flex items-center gap-2">
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
          {/* Available Balance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
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

          {/* Pending Balance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
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

          {/* Reserved Balance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Fund Wallet */}
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
                <DialogDescription>
                  Add funds via bank transfer or mobile money
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Amount (ZMW)</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    data-testid="fund-amount-input"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={fundEmail}
                    onChange={(e) => setFundEmail(e.target.value)}
                    data-testid="fund-email-input"
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Fee:</span> {subscription?.fee_percentage || 2.5}%
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFundDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleFund} disabled={processing}>
                  {processing ? "Processing..." : "Continue to Payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Send Payout */}
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
                <DialogDescription>
                  Transfer funds to a bank account
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Amount (ZMW)</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Daily limit remaining: {formatCurrency(balance?.daily_payout_remaining)}
                  </p>
                </div>
                <div>
                  <Label>Bank</Label>
                  <Select value={payoutBank} onValueChange={setPayoutBank}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ZAMBIAN_BANKS.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input
                    placeholder="Enter account number"
                    value={payoutAccount}
                    onChange={(e) => setPayoutAccount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input
                    placeholder="Account holder name"
                    value={payoutName}
                    onChange={(e) => setPayoutName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Narration (Optional)</Label>
                  <Input
                    placeholder="Payment description"
                    value={payoutNarration}
                    onChange={(e) => setPayoutNarration(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePayout} disabled={processing}>
                  {processing ? "Processing..." : "Send Payout"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Link Bank */}
          <Dialog open={linkBankDialogOpen} onOpenChange={setLinkBankDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                data-testid="link-bank-btn"
              >
                <Building2 className="w-5 h-5" />
                <span>Link Bank</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Bank Account</DialogTitle>
                <DialogDescription>
                  Connect your bank account for easy funding
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Bank</Label>
                  <Select value={linkBankCode} onValueChange={setLinkBankCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ZAMBIAN_BANKS.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input
                    placeholder="Enter account number"
                    value={linkAccountNumber}
                    onChange={(e) => setLinkAccountNumber(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input
                    placeholder="Account holder name"
                    value={linkAccountName}
                    onChange={(e) => setLinkAccountName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkBankDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleLinkBank} disabled={processing}>
                  {processing ? "Verifying..." : "Link Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Refresh */}
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
            <TabsTrigger value="transactions" className="gap-1.5">
              <History className="w-4 h-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="banks" className="gap-1.5">
              <Building2 className="w-4 h-4" />
              Bank Accounts
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
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
                          <TableCell className="font-medium">
                            {formatCurrency(txn.amount)}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {formatCurrency(txn.fee)}
                          </TableCell>
                          <TableCell>{getStatusBadge(txn.status)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {txn.reference}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {formatDate(txn.created_at)}
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
                      <div 
                        key={account.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium">{account.bank_name}</p>
                            <p className="text-sm text-slate-500">
                              {account.account_number_masked} • {account.account_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {account.is_primary && (
                            <Badge variant="secondary">Primary</Badge>
                          )}
                          <Badge 
                            className={account.status === "verified" 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-amber-100 text-amber-700"
                            }
                          >
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
              {/* Subscription Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {subscription?.current_tier === "premium" ? (
                      <Crown className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Current Plan</span>
                    <Badge className={subscription?.current_tier === "premium" 
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                      : ""
                    }>
                      {subscription?.current_tier?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Transaction Fee</span>
                    <span className="font-medium">{subscription?.fee_percentage}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">API Access</span>
                    <span className="font-medium">
                      {subscription?.api_access ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  {subscription?.upgrade_available && (
                    <div className="pt-4 border-t">
                      <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                        <Crown className="w-4 h-4 mr-2" />
                        Upgrade to Premium
                      </Button>
                      <p className="text-xs text-center text-slate-500 mt-2">
                        Unlock payouts, lower fees, and API access
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Features Card */}
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

              {/* Limits Card */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Payout Limits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Daily Limit</p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">
                          {formatCurrency(subscription?.limits?.daily_payout_limit)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ 
                            width: `${((subscription?.limits?.daily_payout_used || 0) / (subscription?.limits?.daily_payout_limit || 1)) * 100}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Used: {formatCurrency(subscription?.limits?.daily_payout_used)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Monthly Limit</p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">
                          {formatCurrency(subscription?.limits?.monthly_payout_limit)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ 
                            width: `${((subscription?.limits?.monthly_payout_used || 0) / (subscription?.limits?.monthly_payout_limit || 1)) * 100}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Used: {formatCurrency(subscription?.limits?.monthly_payout_used)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
