import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { BankCSVParser } from "../services/bankCSVParser";
import { BankExcelParser } from "../services/bankExcelParser";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { PartyMappingService } from "../services/partyMappingService";
import { saveTransactionsToSheets, isGoogleSheetsConfigured, getGoogleSheetsURL, testGoogleSheetsConnection } from "../services/googleSheetsService";
import { generateId, formatDate } from "../lib/utils";
import { Upload, FileText, CheckCircle, XCircle, Sparkles } from "lucide-react";

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
        // Apply any learned mappings before saving (async)
        const correctedName = await PartyMappingService.applyMapping(transaction.partyName);
        const finalTransaction = {
          ...transaction,
          partyName: correctedName,
        };
        
        // NO LOCAL STORAGE - Transaction will be saved to Google Sheets only
        savedTransactions.push(finalTransaction);
        
        // Also train from narration if party name was applied from suggestion
        if (finalTransaction.description && correctedName && correctedName !== transaction.partyName) {
          PartyMappingService.autoTrainFromNarration(finalTransaction.description, correctedName).catch(err => {
            console.error('Error training party mapping:', err);
          });
        }
        
        // Update party balance (still uses local storage for parties - can be migrated later)
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
            alert(
              `Successfully imported ${parsedTransactions.length} transactions!\n\n` +
              `⚠️ Google Sheets: ${result.success} sent, ${result.failed} failed.\n\n` +
              `If you see 401 errors in the console, the script needs authorization:\n` +
              `1. Open: ${sheetsURL}\n` +
              `2. Sign in and authorize the script\n` +
              `3. Check your Google Sheet to verify data was saved`
            );
          } else {
            alert(
              `Successfully imported ${parsedTransactions.length} deposit transactions!\n\n` +
              `✓ All transactions sent to Google Sheets.\n` +
              `Note: If you see 401 errors, please authorize the script first.`
            );
          }
        } catch (sheetsError) {
          console.error("Error saving to Google Sheets:", sheetsError);
          const errorMessage = sheetsError instanceof Error ? sheetsError.message : 'Unknown error';
          const sheetsURL = getGoogleSheetsURL();
          
          if (errorMessage.includes('authorization') || errorMessage.includes('401')) {
            alert(
              `Successfully imported ${parsedTransactions.length} deposit transactions!\n\n` +
              `⚠️ Google Sheets Error: Script requires authorization (401 error).\n\n` +
              `Please:\n` +
              `1. Open this URL in your browser:\n${sheetsURL}\n` +
              `2. Sign in with your Google account\n` +
              `3. Click "Review Permissions" or "Allow"\n` +
              `4. Authorize the script\n` +
              `5. Try uploading again\n\n` +
              `After authorization, transactions will be saved automatically.`
            );
          } else {
            alert(
              `Successfully imported ${parsedTransactions.length} deposit transactions!\n\n` +
              `⚠️ Warning: Failed to save to Google Sheets.\n` +
              `Error: ${errorMessage}\n\n` +
              `Please check the browser console for details.`
            );
          }
        }
      } else {
        alert(`Successfully imported ${parsedTransactions.length} deposit transactions!`);
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

  const handleTestGoogleSheets = async () => {
    setIsTestingSheets(true);
    try {
      const result = await testGoogleSheetsConnection();
      if (result.success) {
        alert('✓ Database connection test successful!');
      } else {
        alert(`✗ Database connection failed:\n\n${result.error}\n\nPlease check:\n1. Script is deployed as Web App\n2. "Who has access" is set to "Anyone"\n3. Script is authorized`);
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
                              <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                Deposit
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
    </div>
  );
}

