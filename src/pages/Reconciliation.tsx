import { useState, useEffect, useMemo } from "react";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { formatCurrency, formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Checkbox } from "../components/ui/Checkbox";
import { Button } from "../components/ui/Button";
import { Search, CheckCircle2, Circle } from "lucide-react";

export function Reconciliation() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const updateTransactions = () => {
      setTransactions(StorageService.getTransactions());
    };
    updateTransactions();
    const interval = setInterval(updateTransactions, 2000);
    return () => clearInterval(interval);
  }, []);

  const pendingTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.type === "credit") // Only deposits
      .filter((t) => !t.added_to_vyapar && !t.inVyapar)
      .filter((t) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          t.description.toLowerCase().includes(query) ||
          t.partyName.toLowerCase().includes(query) ||
          t.referenceNumber?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchQuery]);

  const syncedTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.type === "credit") // Only deposits
      .filter((t) => (t.added_to_vyapar || t.inVyapar) && t.vyapar_reference_number)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20); // Show last 20 synced
  }, [transactions]);

  const handleToggleVyapar = (id: string, checked: boolean) => {
    StorageService.updateTransaction(id, { added_to_vyapar: checked });
    if (!checked) {
      // Clear reference number when unchecked
      StorageService.updateTransaction(id, { vyapar_reference_number: undefined });
    }
    setTransactions(StorageService.getTransactions());
  };

  const handleBulkSync = (checked: boolean) => {
    pendingTransactions.forEach((t) => {
      StorageService.updateTransaction(t.id, { inVyapar: checked });
    });
    setTransactions(StorageService.getTransactions());
  };

  const stats = {
    total: transactions.filter((t) => t.type === "credit").length,
    synced: transactions.filter(
      (t) => t.type === "credit" && (t.added_to_vyapar || t.inVyapar) && t.vyapar_reference_number
    ).length,
    pending: pendingTransactions.length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reconciliation</h1>
        <p className="text-muted-foreground mt-1">Track which transactions are entered in Vyapar</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Synced with Vyapar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.synced}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Sync ({pendingTransactions.length})</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Check the box when you've entered the transaction in Vyapar
              </p>
            </div>
            {pendingTransactions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkSync(true)}
              >
                Mark All as Synced
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search pending transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {pendingTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
              <p>All transactions are synced with Vyapar!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={transaction.added_to_vyapar || transaction.inVyapar || false}
                    onChange={(e) => handleToggleVyapar(transaction.id, e.target.checked)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{transaction.description}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          transaction.type === "credit"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {transaction.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <strong>Date:</strong> {formatDate(transaction.date)} |{" "}
                        <strong>Amount:</strong>{" "}
                        <span
                          className={`font-semibold ${
                            transaction.type === "credit" ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {transaction.type === "credit" ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                      {transaction.partyName && (
                        <div>
                          <strong>Party:</strong> {transaction.partyName} |{" "}
                          <strong>Category:</strong> {transaction.category}
                        </div>
                      )}
                      {transaction.referenceNumber && (
                        <div>
                          <strong>Reference:</strong> {transaction.referenceNumber}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {syncedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Synced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-3 border rounded-lg bg-green-50/50"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">{transaction.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(transaction.date)} • {formatCurrency(transaction.amount)}
                      {transaction.vyapar_reference_number && (
                        <span className="ml-2">• Ref: {transaction.vyapar_reference_number}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

