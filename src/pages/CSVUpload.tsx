import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { BankCSVParser } from "../services/bankCSVParser";
import { BankExcelParser } from "../services/bankExcelParser";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { Transaction } from "../types/transaction";
import { generateId, formatDate } from "../lib/utils";
import { Upload, FileText, CheckCircle, XCircle } from "lucide-react";

export function CSVUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<Transaction[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    if (
      !fileName.endsWith(".csv") &&
      !fileName.endsWith(".xlsx") &&
      !fileName.endsWith(".xls")
    ) {
      setError("Please select a CSV or Excel file (.csv, .xls, .xlsx)");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setParsedTransactions([]);
    setIsParsing(true);

    try {
      const fileName = selectedFile.name.toLowerCase();
      let transactions: Transaction[];

      if (fileName.endsWith(".csv")) {
        console.log("Parsing bank CSV file:", selectedFile.name);
        transactions = await BankCSVParser.parseFile(selectedFile);
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        console.log("Parsing bank Excel file:", selectedFile.name);
        transactions = await BankExcelParser.parseFile(selectedFile);
      } else {
        setError("Unsupported file format. Please use CSV or Excel files.");
        setIsParsing(false);
        return;
      }

      console.log("Parsed deposit transactions:", transactions.length);

      if (transactions.length === 0) {
        setError(
          "No deposit transactions found. Only rows with Deposit Amt. > 0 are processed. Please check:\n1. File has headers: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance\n2. Deposit Amt. column contains values > 0\n3. Date format is DD/MM/YYYY or DD-MM-YYYY"
        );
      } else {
        setParsedTransactions(transactions);
      }
    } catch (err) {
      console.error("CSV parsing error:", err);
      setError(`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}. Please ensure the CSV file matches the required format.`);
      setParsedTransactions([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = () => {
    if (parsedTransactions.length === 0) return;

    setIsSaving(true);
    try {
      // Transactions are already in the correct format from parser
      parsedTransactions.forEach((transaction) => {
        StorageService.addTransaction(transaction);
        StorageService.updatePartyBalance(
          transaction.partyName,
          transaction.amount,
          transaction.type
        );
      });

      alert(`Successfully imported ${parsedTransactions.length} deposit transactions!`);
      setFile(null);
      setParsedTransactions([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      navigate("/transactions");
    } catch (err) {
      console.error("Error saving transactions:", err);
      alert("Failed to save transactions. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedTransactions([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CSV Upload</h1>
        <p className="text-muted-foreground mt-1">Bulk import transactions from bank statement</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-input rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Upload your bank statement file (CSV, XLS, or XLSX)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
            >
              {isParsing ? "Parsing..." : "Select File (CSV/Excel)"}
            </Button>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-xs font-medium mb-2">Required File Format:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Supported formats: CSV (.csv), Excel (.xls, .xlsx)</li>
              <li>Headers: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance</li>
              <li>Only rows with Deposit Amt. &gt; 0 will be processed</li>
              <li>Date format: DD/MM/YYYY or DD-MM-YYYY</li>
              <li>Amount columns should be numeric (no currency symbols)</li>
            </ul>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {file && (
            <div className="flex items-center gap-2 p-4 bg-accent rounded-lg">
              <FileText className="h-5 w-5" />
              <span className="flex-1">{file.name}</span>
              {isParsing && (
                <span className="text-sm text-muted-foreground">Parsing...</span>
              )}
              <Button variant="ghost" size="sm" onClick={handleRemoveFile} disabled={isParsing}>
                Remove
              </Button>
            </div>
          )}

          {isParsing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ⏳ Parsing CSV file... Please wait.
              </p>
            </div>
          )}

          {!isParsing && file && parsedTransactions.length === 0 && !error && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ File uploaded but no transactions were found. Please check the CSV format.
              </p>
            </div>
          )}

          {parsedTransactions.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  ✅ Found {parsedTransactions.length} transactions
                </p>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : `Save ${parsedTransactions.length} Transactions`}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Amount</th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-left">Party</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-left">Ref No.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTransactions.slice(0, 50).map((t, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{formatDate(t.date)}</td>
                          <td className="p-2">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              Deposit
                            </span>
                          </td>
                          <td className="p-2 font-medium">₹{t.amount.toLocaleString()}</td>
                          <td className="p-2">{t.description}</td>
                          <td className="p-2">{t.partyName}</td>
                          <td className="p-2 text-xs text-muted-foreground">{t.category}</td>
                          <td className="p-2 text-xs text-muted-foreground">{t.referenceNumber || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedTransactions.length > 50 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Showing first 50 of {parsedTransactions.length} transactions
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

