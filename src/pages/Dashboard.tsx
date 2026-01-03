import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { StorageService } from "../services/storageService";
import { fetchTransactionsFromSheets, isGoogleSheetsConfigured } from "../services/googleSheetsService";
import { Transaction, DashboardStats } from "../types/transaction";
import { formatCurrency } from "../lib/utils";
import { AlertCircle, CheckCircle, TrendingUp, Loader2 } from "lucide-react";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Button } from "../components/ui/Button";

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalDepositAmount: 0,
    pendingAmount: 0,
    completedAmount: 0,
    pendingCount: 0,
    totalCredits: 0,
    totalDebits: 0,
    netBalance: 0,
    pendingSyncCount: 0,
    transactionsThisMonth: 0,
    transactionsThisYear: 0,
  });

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load transactions from Google Sheets
  useEffect(() => {
    const loadTransactions = async () => {
      setIsLoading(true);
      if (isGoogleSheetsConfigured()) {
        try {
          console.log('Loading transactions from Google Sheets...');
          const sheetsTransactions = await fetchTransactionsFromSheets();
          console.log(`Fetched ${sheetsTransactions.length} transactions from Google Sheets`);
          // Only show deposits (credits)
          const creditTransactions = sheetsTransactions.filter((t) => t.type === "credit");
          console.log(`Filtered to ${creditTransactions.length} credit transactions`);
          setTransactions(creditTransactions);
        } catch (error) {
          console.error('Error fetching transactions for dashboard:', error);
          // Show error message to user
          alert(`Failed to load transactions from Google Sheets.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n1. Google Sheets URL is configured\n2. Google Apps Script is authorized\n3. Check browser console for details`);
          setTransactions([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        console.warn('Google Sheets not configured. Cannot load transactions.');
        // Fallback to local storage if Google Sheets not configured
        const localTransactions = StorageService.getTransactions();
        const creditTransactions = localTransactions.filter((t) => t.type === "credit");
        console.log(`Loaded ${creditTransactions.length} transactions from local storage`);
        setTransactions(creditTransactions);
        setIsLoading(false);
      }
    };
    
    loadTransactions();
    // Update stats every 5 seconds to reflect changes
    const interval = setInterval(loadTransactions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats from transactions
  useEffect(() => {
    const calculateStats = (): DashboardStats => {
      let filteredTransactions = [...transactions];
      
      // Apply year filter if provided
      if (selectedYear) {
        const year = parseInt(selectedYear);
        filteredTransactions = filteredTransactions.filter((t) => {
          const tDate = new Date(t.date);
          return tDate.getFullYear() === year;
        });
      }

      // Migrate legacy inVyapar to added_to_vyapar
      filteredTransactions = filteredTransactions.map((t) => {
        if (t.inVyapar !== undefined && t.added_to_vyapar === undefined) {
          t.added_to_vyapar = t.inVyapar;
        }
        return t;
      });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const totalDepositAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Pending: not completed (not all: checked, has ref, AND has party name) AND not on hold
      const pendingTransactions = filteredTransactions.filter(
        (t) => {
          const isHold = t.hold === true;
          if (isHold) return false; // Exclude hold transactions
          const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
          const hasRef = Boolean(t.vyapar_reference_number && String(t.vyapar_reference_number).trim() !== '');
          const hasPartyName = Boolean(t.partyName && t.partyName.trim() !== '');
          const isCompleted = isChecked && hasRef && hasPartyName;
          return !isCompleted;
        }
      );
      const pendingAmount = pendingTransactions.reduce((sum, t) => sum + t.amount, 0);
      const pendingCount = pendingTransactions.length;

      // Completed: added to vyapar AND has reference number AND has party name
      const completedTransactions = filteredTransactions.filter(
        (t) => {
          const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
          const hasRef = Boolean(t.vyapar_reference_number && String(t.vyapar_reference_number).trim() !== '');
          const hasPartyName = Boolean(t.partyName && t.partyName.trim() !== '');
          return isChecked && hasRef && hasPartyName;
        }
      );
      const completedAmount = completedTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Legacy stats
      const totalCredits = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
      const totalDebits = 0; // No debits in this system
      const netBalance = totalCredits - totalDebits;
      const pendingSyncCount = pendingCount;

      const transactionsThisMonth = filteredTransactions.filter(
        (t) => new Date(t.date) >= startOfMonth
      ).length;
      const transactionsThisYear = filteredTransactions.filter(
        (t) => new Date(t.date) >= startOfYear
      ).length;

      return {
        totalDepositAmount,
        pendingAmount,
        completedAmount,
        pendingCount,
        totalCredits,
        totalDebits,
        netBalance,
        pendingSyncCount,
        transactionsThisMonth,
        transactionsThisYear,
      };
    };

    setStats(calculateStats());
  }, [transactions, selectedYear]);

  // Generate year options (current year and 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => (currentYear - i).toString());

  const kpiCards = [
    {
      title: "Total Deposit Amount",
      value: formatCurrency(stats.totalDepositAmount),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Pending Amount",
      value: formatCurrency(stats.pendingAmount),
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      subtitle: `${stats.pendingCount} transactions`,
    },
    {
      title: "Completed Amount",
      value: formatCurrency(stats.completedAmount),
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Transactions",
      value: stats.pendingCount.toString(),
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  const isConfigured = isGoogleSheetsConfigured();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-gradient">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Overview of deposit transactions and Vyapar sync status</p>
        </div>
      </div>

      {/* Warning if Google Sheets not configured */}
      {!isConfigured && (
        <Card className="glass-card border-2 border-orange-500/60 bg-orange-50/50 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">Google Sheets Not Configured</h3>
                <p className="text-sm text-orange-800 mb-3">
                  Transactions are not loading because Google Sheets is not configured. Please set up your Google Sheets integration.
                </p>
                <p className="text-xs text-orange-700">
                  <strong>To fix:</strong> Set <code className="bg-orange-100 px-1 rounded">VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL</code> in your Vercel environment variables and redeploy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isConfigured && isLoading && (
        <Card className="glass-card border-2 border-primary/60 bg-primary/5 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Loading Transactions...</h3>
                <p className="text-sm text-muted-foreground">
                  Fetching data from Google Sheets. Please wait...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info if no transactions (only show after loading is complete) */}
      {isConfigured && !isLoading && transactions.length === 0 && (
        <Card className="glass-card border-2 border-blue-500/60 bg-blue-50/50 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">No Transactions Found</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Your Google Sheet appears to be empty. Upload a CSV file or add transactions manually to get started.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/csv-upload')}
                  >
                    Upload CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/manual-entry')}
                  >
                    Manual Entry
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Year Filter */}
      <Card className="glass-card border-2 border-border/60 animate-fade-in">
        <CardHeader className="bg-muted/30 border-b border-border/60">
          <CardTitle>Year Filter</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="yearSelect" className="text-sm font-semibold mb-2 block">Select Year</Label>
              <select
                id="yearSelect"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="flex h-11 w-full rounded-md border-2 border-slate-400 bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => setSelectedYear(new Date().getFullYear().toString())}
              >
                Reset to Current Year
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <Card 
            key={kpi.title} 
            className="glass-card border-2 border-border/60 hover:border-primary/40 transition-all duration-300 animate-scale-in overflow-hidden"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">{kpi.title}</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpi.value}</div>
              {kpi.subtitle && (
                <p className="text-xs text-muted-foreground mt-2 font-medium">{kpi.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Deposits</span>
              <span className="font-semibold">{formatCurrency(stats.totalDepositAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pending Amount</span>
              <span className="font-semibold text-orange-600">
                {formatCurrency(stats.pendingAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Completed Amount</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(stats.completedAmount)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Pending Transactions</span>
              <span className="font-semibold">{stats.pendingCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Upload bank CSV with deposit transactions</li>
              <li>Review transactions in Transactions page</li>
              <li>Enter transactions in Vyapar manually</li>
              <li>Check "Added to Vyapar" checkbox</li>
              <li>Enter Vyapar reference number</li>
              <li>Track completion status in Dashboard</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
