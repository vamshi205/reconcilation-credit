import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { StorageService, DashboardStats } from "../services/storageService";
import { formatCurrency } from "../lib/utils";
import { DollarSign, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
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

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const updateStats = () => {
      setStats(StorageService.getDashboardStats(dateFrom || undefined, dateTo || undefined));
    };
    updateStats();
    // Update stats every 2 seconds to reflect changes
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, [dateFrom, dateTo]);

  const handleClearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  const kpiCards = [
    {
      title: "Total Deposit Amount",
      value: formatCurrency(stats.totalDepositAmount),
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of deposit transactions and Vyapar sync status</p>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              {kpi.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
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
