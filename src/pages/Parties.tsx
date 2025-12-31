import { useState, useEffect } from "react";
import { Party } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { formatCurrency, formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Search, TrendingUp, TrendingDown } from "lucide-react";

export function Parties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const updateParties = () => {
      const allParties = StorageService.getParties();
      // Recalculate balances from transactions
      const transactions = StorageService.getTransactions();
      const updatedParties = allParties.map((party) => {
        const partyTransactions = transactions.filter(
          (t) => t.partyName.toLowerCase() === party.name.toLowerCase()
        );
        const totalCredits = partyTransactions
          .filter((t) => t.type === "credit")
          .reduce((sum, t) => sum + t.amount, 0);
        const totalDebits = partyTransactions
          .filter((t) => t.type === "debit")
          .reduce((sum, t) => sum + t.amount, 0);
        const balance = totalCredits - totalDebits;

        return {
          ...party,
          totalCredits,
          totalDebits,
          balance,
          lastTransactionDate:
            partyTransactions.length > 0
              ? partyTransactions.sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                )[0].date
              : undefined,
        };
      });
      setParties(updatedParties.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)));
    };
    updateParties();
    const interval = setInterval(updateParties, 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredParties = parties.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(query);
  });

  const customers = filteredParties.filter((p) => p.type === "customer");
  const suppliers = filteredParties.filter((p) => p.type === "supplier");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-display font-bold text-gradient">
          Parties
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage customers and suppliers with their balances
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Customers ({customers.length})</h2>
        {customers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No customers found
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customers.map((party) => (
              <Card key={party.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{party.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <span
                      className={`text-lg font-bold ${
                        party.balance >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {party.balance >= 0 ? "+" : ""}
                      {formatCurrency(party.balance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Credits</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(party.totalCredits)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Debits</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(party.totalDebits)}
                    </span>
                  </div>
                  {party.lastTransactionDate && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Last transaction: {formatDate(party.lastTransactionDate)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Suppliers ({suppliers.length})</h2>
        {suppliers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No suppliers found
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((party) => (
              <Card key={party.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{party.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <span
                      className={`text-lg font-bold ${
                        party.balance <= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {party.balance >= 0 ? "+" : ""}
                      {formatCurrency(party.balance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Credits</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(party.totalCredits)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Debits</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(party.totalDebits)}
                    </span>
                  </div>
                  {party.lastTransactionDate && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Last transaction: {formatDate(party.lastTransactionDate)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

