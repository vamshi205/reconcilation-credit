import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Label } from "../components/ui/Label";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { BankCSVParser } from "../services/bankCSVParser";
import { BankExcelParser } from "../services/bankExcelParser";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { PartyMappingService } from "../services/partyMappingService";
import { SupplierMappingService } from "../services/supplierMappingService";
import { saveTransactionsToSheets, isGoogleSheetsConfigured, getGoogleSheetsURL, testGoogleSheetsConnection } from "../services/googleSheetsService";
import { generateId, formatDate } from "../lib/utils";
import { Upload, FileText, CheckCircle, XCircle, Sparkles, Copy, ExternalLink } from "lucide-react";

// Storage key for tracking uploaded files
const UPLOADED_FILES_KEY = "uploaded_files_tracker";

interface UploadedFileInfo {
  name: string;
  size: number;
  lastModified: number;
  uploadedAt: string;
}

// Helper functions to manage uploaded files list
const getUploadedFiles = (): UploadedFileInfo[] => {
  try {
    const data = localStorage.getItem(UPLOADED_FILES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const addUploadedFile = (file: File): void => {
  try {
    const uploadedFiles = getUploadedFiles();
    const fileInfo: UploadedFileInfo = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      uploadedAt: new Date().toISOString(),
    };
    
    // Check if file already exists (by name + size + lastModified)
    const exists = uploadedFiles.some(
      (f) =>
        f.name === fileInfo.name &&
        f.size === fileInfo.size &&
        f.lastModified === fileInfo.lastModified
    );
    
    if (!exists) {
      uploadedFiles.push(fileInfo);
      // Keep only last 100 uploaded files to prevent localStorage bloat
      if (uploadedFiles.length > 100) {
        uploadedFiles.shift();
      }
      localStorage.setItem(UPLOADED_FILES_KEY, JSON.stringify(uploadedFiles));
    }
  } catch (error) {
    console.error("Error saving uploaded file info:", error);
  }
};

const isFileAlreadyUploaded = (file: File): boolean => {
  try {
    const uploadedFiles = getUploadedFiles();
    return uploadedFiles.some(
      (f) =>
        f.name === file.name &&
        f.size === file.size &&
        f.lastModified === file.lastModified
    );
  } catch {
    return false;
  }
};

export function CSVUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<Transaction[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [suggestionsCache, setSuggestionsCache] = useState<Record<string, string | null>>({});
  const [transactionType, setTransactionType] = useState<'credit' | 'debit' | 'both'>('credit');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authURL, setAuthURL] = useState<string>('');

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Check if file has already been uploaded
    if (isFileAlreadyUploaded(selectedFile)) {
      setError(
        `This file has already been uploaded before.\n\n` +
        `File: ${selectedFile.name}\n` +
        `Size: ${(selectedFile.size / 1024).toFixed(2)} KB\n\n` +
        `Please select a different file to avoid duplicate transactions.`
      );
      setFile(null);
      setParsedTransactions([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setFile(selectedFile);
    setError(null);
    setParsedTransactions([]);
    setSuggestionsCache({}); // Clear suggestions cache for new file
    setIsParsing(true);

    try {
      const fileName = selectedFile.name.toLowerCase();
      let transactions: Transaction[];

      if (fileName.endsWith(".csv")) {
        console.log("Parsing bank CSV file:", selectedFile.name, "Transaction type:", transactionType);
        transactions = await BankCSVParser.parseFile(selectedFile, transactionType);
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        console.log("Parsing bank Excel file:", selectedFile.name, "Transaction type:", transactionType);
        transactions = await BankExcelParser.parseFile(selectedFile, transactionType);
      } else {
        setError("Unsupported file format. Please use CSV or Excel files.");
        setIsParsing(false);
        return;
      }

      const typeLabel = transactionType === 'credit' ? 'credit' : transactionType === 'debit' ? 'debit' : 'credit and debit';
      console.log(`Parsed ${typeLabel} transactions:`, transactions.length);

      if (transactions.length === 0) {
        const typeMessage = transactionType === 'credit' 
          ? 'No credit transactions found. Only rows with Deposit Amt. > 0 are processed.'
          : transactionType === 'debit'
          ? 'No debit transactions found. Only rows with Withdrawal Amt. > 0 are processed.'
          : 'No transactions found. Please check that the file has valid credit or debit amounts.';
        setError(
          `${typeMessage} Please check:\n1. File has headers: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance\n2. ${transactionType === 'credit' ? 'Deposit' : transactionType === 'debit' ? 'Withdrawal' : 'Deposit or Withdrawal'} Amt. column contains values > 0\n3. Date format is DD/MM/YYYY or DD-MM-YYYY`
        );
      } else {
        setParsedTransactions(transactions);
      }
    } catch (err) {
      console.error("File parsing error:", err);
      setError(`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}. Please ensure the file matches the required format (CSV or Excel).`);
      setParsedTransactions([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplySuggestion = (index: number, originalName: string, suggestedName: string) => {
    // Learn the mapping
    PartyMappingService.learnMapping(originalName, suggestedName);

    // Update the transaction in the parsed list
    setParsedTransactions((prev) =>
      prev.map((t, i) => {
        if (i === index) {
          // Also learn from description if available
          if (t.description) {
            const cleanedDesc = t.description
              .replace(/REF\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/TXN\s*ID[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/UTR[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/CHQ\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/\b\d{10,}\b/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            
            if (cleanedDesc.length > 5) {
              PartyMappingService.learnMapping(cleanedDesc, suggestedName).catch(err => {
                console.error('Error learning party mapping:', err);
              });
            }
          }
          return { ...t, partyName: suggestedName };
        }
        return t;
      })
    );
  };

  const handleSave = async () => {
    if (parsedTransactions.length === 0) return;

    setIsSaving(true);
    try {
      const savedTransactions: Transaction[] = [];
      
      // Transactions are already in the correct format from parser
      // Apply mappings and prepare for Google Sheets
      for (const transaction of parsedTransactions) {
        // Use SupplierMappingService for debit transactions, PartyMappingService for credit
        const isDebit = transaction.type === 'debit';
        const mappingService = isDebit ? SupplierMappingService : PartyMappingService;
        
        // Apply any learned mappings before saving (async)
        const correctedName = await mappingService.applyMapping(transaction.partyName);
        const finalTransaction = {
          ...transaction,
          partyName: correctedName,
        };
        
        // NO LOCAL STORAGE - Transaction will be saved to Google Sheets only
        savedTransactions.push(finalTransaction);
        
        // Also train from narration if party name was applied from suggestion
        if (finalTransaction.description && correctedName && correctedName !== transaction.partyName) {
          if (isDebit) {
            // For debit transactions, train supplier mapping using learnMapping
            SupplierMappingService.learnMapping(transaction.partyName, correctedName).catch(err => {
              console.error('Error training supplier mapping:', err);
            });
          } else {
            // For credit transactions, train party mapping
            PartyMappingService.autoTrainFromNarration(finalTransaction.description, correctedName).catch(err => {
              console.error('Error training party mapping:', err);
            });
          }
        }
        
        // Update party/supplier balance (still uses local storage - can be migrated later)
        StorageService.updatePartyBalance(
          correctedName,
          finalTransaction.amount,
          finalTransaction.type
        );
      }

      // Write to Google Sheets if configured
      if (isGoogleSheetsConfigured()) {
        try {
          const result = await saveTransactionsToSheets(savedTransactions);
          if (result.failed > 0) {
            const sheetsURL = getGoogleSheetsURL();
            const message = `⚠️ IMPORT ISSUE\n\n` +
              `Parsed: ${parsedTransactions.length} transactions\n` +
              `Sent: ${result.success}\n` +
              `Failed: ${result.failed}\n\n` +
              `The script needs authorization to save transactions.\n\n` +
              `AUTHORIZATION URL:\n${sheetsURL}\n\n` +
              `Steps:\n` +
              `1. Copy the URL above (it's also shown in browser console)\n` +
              `2. Open it in a new tab\n` +
              `3. Sign in with your Google account\n` +
              `4. Click "Review Permissions" or "Allow"\n` +
              `5. Authorize the script\n` +
              `6. Try uploading again\n\n` +
              `After authorization, transactions will be saved automatically.`;
            
            console.error('❌ Authorization Required');
            console.error('📋 COPY THIS URL TO AUTHORIZE:');
            console.error(sheetsURL);
            console.error('\nSteps:');
            console.error('1. Copy the URL above');
            console.error('2. Open it in a new tab');
            console.error('3. Sign in and authorize');
            console.error('4. Try uploading again');
            
            // Show modal with URL for easy copying
            setAuthURL(sheetsURL);
            setShowAuthModal(true);
          } else {
            const creditCount = savedTransactions.filter(t => t.type === 'credit' || !t.type).length;
            const debitCount = savedTransactions.filter(t => t.type === 'debit').length;
            let message = `Successfully imported ${parsedTransactions.length} transactions!\n\n`;
            message += `✓ All transactions sent to database.\n`;
            if (creditCount > 0) {
              message += `- ${creditCount} credit transaction(s) saved to Transactions sheet\n`;
            }
            if (debitCount > 0) {
              message += `- ${debitCount} debit transaction(s) saved to DebitTransactions sheet\n`;
            }
            alert(message);
          }
        } catch (sheetsError) {
          console.error("Error saving to database:", sheetsError);
          const errorMessage = sheetsError instanceof Error ? sheetsError.message : String(sheetsError);
          const errorString = String(sheetsError);
          const sheetsURL = getGoogleSheetsURL();
          
          // Log detailed error for debugging
          console.error("Detailed error:", {
            error: sheetsError,
            message: errorMessage,
            errorString: errorString,
            transactionsCount: savedTransactions.length,
            creditCount: savedTransactions.filter(t => t.type === 'credit' || !t.type).length,
            debitCount: savedTransactions.filter(t => t.type === 'debit').length
          });
          
          // Check for authorization errors (more specific check)
          const isAuthError = errorString.toLowerCase().includes('authorization') || 
                             errorString.toLowerCase().includes('401') ||
                             errorString.toLowerCase().includes('unauthorized') ||
                             errorMessage.toLowerCase().includes('authorization') ||
                             errorMessage.toLowerCase().includes('401') ||
                             errorMessage.toLowerCase().includes('unauthorized');
          
          if (isAuthError) {
            console.error('❌ Authorization Required');
            console.error('📋 COPY THIS URL TO AUTHORIZE:');
            console.error(sheetsURL);
            console.error('\nSteps:');
            console.error('1. Copy the URL above');
            console.error('2. Open it in a new tab');
            console.error('3. Sign in and authorize');
            console.error('4. Try uploading again');
            
            // Show modal with URL for easy copying
            setAuthURL(sheetsURL);
            setShowAuthModal(true);
          } else {
            // Show actual error, not authorization error
            alert(
              `⚠️ Failed to Save to Database\n\n` +
              `Error: ${errorMessage}\n\n` +
              `Transactions were parsed but not saved.\n` +
              `Please check:\n` +
              `1. Browser console (F12) for detailed errors\n` +
              `2. Google Apps Script is deployed correctly\n` +
              `3. Sheet names are correct (Transactions, DebitTransactions)\n` +
              `4. Google Apps Script logs (Executions tab)\n\n` +
              `Error details are in the browser console.`
            );
          }
        }
      } else {
        alert(`Successfully imported ${parsedTransactions.length} transactions!`);
      }

      // Mark file as uploaded after successful save
      if (file) {
        addUploadedFile(file);
      }

      setFile(null);
      setParsedTransactions([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Navigate to the appropriate page based on transaction types
      const creditCount = savedTransactions.filter(t => t.type === 'credit' || !t.type).length;
      const debitCount = savedTransactions.filter(t => t.type === 'debit').length;
      
      if (debitCount > 0 && creditCount === 0) {
        // Only debit transactions - go to debit transactions page
        navigate("/debit-transactions");
      } else if (creditCount > 0 && debitCount === 0) {
        // Only credit transactions - go to credit transactions page
        navigate("/transactions");
      } else if (debitCount > creditCount) {
        // More debit transactions - go to debit transactions page
        navigate("/debit-transactions");
      } else {
        // More credit transactions or equal - go to credit transactions page
        navigate("/transactions");
      }
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

  const handleTestGoogleSheets = async () => {
    setIsTestingSheets(true);
    try {
      const result = await testGoogleSheetsConnection();
      if (result.success) {
        alert('✓ Database connection test successful!\n\nThe connection is working. You can now upload transactions.');
      } else {
        const sheetsURL = getGoogleSheetsURL();
        alert(`✗ Database connection failed:\n\n${result.error}\n\nPlease check:\n1. Script is deployed as Web App\n2. "Who has access" is set to "Anyone"\n3. Script is authorized\n\nIf you see authorization errors, open this URL:\n${sheetsURL}\n\nThen click "Review Permissions" or "Allow" to authorize the script.`);
      }
    } catch (error) {
      alert(`✗ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingSheets(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-gradient">
            Bank Statement Upload
          </h1>
          <p className="text-muted-foreground mt-2">Bulk import transactions from CSV or Excel files</p>
        </div>
        {isGoogleSheetsConfigured() && (
          <Button
            variant="outline"
            onClick={handleTestGoogleSheets}
            disabled={isTestingSheets}
            className="text-sm"
          >
            {isTestingSheets ? "Testing..." : "Test Connection"}
          </Button>
        )}
      </div>

      <Card className="glass-card border-2 border-border/60 animate-fade-in">
        <CardHeader className="bg-muted/30 border-b border-border/60">
          <CardTitle>Upload Bank Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <Label htmlFor="transaction-type" className="mb-2 block">
                Transaction Type
              </Label>
              <Select
                id="transaction-type"
                value={transactionType}
                onChange={(e) => {
                  setTransactionType(e.target.value as 'credit' | 'debit' | 'both');
                  setFile(null);
                  setParsedTransactions([]);
                  setError(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                disabled={isParsing}
                className="w-full"
              >
                <option value="credit">Credit Transactions Only</option>
                <option value="debit">Debit Transactions Only</option>
                <option value="both">Both Credit & Debit</option>
              </Select>
            </div>
          </div>

          <div className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center hover:border-primary/40 transition-colors">
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
              className="btn-gradient"
            >
              {isParsing ? "Parsing..." : "Select File (CSV/Excel)"}
            </Button>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg border border-border/60">
            <p className="text-xs font-semibold mb-2">Required File Format:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Supported formats: CSV (.csv), Excel (.xls, .xlsx)</li>
              <li>Headers: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance</li>
              <li>Select transaction type above to filter: Credit, Debit, or Both</li>
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
                ⏳ Parsing file... Please wait.
              </p>
            </div>
          )}

          {!isParsing && file && parsedTransactions.length === 0 && !error && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ File uploaded but no transactions were found. Please check the file format.
              </p>
            </div>
          )}

          {parsedTransactions.length > 0 && (
            <>
              <div className="flex items-center justify-between p-4 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-sm font-semibold text-success">
                  ✅ Found {parsedTransactions.length} transactions
                </p>
                <Button onClick={handleSave} disabled={isSaving} className="btn-gradient">
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
                      {parsedTransactions.slice(0, 50).map((t, idx) => {
                        // Use cached suggestion if available, otherwise load asynchronously
                        const suggestionKey = `${idx}-${t.description?.substring(0, 50)}`;
                        const suggested = suggestionsCache[suggestionKey] || null;
                        
                        // Load suggestion asynchronously if not already cached
                        if (t.description && !suggestionsCache[suggestionKey]) {
                          (async () => {
                            const desc = t.description.trim();
                            let foundSuggestion: string | null = null;
                            
                            // Method 1: Extract text between colons
                            const colonPattern = desc.match(/:\s*([A-Z][A-Z\s\w]+?)\s*:/i);
                            if (colonPattern && colonPattern[1]) {
                              const extracted = colonPattern[1].trim().toLowerCase();
                              if (extracted.length > 3 && extracted.length < 100) {
                                foundSuggestion = await PartyMappingService.getSuggestedName(extracted);
                              }
                            }
                            
                            // Method 2: Extract from patterns
                            if (!foundSuggestion) {
                              const patterns = [
                                /(?:NEFT|IMPS|RTGS|UPI|FT)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z]{4,}|[A-Z]{2}\d{10,}|\d{10,})/i,
                                /(?:NEFT|IMPS|RTGS|UPI|FT|CHQ)\s*(?:CR|DR)?[\s\-]+\d+[\s\-]+([A-Z][A-Z\s\w]+?)(?:\s*-\s*\d+|\s*$)/i,
                                /(?:UPI|NEFT|IMPS)[\s\-]+[\d\-@]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z0-9@]+|\d+)/i,
                              ];
                              
                              for (const pattern of patterns) {
                                const match = desc.match(pattern);
                                if (match && match[1]) {
                                  const extracted = match[1].trim().toLowerCase();
                                  if (extracted.length > 3 && extracted.length < 100) {
                                    foundSuggestion = await PartyMappingService.getSuggestedName(extracted);
                                    if (foundSuggestion) break;
                                  }
                                }
                              }
                            }
                            
                            // Method 3: Extract from parts
                            if (!foundSuggestion) {
                              const parts = desc
                                .split(/[\s\-:]+/)
                                .filter(p => p.length > 2)
                                .filter(p => !/^\d+$/.test(p))
                                .filter(p => !/^[A-Z]{2,4}\d+$/.test(p))
                                .filter(p => !/^[A-Z]{2,4}N\d+$/.test(p))
                                .filter(p => !/^\d{10,}$/.test(p))
                                .filter(p => !/^[A-Z0-9@]+$/.test(p) && p.length > 5)
                                .filter(p => !/^(NEFT|IMPS|RTGS|UPI|FT|CHQ|CR|DR|DEP|HYDERABAD|CTS|CLG|WBO|HYD|TPT|SRR)$/i.test(p));
                              
                              for (let i = 0; i < parts.length && !foundSuggestion; i++) {
                                for (let len = 1; len <= 6 && i + len <= parts.length; len++) {
                                  const phrase = parts.slice(i, i + len).join(" ").toLowerCase();
                                  if (phrase.length > 3 && phrase.length < 100) {
                                    foundSuggestion = await PartyMappingService.getSuggestedName(phrase);
                                    if (foundSuggestion) break;
                                  }
                                }
                                if (foundSuggestion) break;
                              }
                            }
                            
                            // Method 4: Try cleaned description
                            if (!foundSuggestion) {
                              const cleanedDesc = desc
                                .replace(/REF\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
                                .replace(/TXN\s*ID[:\-]?\s*[A-Z0-9]+/gi, " ")
                                .replace(/UTR[:\-]?\s*[A-Z0-9]+/gi, " ")
                                .replace(/CHQ\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
                                .replace(/\b[A-Z]{2,4}\d{6,}\b/gi, " ")
                                .replace(/\b[A-Z]{2,4}N\d{10,}\b/gi, " ")
                                .replace(/\b\d{10,}\b/g, " ")
                                .replace(/X{6,}/gi, " ")
                                .replace(/@[A-Z0-9]+/gi, " ")
                                .replace(/\s+/g, " ")
                                .trim()
                                .toLowerCase();
                              
                              if (cleanedDesc.length > 5) {
                                foundSuggestion = await PartyMappingService.getSuggestedName(cleanedDesc);
                              }
                            }
                            
                            // Update cache if suggestion found
                            if (foundSuggestion) {
                              setSuggestionsCache(prev => ({ ...prev, [suggestionKey]: foundSuggestion }));
                            }
                          })();
                        }
                        return (
                          <tr key={idx} className="border-t">
                            <td className="p-2 whitespace-nowrap">{formatDate(t.date)}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                t.type === 'credit' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {t.type === 'credit' ? 'Credit' : 'Debit'}
                              </span>
                            </td>
                            <td className="p-2 font-medium">₹{t.amount.toLocaleString()}</td>
                            <td className="p-2">{t.description}</td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                {t.partyName ? (
                                  <>
                                    <span>{t.partyName}</span>
                                    {suggested && suggested !== t.partyName && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const key = t.description
                                            ?.replace(/REF\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/TXN\s*ID[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/UTR[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/CHQ\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/\b\d{10,}\b/g, " ")
                                            .replace(/\s+/g, " ")
                                            .trim()
                                            .toLowerCase() || "";
                                          handleApplySuggestion(idx, key, suggested);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                        title={`Suggested: ${suggested}`}
                                      >
                                        <Sparkles className="h-3 w-3" />
                                        → {suggested}
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground italic text-xs">(Empty)</span>
                                    {suggested && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const key = t.description
                                            ?.replace(/REF\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/TXN\s*ID[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/UTR[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/CHQ\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
                                            .replace(/\b\d{10,}\b/g, " ")
                                            .replace(/\s+/g, " ")
                                            .trim()
                                            .toLowerCase() || "";
                                          handleApplySuggestion(idx, key, suggested);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                        title={`Suggested: ${suggested}`}
                                      >
                                        <Sparkles className="h-3 w-3" />
                                        → {suggested}
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">{t.category}</td>
                            <td className="p-2 text-xs text-muted-foreground">{t.referenceNumber || "-"}</td>
                          </tr>
                        );
                      })}
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

      {/* Authorization URL Modal */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Authorization Required"
      >
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-muted-foreground">
            The database script needs authorization. Copy the URL below and authorize it.
          </p>
          
          <div className="space-y-1.5">
            <Label htmlFor="auth-url" className="text-xs font-medium">Authorization URL:</Label>
            <div className="flex gap-1.5">
              <Input
                id="auth-url"
                value={authURL}
                readOnly
                className="font-mono text-xs h-8"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(authURL);
                  alert('URL copied!');
                }}
                title="Copy URL"
                className="h-8 px-2"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(authURL, '_blank');
                }}
                title="Open URL"
                className="h-8 px-2"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-1.5">Steps:</p>
            <ol className="text-xs text-blue-800 space-y-0.5 list-decimal list-inside">
              <li>Copy the URL (or click copy button)</li>
              <li>Open it in a new tab</li>
              <li>Sign in and authorize</li>
              <li>Try uploading again</li>
            </ol>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(authURL, '_blank');
                setShowAuthModal(false);
              }}
              className="text-xs h-8"
            >
              Open URL
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAuthModal(false)}
              className="btn-gradient text-xs h-8"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

