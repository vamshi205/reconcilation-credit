import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { StorageService, DashboardStats } from "../services/storageService";
import { fetchTransactionsFromSheets, isGoogleSheetsConfigured } from "../services/googleSheetsService";
import { Transaction } from "../types/transaction";
import { formatCurrency } from "../lib/utils";
import { AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Button } from "../components/ui/Button";

export function Dashboard() {
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

  // Load transactions from Google Sheets
  useEffect(() => {
    const loadTransactions = async () => {
      if (isGoogleSheetsConfigured()) {
        try {
          const sheetsTransactions = await fetchTransactionsFromSheets();
          // Only show deposits (credits)
          const creditTransactions = sheetsTransactions.filter((t) => t.type === "credit");
          setTransactions(creditTransactions);
        } catch (error) {
          console.error('Error fetching transactions for dashboard:', error);
          setTransactions([]);
        }
      } else {
        // Fallback to local storage if Google Sheets not configured
        const localTransactions = StorageService.getTransactions();
        const creditTransactions = localTransactions.filter((t) => t.type === "credit");
        setTransactions(creditTransactions);
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
