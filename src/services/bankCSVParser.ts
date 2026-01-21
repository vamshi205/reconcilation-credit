import Papa from "papaparse";
import { Transaction } from "../types/transaction";
import { generateId } from "../lib/utils";
import { getBankConfig, BankConfig } from "./bankConfig";

export interface BankCSVRow {
  Date?: string;
  "Transaction Date"?: string;
  Narration?: string;
  "Chq./Ref.No."?: string;
  "Chq/Ref.No."?: string;
  "Value Dt"?: string;
  "Value Date"?: string;
  "Withdrawal Amt."?: string;
  "Withdrawal Amt"?: string;
  "Deposit Amt."?: string;
  "Deposit Amt"?: string;
  "Closing Balance"?: string;
}

export class BankCSVParser {
  /**
   * Parse bank CSV with specific format:
   * Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
   * @param file - The CSV file to parse
   * @param transactionType - 'credit', 'debit', or 'both' to filter transactions
   * @param bankName - Bank name (e.g., 'HDFC', 'Canara') to use appropriate column mappings
   */
  static parseFile(file: File, transactionType: 'credit' | 'debit' | 'both' = 'credit', bankName: string = 'HDFC'): Promise<Transaction[]> {
    return new Promise((resolve, reject) => {
      // Get bank configuration
      const bankConfig = getBankConfig(bankName);
      if (!bankConfig) {
        reject(new Error(`Unknown bank: ${bankName}. Supported banks: HDFC, Canara`));
        return;
      }

      // First, read the file as text to find the header row
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error("Failed to read file"));
          return;
        }

        // Find the header row using bank-specific patterns
        const lines = text.split("\n");
        let headerRowIndex = -1;
        let headerRow = "";
        
        const maxSearchRows = bankConfig.maxHeaderSearchRows || 50;
        
        // If bank has a header row hint, check that row first
        if (bankConfig.headerRowHint !== undefined && bankConfig.headerRowHint < lines.length) {
          const hintIndex = bankConfig.headerRowHint;
          const hintLine = lines[hintIndex].toLowerCase();
          const hintColumns = hintLine.split(",");
          
          if (hintColumns.length >= 3) {
            const hasDate = bankConfig.dateColumns.some(col => hintLine.includes(col.toLowerCase()));
            const hasNarration = bankConfig.narrationColumns.some(col => hintLine.includes(col.toLowerCase()));
            const hasAmount = bankConfig.depositColumns.some(col => hintLine.includes(col.toLowerCase())) ||
                             bankConfig.withdrawalColumns.some(col => hintLine.includes(col.toLowerCase())) ||
                             hintLine.includes("amount");
            
            if (hasDate && hasNarration && hasAmount) {
              // Verify next line looks like data
              if (hintIndex + 1 < lines.length) {
                const nextLine = lines[hintIndex + 1].toLowerCase();
                if (!nextLine.includes("date") && !bankConfig.skipPatterns.some(p => p.test(nextLine))) {
                  headerRowIndex = hintIndex;
                  headerRow = lines[hintIndex];
                  console.log(`Found header at hint row ${hintIndex + 1} (line ${hintIndex + 1}) for ${bankConfig.name}`);
                }
              } else {
                headerRowIndex = hintIndex;
                headerRow = lines[hintIndex];
                console.log(`Found header at hint row ${hintIndex + 1} (line ${hintIndex + 1}) for ${bankConfig.name}`);
              }
            }
          }
        }

        // If not found at hint, search from beginning
        if (headerRowIndex === -1) {
          for (let i = 0; i < Math.min(maxSearchRows, lines.length); i++) {
            const line = lines[i].toLowerCase();
            
            // Skip metadata rows using bank-specific skip patterns
            const shouldSkip = bankConfig.skipPatterns.some(pattern => pattern.test(line));
            if (shouldSkip) {
              continue;
            }
            
            // Check if line has multiple columns (split by comma)
            const columns = line.split(",");
            if (columns.length < 3) continue; // Headers should have multiple columns
            
            // Look for actual header row using bank-specific column names
            const hasDate = bankConfig.dateColumns.some(col => line.includes(col.toLowerCase()));
            const hasNarration = bankConfig.narrationColumns.some(col => line.includes(col.toLowerCase()));
            const hasAmount = bankConfig.depositColumns.some(col => line.includes(col.toLowerCase())) ||
                             bankConfig.withdrawalColumns.some(col => line.includes(col.toLowerCase())) ||
                             line.includes("amount");
            
            if (hasDate && hasNarration && hasAmount) {
              // Verify next line looks like data, not another header
              if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].toLowerCase();
                if (!nextLine.includes("date") && !bankConfig.skipPatterns.some(p => p.test(nextLine))) {
                  headerRowIndex = i;
                  headerRow = lines[i];
                  console.log(`Found header at row ${i + 1} (line ${i + 1}) for ${bankConfig.name}`);
                  break;
                }
              } else {
                headerRowIndex = i;
                headerRow = lines[i];
                console.log(`Found header at row ${i + 1} (line ${i + 1}) for ${bankConfig.name}`);
                break;
              }
            }
          }
        }

        if (headerRowIndex === -1) {
          // Try a more lenient search
          for (let i = 0; i < Math.min(maxSearchRows, lines.length); i++) {
            const line = lines[i].toLowerCase();
            const columns = line.split(",");
            if (columns.length >= 5) {
              if (line.includes("date") || line.includes("narration") || line.includes("amount")) {
                headerRowIndex = i;
                headerRow = lines[i];
                console.log(`Found header at row ${i + 1} (line ${i + 1}) using lenient search for ${bankConfig.name}`);
                break;
              }
            }
          }
        }

        if (headerRowIndex === -1) {
          reject(
            new Error(
              "Could not find header row with Date, Narration, and Deposit/Withdrawal Amt. columns. Please ensure your file has proper column headers."
            )
          );
          return;
        }

        console.log("Found header row at line:", headerRowIndex + 1);
        console.log("Header row:", headerRow);

        // Create a new CSV starting from the header row
        const dataLines = lines.slice(headerRowIndex);
        const csvContent = dataLines.join("\n");

        // Parse the CSV content
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          transform: (value) => (value ? value.trim() : ""),
          complete: (results) => {
            try {
              console.log("PapaParse complete. Rows:", results.data.length);
              console.log("CSV Headers:", results.meta.fields);

              if (results.errors && results.errors.length > 0) {
                console.warn("CSV parsing errors:", results.errors);
              }

              if (!results.data || results.data.length === 0) {
                reject(new Error("CSV file appears to be empty or has no data rows"));
                return;
              }

              // Filter out separator rows, opening balance, and statement summary rows
              const validRows = (results.data as any[]).filter((row) => {
                const values = Object.values(row);
                const rowString = values.map(v => String(v || "").toLowerCase()).join(" ");
                
                // Check if row contains opening balance or statement summary keywords
                const isSummaryRow = rowString.includes("opening balance") || 
                                    rowString.includes("closing balance") ||
                                    rowString.includes("statement summary") ||
                                    rowString.includes("debits") && rowString.includes("credits");
                
                if (isSummaryRow) {
                  return false; // Skip summary rows
                }
                
                // Check if row has meaningful data (not just separators)
                const hasData = values.some(
                  (v) => {
                    const str = String(v || "").trim();
                    return (
                      str !== "" &&
                      !str.match(/^[*\-]+$/) && // Not just asterisks or dashes
                      !str.match(/^[*\s\-]+$/) // Not just asterisks, spaces, or dashes
                    );
                  }
                );
                return hasData;
              });

              console.log(
                `Filtered ${validRows.length} valid rows from ${results.data.length} total rows`
              );

              if (validRows.length === 0) {
                reject(new Error("No valid data rows found after filtering separator rows"));
                return;
              }

              const transactions = this.parseRows(validRows as BankCSVRow[], transactionType, bankConfig);

              if (transactions.length === 0) {
                // Provide more helpful error message with bank-specific info
                const sampleRow = validRows[0] as any;
                const availableColumns = sampleRow
                  ? Object.keys(sampleRow).join(", ")
                  : "none";
                console.log("Sample row:", sampleRow);
                
                // Get bank-specific column names for error message
                const depositColName = bankConfig.depositColumns[0] || "Deposit/Credit";
                const withdrawalColName = bankConfig.withdrawalColumns[0] || "Withdrawal/Debit";
                
                const typeMessage = transactionType === 'credit' 
                  ? `${depositColName}`
                  : transactionType === 'debit'
                  ? `${withdrawalColName}`
                  : `${depositColName} or ${withdrawalColName}`;
                
                reject(
                  new Error(
                    `No ${transactionType === 'credit' ? 'credit' : transactionType === 'debit' ? 'debit' : ''} transactions found. Only rows with ${typeMessage} > 0 are processed.\n\n` +
                    `Found columns: ${availableColumns}\n` +
                    `Sample row values: ${JSON.stringify(sampleRow)}\n` +
                    `Please check that the ${typeMessage} column has values > 0.\n` +
                    `Bank: ${bankConfig.name}`
                  )
                );
                return;
              }

              console.log(
                "Successfully parsed deposit transactions:",
                transactions.length
              );
              resolve(transactions);
            } catch (error) {
              console.error("Error processing parsed data:", error);
              reject(error);
            }
          },
          error: (error) => {
            console.error("PapaParse error:", error);
            reject(
              new Error(`Failed to parse CSV: ${error.message || "Unknown error"}`)
            );
          },
        });
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsText(file);
    });
  }

  static parseRows(rows: BankCSVRow[], transactionType: 'credit' | 'debit' | 'both' = 'credit', bankConfig: BankConfig): Transaction[] {
    const transactions: Transaction[] = [];

    // Debug: Log first row to see structure
    if (rows.length > 0) {
      console.log("First row sample:", rows[0]);
      console.log("Available columns:", Object.keys(rows[0]));
    }

    rows.forEach((row, index) => {
      try {
        const transaction = this.parseRow(row, index, transactionType, bankConfig);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Failed to parse row ${index + 1}:`, row, error);
      }
    });

    console.log(`Parsed ${transactions.length} transactions from ${rows.length} rows (filter: ${transactionType})`);
    return transactions;
  }

  static parseRow(row: BankCSVRow, index: number, transactionType: 'credit' | 'debit' | 'both' = 'credit', bankConfig: BankConfig): Transaction | null {
    // Use flexible column matching (case-insensitive, handles variations)
    const rowKeys = Object.keys(row);
    const rowLower = Object.fromEntries(
      rowKeys.map((k) => [k.toLowerCase().trim(), row[k]])
    );
    
    // Debug: Log first few rows structure
    if (index < 3) {
      console.log(`\n=== Parsing Row ${index + 1} ===`);
      console.log(`Row keys:`, rowKeys);
      console.log(`Row values:`, Object.fromEntries(rowKeys.map(k => [k, row[k]])));
      console.log(`Looking for deposit columns:`, bankConfig.depositColumns);
      console.log(`Looking for withdrawal columns:`, bankConfig.withdrawalColumns);
    }

    // Find narration column using bank config
    let narration = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      const matchesNarration = bankConfig.narrationColumns.some(col => keyLower.includes(col.toLowerCase()));
      if (matchesNarration) {
        narration = String(row[key] || "").trim();
        break;
      }
    }
    if (!narration) {
      // Fallback: try common narration columns
      narration = String(rowLower["narration"] || rowLower["description"] || "").trim();
    }

    // Filter out rows with empty narration (like opening balance rows)
    if (!narration || narration.trim() === '' || narration === 'undefined' || narration === 'null') {
      console.log(`Skipping row ${index + 1}: Empty narration (likely opening balance or summary row)`);
      return null;
    }

    // Filter out summary/total rows
    const narrationLower = narration.toLowerCase();
    const summaryKeywords = [
      "total", "summary", "grand total", "opening balance", 
      "closing balance", "balance", "total deposit", "total withdrawal",
      "total credit", "total debit", "net balance", "balance brought forward",
      "balance carried forward", "opening", "closing", "statement summary"
    ];
    
    const isSummaryRow = summaryKeywords.some(keyword => 
      narrationLower.includes(keyword) && narrationLower.length < 50 // Short descriptions are likely summary rows
    );
    
    if (isSummaryRow) {
      console.log(`Skipping summary row ${index + 1}: "${narration}"`);
      return null;
    }

    // Find date column using bank config
    let dateStr = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      const matchesDate = bankConfig.dateColumns.some(col => {
        const colLower = col.toLowerCase();
        return keyLower.includes(colLower) && !keyLower.includes("value") && !keyLower.includes("closing");
      });
      if (matchesDate) {
        dateStr = String(row[key] || "");
        break;
      }
    }
    if (!dateStr) {
      // Fallback: try common date columns
      for (const dateCol of bankConfig.dateColumns) {
        const colLower = dateCol.toLowerCase();
        if (rowLower[colLower]) {
          dateStr = String(rowLower[colLower]);
          break;
        }
      }
      if (!dateStr) {
        dateStr = String(
          rowLower["date"] ||
          rowLower["transaction date"] ||
          ""
        );
      }
    }

    if (!dateStr || dateStr === "undefined" || dateStr === "null" || dateStr.trim() === "") {
      if (index < 3) {
        // Only log first few rows to avoid spam
        console.warn(`Row ${index + 1}: No date found. Available columns:`, rowKeys);
      }
      return null;
    }

    // Parse date
    const date = this.parseDate(dateStr);
    if (!date) {
      if (index < 3) {
        console.warn(`Row ${index + 1}: Invalid date format: ${dateStr}`);
      }
      return null;
    }

    // Find deposit/credit amount column using bank config
    let depositAmtStr = "";
    let depositColumnFound = false;
    
    // First, try to find exact column name match
    for (const depositCol of bankConfig.depositColumns) {
      const colLower = depositCol.toLowerCase().trim();
      // Try exact key match first (case-insensitive)
      const exactKey = rowKeys.find(k => k.toLowerCase().trim() === colLower);
      if (exactKey) {
        const value = row[exactKey];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          depositAmtStr = String(value).trim();
          depositColumnFound = true;
          if (index < 3) {
            console.log(`✓ Found deposit column "${exactKey}" (exact match) with value: "${depositAmtStr}"`);
          }
          break;
        }
      }
    }
    
    // If not found, try contains match
    if (!depositColumnFound) {
      for (const key of rowKeys) {
        const keyLower = key.toLowerCase().trim();
        const matchesDeposit = bankConfig.depositColumns.some(col => {
          const colLower = col.toLowerCase().trim();
          // Try exact match first, then contains match
          return keyLower === colLower || keyLower.includes(colLower);
        });
        if (matchesDeposit) {
          const value = row[key];
          if (value !== undefined && value !== null && String(value).trim() !== "") {
            depositAmtStr = String(value).trim();
            depositColumnFound = true;
            if (index < 3) {
              console.log(`✓ Found deposit column "${key}" (contains match) with value: "${depositAmtStr}"`);
            }
            break;
          }
        }
      }
    }
    
    // Fallback: try lowercase lookup in rowLower
    if (!depositColumnFound) {
      for (const depositCol of bankConfig.depositColumns) {
        const colLower = depositCol.toLowerCase().trim();
        if (rowLower[colLower]) {
          const value = String(rowLower[colLower]).trim();
          if (value !== "" && value !== "undefined" && value !== "null") {
            depositAmtStr = value;
            depositColumnFound = true;
            if (index < 3) {
              console.log(`✓ Found deposit column "${colLower}" (lowercase fallback) with value: "${depositAmtStr}"`);
            }
            break;
          }
        }
      }
    }
    
    if (!depositColumnFound || depositAmtStr === "") {
      depositAmtStr = "0";
      if (index < 3) {
        console.log(`✗ No deposit column found. Available columns: ${rowKeys.join(", ")}`);
      }
    }

    const depositAmount = this.parseAmount(depositAmtStr);

    // Find withdrawal/debit amount column using bank config
    let withdrawalAmtStr = "";
    let withdrawalColumnFound = false;
    
    // First, try to find exact column name match
    for (const withdrawalCol of bankConfig.withdrawalColumns) {
      const colLower = withdrawalCol.toLowerCase().trim();
      // Try exact key match first (case-insensitive)
      const exactKey = rowKeys.find(k => k.toLowerCase().trim() === colLower);
      if (exactKey) {
        const value = row[exactKey];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          withdrawalAmtStr = String(value).trim();
          withdrawalColumnFound = true;
          if (index < 3) {
            console.log(`✓ Found withdrawal column "${exactKey}" (exact match) with value: "${withdrawalAmtStr}"`);
          }
          break;
        }
      }
    }
    
    // If not found, try contains match
    if (!withdrawalColumnFound) {
      for (const key of rowKeys) {
        const keyLower = key.toLowerCase().trim();
        const matchesWithdrawal = bankConfig.withdrawalColumns.some(col => {
          const colLower = col.toLowerCase().trim();
          // Try exact match first, then contains match
          return keyLower === colLower || keyLower.includes(colLower);
        });
        if (matchesWithdrawal) {
          const value = row[key];
          if (value !== undefined && value !== null && String(value).trim() !== "") {
            withdrawalAmtStr = String(value).trim();
            withdrawalColumnFound = true;
            if (index < 3) {
              console.log(`✓ Found withdrawal column "${key}" (contains match) with value: "${withdrawalAmtStr}"`);
            }
            break;
          }
        }
      }
    }
    
    // Fallback: try lowercase lookup in rowLower
    if (!withdrawalColumnFound) {
      for (const withdrawalCol of bankConfig.withdrawalColumns) {
        const colLower = withdrawalCol.toLowerCase().trim();
        if (rowLower[colLower]) {
          const value = String(rowLower[colLower]).trim();
          if (value !== "" && value !== "undefined" && value !== "null") {
            withdrawalAmtStr = value;
            withdrawalColumnFound = true;
            if (index < 3) {
              console.log(`✓ Found withdrawal column "${colLower}" (lowercase fallback) with value: "${withdrawalAmtStr}"`);
            }
            break;
          }
        }
      }
    }
    
    if (!withdrawalColumnFound || withdrawalAmtStr === "") {
      withdrawalAmtStr = "0";
      if (index < 3) {
        console.log(`✗ No withdrawal column found. Available columns: ${rowKeys.join(", ")}`);
      }
    }

    const withdrawalAmount = this.parseAmount(withdrawalAmtStr);

    // Debug first few rows
    if (index < 3) {
      console.log(`Row ${index + 1}: Deposit column value: "${depositAmtStr}" -> parsed: ${depositAmount}, Withdrawal column value: "${withdrawalAmtStr}" -> parsed: ${withdrawalAmount}`);
      console.log(`Row ${index + 1}: Available columns:`, rowKeys);
    }

    // Determine transaction type and amount based on filter
    let amount = 0;
    let type: 'credit' | 'debit' = 'credit';
    
    if (depositAmount > 0 && withdrawalAmount > 0) {
      // Both have values - use the larger one
      if (depositAmount >= withdrawalAmount) {
        amount = depositAmount;
        type = 'credit';
      } else {
        amount = withdrawalAmount;
        type = 'debit';
      }
    } else if (depositAmount > 0) {
      amount = depositAmount;
      type = 'credit';
    } else if (withdrawalAmount > 0) {
      amount = withdrawalAmount;
      type = 'debit';
    } else {
      // Skip rows with no amount
      if (index < 3) {
        console.log(`Row ${index + 1}: Skipping - no valid amount found (deposit: ${depositAmount}, withdrawal: ${withdrawalAmount})`);
      }
      return null;
    }

    // Filter based on transactionType parameter
    if (transactionType === 'credit' && type !== 'credit') {
      if (index < 3) {
        console.log(`Row ${index + 1}: Filtered out - transaction type is ${type} but filter is ${transactionType}`);
      }
      return null;
    }
    if (transactionType === 'debit' && type !== 'debit') {
      if (index < 3) {
        console.log(`Row ${index + 1}: Filtered out - transaction type is ${type} but filter is ${transactionType}`);
      }
      return null;
    }
    
    if (index < 3) {
      console.log(`Row ${index + 1}: ✓ Processing as ${type} transaction with amount ${amount}`);
    }

    // Narration is already found above (used for summary row check)
    // No need to find it again

    // Find reference number column using bank config
    let referenceNumber = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      const matchesReference = bankConfig.referenceColumns.some(col => {
        const colLower = col.toLowerCase();
        return keyLower.includes(colLower) || keyLower === colLower;
      });
      if (matchesReference) {
        referenceNumber = String(row[key] || "").trim();
        break;
      }
    }
    if (!referenceNumber) {
      // Fallback: try bank config columns
      for (const refCol of bankConfig.referenceColumns) {
        const colLower = refCol.toLowerCase();
        if (rowLower[colLower]) {
          referenceNumber = String(rowLower[colLower] || "").trim();
          break;
        }
      }
    }

    // Leave party name blank - user will enter it manually and system will learn
    const partyName = "";

    // Auto-categorize based on transaction type
    const category = type === 'credit' 
      ? this.autoCategorize(narration)
      : this.autoCategorizeDebit(narration);

    // Format date as YYYY-MM-DD without timezone conversion
    // Use UTC methods to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const transaction: Transaction = {
      id: generateId(),
      date: dateString, // Use formatted string directly, no timezone conversion
      amount: amount,
      description: narration,
      type: type,
      category: category,
      partyName: partyName,
      referenceNumber: referenceNumber || undefined,
      added_to_vyapar: false,
      vyapar_reference_number: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return transaction;
  }

  static parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Try common formats
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{2})/, // DD/MM/YY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[2]) {
          // YYYY-MM-DD
          return new Date(match[0]);
        } else {
          // DD/MM/YYYY or DD-MM-YYYY
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const year = parseInt(match[3]);
          if (year < 100) {
            // Handle 2-digit years
            const fullYear = year < 50 ? 2000 + year : 1900 + year;
            return new Date(fullYear, month, day);
          }
          return new Date(year, month, day);
        }
      }
    }

    // Try direct parse
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  }

  static parseAmount(amountStr: string | number): number {
    if (typeof amountStr === "number") {
      return Math.abs(amountStr);
    }

    if (!amountStr) return 0;

    // Convert to string and clean
    let cleaned = String(amountStr).trim();

    // Handle empty strings
    if (cleaned === "" || cleaned === "-" || cleaned === "—") {
      return 0;
    }

    // Handle Excel formula format: ="19,734.00" or =19,734.00
    cleaned = cleaned.replace(/^=\s*"?([^"]+)"?$/, "$1");

    // Remove currency symbols, commas, spaces, and other formatting
    cleaned = cleaned
      .replace(/[₹$€£,]/g, "")
      .replace(/\s/g, "")
      .replace(/\(/g, "-") // Handle negative in parentheses
      .replace(/\)/g, "")
      .trim();

    // Handle empty after cleaning
    if (cleaned === "" || cleaned === "-") {
      return 0;
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }

  static extractPartyName(description: string): string {
    if (!description) return "Unknown";

    // Clean the description first
    let cleaned = description.trim();
    if (!cleaned) return "Unknown";

    // Common patterns for UPI/NEFT/IMPS - extract party name from these patterns
    const upiMatch = cleaned.match(/UPI[\/\-]([^\/\-\d]+)/i);
    if (upiMatch) {
      return upiMatch[1].trim();
    }

    const neftMatch = cleaned.match(/NEFT[\/\-]([^\/\-]+)/i);
    if (neftMatch) {
      return neftMatch[1].replace(/\d+/g, "").trim();
    }

    const impsMatch = cleaned.match(/IMPS[\/\-]([^\/\-]+)/i);
    if (impsMatch) {
      return impsMatch[1].trim();
    }

    // For most bank statements, the narration itself contains the party name
    // Clean it up by removing transaction codes and numbers, but keep the party name
    let partyName = cleaned;

    // Remove transaction reference numbers and IDs (but keep party names)
    partyName = partyName
      .replace(/REF\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
      .replace(/TXN\s*ID[:\-]?\s*[A-Z0-9]+/gi, " ")
      .replace(/UTR[:\-]?\s*[A-Z0-9]+/gi, " ")
      .replace(/CHQ\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
      .replace(/\b\d{10,}\b/g, " ") // Remove long account numbers
      .replace(/\s+/g, " ")
      .trim();

    // If the cleaned narration is still meaningful (more than just transaction codes)
    if (partyName.length > 2) {
      // Remove common transaction type words that might be at the start
      const transactionTypes = /^(RTGS|NEFT|IMPS|UPI|CHEQUE|CHQ|TRANSFER|CREDIT|DEBIT|PAYMENT|RECEIVED|BY|TO|FROM)\s+/i;
      partyName = partyName.replace(transactionTypes, "").trim();

      // If we still have content, use it (this is likely the party name)
      if (partyName.length > 2) {
        // Return the cleaned narration (up to reasonable length)
        // Many narrations are just party names, so use them as-is
        return partyName.length > 100 ? partyName.substring(0, 100).trim() : partyName;
      }
    }

    // Final fallback: use the original description (many narrations ARE the party name)
    return cleaned.length > 100 ? cleaned.substring(0, 100).trim() : cleaned;
  }

  static autoCategorize(description: string): "Credit Sale" | "Payment Received" | "Refund" | "Loan/Credit" | "Interest Income" | "Other Credit" {
    const desc = description.toLowerCase();

    if (desc.includes("sale") || desc.includes("invoice")) {
      return "Credit Sale";
    }
    if (desc.includes("payment") || desc.includes("received")) {
      return "Payment Received";
    }
    if (desc.includes("refund")) {
      return "Refund";
    }
    if (desc.includes("loan") || desc.includes("credit")) {
      return "Loan/Credit";
    }
    if (desc.includes("interest")) {
      return "Interest Income";
    }
    return "Other Credit";
  }

  static autoCategorizeDebit(description: string): "Purchase" | "Payment Made" | "Expense" | "Other Debit" {
    const desc = description.toLowerCase();

    if (desc.includes("purchase") || desc.includes("buy")) {
      return "Purchase";
    }
    if (desc.includes("payment") || desc.includes("paid")) {
      return "Payment Made";
    }
    if (desc.includes("expense") || desc.includes("charge") || desc.includes("fee")) {
      return "Expense";
    }
    return "Other Debit";
  }
}

