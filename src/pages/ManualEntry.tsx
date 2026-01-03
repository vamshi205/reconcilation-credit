import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Select } from "../components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { StorageService } from "../services/storageService";
import { Transaction, TransactionType, TransactionCategory } from "../types/transaction";
import { generateId } from "../lib/utils";
import { Save } from "lucide-react";

const categories: Record<TransactionType, TransactionCategory[]> = {
  credit: [
    "Credit Sale",
    "Payment Received",
    "Refund",
    "Loan/Credit",
    "Interest Income",
    "Other Credit",
  ],
  debit: ["Purchase", "Payment Made", "Expense", "Other Debit"],
};

interface FormData {
  date: string;
  amount: string;
  description: string;
  type: TransactionType;
  category: TransactionCategory;
  partyName: string;
  referenceNumber: string;
  notes: string;
}

export function ManualEntry() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      type: "credit",
      category: "Credit Sale",
    },
  });

  const selectedType = watch("type");

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const transaction: Transaction = {
        id: generateId(),
        date: data.date,
        amount: parseFloat(data.amount),
        description: data.description,
        type: data.type,
        category: data.category,
        partyName: data.partyName || "Unknown",
        referenceNumber: data.referenceNumber || undefined,
        notes: data.notes || undefined,
        added_to_vyapar: false,
        vyapar_reference_number: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // NO LOCAL STORAGE - Save directly to Google Sheets
      StorageService.addTransaction(transaction);
      
      // Save to Google Sheets if configured
      if (isGoogleSheetsConfigured()) {
        try {
          await saveTransactionToSheets(transaction);
        } catch (error) {
          console.error('Error saving to Google Sheets:', error);
        }
      }
      
      StorageService.updatePartyBalance(
        transaction.partyName,
        transaction.amount,
        transaction.type
      );

      reset();
      alert("Transaction added successfully!");
      navigate("/transactions");
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Failed to add transaction. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-display font-bold text-gradient">
          Manual Entry
        </h1>
        <p className="text-muted-foreground mt-2">Add a new transaction manually</p>
      </div>

      <Card className="glass-card border-2 border-border/60 animate-fade-in">
        <CardHeader className="bg-muted/30 border-b border-border/60">
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date", { required: "Date is required" })}
                  className="input-modern"
                />
                {errors.date && (
                  <p className="text-sm text-destructive mt-1">{errors.date.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="type">Type *</Label>
                <Select id="type" {...register("type", { required: true })}>
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("amount", {
                    required: "Amount is required",
                    min: { value: 0.01, message: "Amount must be greater than 0" },
                  })}
                  className="input-modern"
                />
                {errors.amount && (
                  <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select id="category" {...register("category", { required: true })}>
                  {categories[selectedType].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  placeholder="Transaction description or narration"
                  {...register("description", { required: "Description is required" })}
                  className="input-modern"
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="partyName">Party Name</Label>
                <Input
                  id="partyName"
                  placeholder="Customer or supplier name"
                  {...register("partyName")}
                  className="input-modern"
                />
              </div>

              <div>
                <Label htmlFor="referenceNumber">Reference Number</Label>
                <Input
                  id="referenceNumber"
                  placeholder="Cheque no, UPI ref, etc."
                  {...register("referenceNumber")}
                  className="input-modern"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Additional notes (optional)"
                  {...register("notes")}
                  className="input-modern"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting} className="btn-gradient">
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Saving..." : "Save Transaction"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => reset()}
                disabled={isSubmitting}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

