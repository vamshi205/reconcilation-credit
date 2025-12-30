import { useState, useEffect, useMemo, useRef } from "react";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Checkbox } from "../components/ui/Checkbox";
import { Button } from "../components/ui/Button";
import { Search, CheckCircle2, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Label } from "../components/ui/Label";

type ViewType = "pending" | "completed";

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<ViewType>("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Local state for input values to prevent focus loss
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const focusedInputId = useRef<string | null>(null);

  // Load transactions from storage
  const loadTransactions = () => {
    // Don't reload if user is currently typing in an input
    if (focusedInputId.current !== null) {
      return;
    }
    
    let allTransactions = StorageService.getTransactions();
    // Migrate legacy inVyapar to added_to_vyapar
    allTransactions = allTransactions.map((t) => {
      if (t.inVyapar !== undefined && t.added_to_vyapar === undefined) {
        t.added_to_vyapar = t.inVyapar;
      }
      return t;
    });
    // Only show deposits (credits)
    const creditTransactions = allTransactions.filter((t) => t.type === "credit");
    setTransactions(creditTransactions);
    
    // Sync input values with transactions (but don't overwrite focused input)
    setInputValues((prev) => {
      const newValues = { ...prev };
      creditTransactions.forEach((t) => {
        if (focusedInputId.current !== t.id && t.vyapar_reference_number) {
          newValues[t.id] = t.vyapar_reference_number;
        }
      });
      return newValues;
    });
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // Filter transactions based on view, date, and search
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply view filter
    // Note: We check inputValues inside the filter function, but don't include it in dependencies
    // This prevents re-renders while typing, but still shows correct filtering
    if (view === "pending") {
      // Pending: Transactions that are NOT completed
      // (not both checkbox checked AND reference number entered)
      filtered = filtered.filter((t) => {
        const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
        const storageRef = t.vyapar_reference_number?.trim();
        // Access inputValues directly (closure) - not in dependencies to prevent re-renders
        const localRef = inputValues[t.id]?.trim();
        const hasReference = Boolean(storageRef || localRef);
        // Show if NOT completed (not both checked and has reference)
        return !(isChecked && hasReference);
      });
    } else if (view === "completed") {
      // Completed: BOTH checkbox checked AND reference number entered
      filtered = filtered.filter((t) => {
        const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
        const storageRef = t.vyapar_reference_number?.trim();
        // Access inputValues directly (closure) - not in dependencies to prevent re-renders
        const localRef = inputValues[t.id]?.trim();
        const hasReference = Boolean(storageRef || localRef);
        return isChecked && hasReference;
      });
    }

    // Apply date filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter((t) => {
        const tDate = new Date(t.date);
        if (dateFrom && tDate < new Date(dateFrom)) return false;
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (tDate > toDate) return false;
        }
        return true;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(query) ||
          t.partyName.toLowerCase().includes(query) ||
          t.referenceNumber?.toLowerCase().includes(query) ||
          t.vyapar_reference_number?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Note: inputValues is accessed via closure but not in dependencies
    // This prevents re-renders while typing, but filter still works correctly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, searchQuery, view, dateFrom, dateTo]);

  // Handle checkbox toggle
  const handleToggleVyapar = (id: string, checked: boolean) => {
    StorageService.updateTransaction(id, { added_to_vyapar: checked });
    if (!checked) {
      StorageService.updateTransaction(id, { vyapar_reference_number: undefined });
      // Clear local input value
      setInputValues((prev) => {
        const newValues = { ...prev };
        delete newValues[id];
        return newValues;
      });
    }
    // Update transaction in local state immediately
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              added_to_vyapar: checked,
              vyapar_reference_number: checked ? t.vyapar_reference_number : undefined,
            }
          : t
      )
    );
  };

  // Handle reference number change
  const handleReferenceChange = (id: string, value: string) => {
    // ONLY update local input state - don't update transactions state while typing
    // This prevents re-renders that cause focus loss
    setInputValues((prev) => ({ ...prev, [id]: value }));
    // Save to storage in background (async, doesn't cause re-render)
    // Use setTimeout to debounce storage updates
    setTimeout(() => {
      StorageService.updateTransaction(id, { vyapar_reference_number: value || undefined });
    }, 500);
  };

  // Handle confirm (tick icon)
  const handleConfirm = (id: string) => {
    const transaction = transactions.find((t) => t.id === id);
    if (transaction) {
      const finalValue = inputValues[id] ?? transaction.vyapar_reference_number ?? "";
      if (finalValue.trim()) {
        // Ensure checkbox is checked and save
        StorageService.updateTransaction(id, {
          added_to_vyapar: true,
          vyapar_reference_number: finalValue.trim(),
        });
        
        // Clear focus tracking
        focusedInputId.current = null;
        
        // Update local state
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  added_to_vyapar: true,
                  vyapar_reference_number: finalValue.trim(),
                }
              : t
          )
        );
        
        // Clear local input value
        setInputValues((prev) => {
          const newValues = { ...prev };
          delete newValues[id];
          return newValues;
        });
        
        alert("Transaction moved to completed transactions");
      }
    }
  };

  // Handle cancel (X icon)
  const handleCancel = (id: string) => {
    StorageService.updateTransaction(id, {
      added_to_vyapar: false,
      vyapar_reference_number: undefined,
    });
    
    // Clear focus tracking
    focusedInputId.current = null;
    
    // Update local state
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              added_to_vyapar: false,
              vyapar_reference_number: undefined,
            }
          : t
      )
    );
    
    // Clear local input value
    setInputValues((prev) => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground mt-1">
          Manage deposit transactions and track Vyapar entries ({filteredTransactions.length} found)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setView("pending")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            view === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Pending Transactions
        </button>
        <button
          onClick={() => setView("completed")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            view === "completed"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Completed
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range Filters */}
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
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear Dates
              </Button>
            </div>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left text-sm font-medium">Added to Vyapar</th>
                  <th className="p-3 text-left text-sm font-medium">Date</th>
                  <th className="p-3 text-left text-sm font-medium">Narration</th>
                  <th className="p-3 text-left text-sm font-medium">Bank Ref No.</th>
                  <th className="p-3 text-left text-sm font-medium">Amount</th>
                  <th className="p-3 text-left text-sm font-medium">Party</th>
                  <th className="p-3 text-left text-sm font-medium">Vyapar Ref No.</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const isAdded = transaction.added_to_vyapar || transaction.inVyapar;
                    // Check both storage and local input values
                    const storageRef = transaction.vyapar_reference_number?.trim();
                    const localRef = inputValues[transaction.id]?.trim();
                    const hasReference = Boolean(storageRef || localRef);
                    const showIcons = isAdded && hasReference;

                    return (
                      <tr
                        key={transaction.id}
                        className={cn(
                          "border-t transition-colors",
                          isAdded && "bg-green-50"
                        )}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={isAdded}
                            onChange={(e) => handleToggleVyapar(transaction.id, e.target.checked)}
                          />
                        </td>
                        <td className="p-3 text-sm">{formatDate(transaction.date)}</td>
                        <td className="p-3 text-sm">{transaction.description}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {transaction.referenceNumber || "-"}
                        </td>
                        <td className="p-3 text-sm font-semibold text-green-600">
                          ₹{transaction.amount.toLocaleString()}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {transaction.partyName}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Input
                              key={`input-${transaction.id}`}
                              value={inputValues[transaction.id] ?? transaction.vyapar_reference_number ?? ""}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleReferenceChange(transaction.id, e.target.value);
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                focusedInputId.current = transaction.id;
                                // Ensure we have the current value in local state
                                if (!inputValues[transaction.id] && transaction.vyapar_reference_number) {
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [transaction.id]: transaction.vyapar_reference_number || "",
                                  }));
                                }
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                // Save the final value when user leaves the input
                                const finalValue = inputValues[transaction.id] ?? "";
                                if (finalValue !== (transaction.vyapar_reference_number || "")) {
                                  StorageService.updateTransaction(transaction.id, {
                                    vyapar_reference_number: finalValue || undefined,
                                  });
                                  // Update transaction state after blur
                                  setTransactions((prev) =>
                                    prev.map((t) =>
                                      t.id === transaction.id
                                        ? { ...t, vyapar_reference_number: finalValue || undefined }
                                        : t
                                    )
                                  );
                                }
                                // Small delay to allow button clicks
                                setTimeout(() => {
                                  if (document.activeElement?.tagName !== "BUTTON") {
                                    focusedInputId.current = null;
                                  }
                                }, 200);
                              }}
                              placeholder={isAdded ? "Enter Vyapar ref..." : "Check box to enable"}
                              disabled={!isAdded}
                              className={cn(
                                "w-full max-w-xs transition-all",
                                !isAdded && "bg-muted opacity-50 cursor-not-allowed",
                                isAdded && "bg-white opacity-100"
                              )}
                            />
                            {showIcons && (
                              <>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleConfirm(transaction.id);
                                  }}
                                  className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer p-1"
                                  title="Confirm and move to Completed"
                                >
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCancel(transaction.id);
                                  }}
                                  className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer p-1"
                                  title="Cancel and deselect"
                                >
                                  <X className="h-5 w-5 text-red-600" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
