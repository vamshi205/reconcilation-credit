import * as XLSX from "xlsx";
import { Transaction } from "../types/transaction";
import { generateId } from "../lib/utils";

export interface BankExcelRow {
  Date?: string | number;
  "Transaction Date"?: string | number;
  Narration?: string;
  "Chq./Ref.No."?: string;
  "Chq/Ref.No."?: string;
  "Value Dt"?: string | number;
  "Value Date"?: string | number;
  "Withdrawal Amt."?: string | number;
  "Withdrawal Amt"?: string | number;
  "Deposit Amt."?: string | number;
  "Deposit Amt"?: string | number;
  "Closing Balance"?: string | number;
}

export class BankExcelParser {
  /**
   * Parse bank Excel file (.xls or .xlsx) with specific format:
   * Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
   * @param file - The Excel file to parse
   * @param transactionType - 'credit', 'debit', or 'both' to filter transactions
   */
  static parseFile(file: File, transactionType: 'credit' | 'debit' | 'both' = 'credit'): Promise<Transaction[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error("Failed to read file"));
            return;
          }

          // Parse workbook
          const workbook = XLSX.read(data, { type: "binary" });

          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            reject(new Error("Excel file has no sheets"));
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];

          // Convert to JSON with header row
          const jsonData = XLSX.utils.sheet_to_json<BankExcelRow>(worksheet, {
            header: 1,
            defval: "",
          });

          if (!jsonData || jsonData.length === 0) {
            reject(new Error("Excel file appears to be empty"));
            return;
          }

          // Find the header row (look for row containing "date", "narration", "deposit")
          // Search more rows to handle bank statements with metadata
          let headerRowIndex = -1;
          let headers: any[] = [];
          
          for (let i = 0; i < Math.min(30, jsonData.length); i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;
            
            // Skip rows that are clearly metadata (single cell with bank name, page numbers, etc.)
            const nonEmptyCells = row.filter(cell => cell !== "" && cell !== null && cell !== undefined);
            if (nonEmptyCells.length < 3) continue; // Headers should have at least 3 columns
            
            const rowString = row.map(cell => String(cell || "").toLowerCase()).join(" ");
            
            // Skip rows that are clearly not headers (contain page numbers, statement titles, etc.)
            if (
              rowString.includes("page no") ||
              rowString.includes("statement of account") ||
              rowString.includes("statement of accounts") ||
              rowString.includes("account statement") ||
              (rowString.includes("hdfc") && rowString.length < 100) || // Bank name alone
              rowString.match(/^[a-z\s]+bank/i) // Just bank name
            ) {
              continue;
            }
            
            // Look for actual header row with date, narration, and deposit/withdrawal columns
            const hasDate = rowString.includes("date") && !rowString.includes("value date");
            const hasNarration = rowString.includes("narration") || rowString.includes("description") || rowString.includes("particulars");
            const hasAmount = rowString.includes("deposit") || rowString.includes("withdrawal") || 
                            rowString.includes("credit") || rowString.includes("debit") ||
                            rowString.includes("amount");
            
            if (hasDate && hasNarration && hasAmount) {
              // Verify this looks like a real header by checking if next row has data
              if (i + 1 < jsonData.length) {
                const nextRow = jsonData[i + 1] as any[];
                const nextRowString = nextRow.map(cell => String(cell || "").toLowerCase()).join(" ");
                // Next row should not be another header or metadata
                if (!nextRowString.includes("date") && !nextRowString.includes("page no")) {
                  headerRowIndex = i;
                  headers = row;
                  break;
                }
              } else {
                headerRowIndex = i;
                headers = row;
                break;
              }
            }
          }

          // Fallback: try to find any row with multiple columns that might be headers
          if (headerRowIndex === -1) {
            for (let i = 0; i < Math.min(30, jsonData.length); i++) {
              const row = jsonData[i] as any[];
              if (!row || row.length < 3) continue;
              
              const nonEmptyCount = row.filter(cell => {
                const str = String(cell || "").trim();
                return str !== "" && str.length > 0;
              }).length;
              
              // If row has 5+ non-empty cells, it might be a header
              if (nonEmptyCount >= 5) {
                const rowString = row.map(cell => String(cell || "").toLowerCase()).join(" ");
                if (rowString.includes("date") || rowString.includes("narration") || rowString.includes("amount")) {
                  headerRowIndex = i;
                  headers = row;
                  break;
                }
              }
            }
          }
          
          // Last resort: use first row
          if (headerRowIndex === -1) {
            headers = jsonData[0] as any[];
            headerRowIndex = 0;
          }

          if (!headers || headers.length === 0) {
            reject(new Error("Excel file has no headers"));
            return;
          }

          console.log(`Excel Headers found at row ${headerRowIndex + 1}:`, headers);

          // Convert to object array (skip header row and any rows before it)
          const rows: BankExcelRow[] = jsonData.slice(headerRowIndex + 1).map((row: any[]) => {
            const obj: any = {};
            headers.forEach((header, index) => {
              if (header) {
                const value = row[index];
                // Handle undefined, null, empty strings
                obj[header] = value !== undefined && value !== null ? value : "";
              }
            });
            return obj;
          });

          console.log("Excel Rows:", rows.length);
          
          // Debug: Log first row to see structure
          if (rows.length > 0) {
            console.log("First row sample:", rows[0]);
            console.log("Available columns:", Object.keys(rows[0]));
          }

          const transactions = this.parseRows(rows, transactionType);

          if (transactions.length === 0) {
            // Provide more helpful error message with column information
            const sampleRow = rows.length > 0 ? rows[0] : null;
            const availableColumns = sampleRow
              ? Object.keys(sampleRow).join(", ")
              : "none";
            const sampleValues = sampleRow
              ? JSON.stringify(sampleRow, null, 2)
              : "none";
            
            // Show first few rows of raw data for debugging
            const firstFewRows = jsonData.slice(0, Math.min(5, jsonData.length))
              .map((row, idx) => `Row ${idx + 1}: ${JSON.stringify(row.slice(0, 5))}`)
              .join("\n");
            
            reject(
              new Error(
                `No ${transactionType === 'credit' ? 'credit' : transactionType === 'debit' ? 'debit' : ''} transactions found.\n\n` +
                `Header row found at: Row ${headerRowIndex + 1}\n` +
                `Headers detected: ${headers.slice(0, 10).join(", ")}\n\n` +
                `First few rows of data:\n${firstFewRows}\n\n` +
                `Parsed columns: ${availableColumns}\n` +
                `Sample row: ${sampleValues}\n\n` +
                `Please check:\n` +
                `1. File has proper headers: Date, Narration, Deposit Amt./Withdrawal Amt.\n` +
                `2. Headers are not in metadata rows (page numbers, bank names, etc.)\n` +
                `3. ${transactionType === 'credit' ? 'Deposit' : transactionType === 'debit' ? 'Withdrawal' : 'Deposit or Withdrawal'} Amt. column contains values > 0\n` +
                `4. Date format is valid (DD/MM/YYYY, DD-MM-YYYY, or Excel date format)`
              )
            );
            return;
          }

          console.log("Successfully parsed deposit transactions:", transactions.length);
          resolve(transactions);
        } catch (error) {
          console.error("Excel parsing error:", error);
          reject(
            new Error(
              `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`
            )
          );
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsBinaryString(file);
    });
  }

  static parseRows(rows: BankExcelRow[], transactionType: 'credit' | 'debit' | 'both' = 'credit'): Transaction[] {
    const transactions: Transaction[] = [];
    let skippedCount = 0;
    let errorCount = 0;

    rows.forEach((row, index) => {
      try {
        const transaction = this.parseRow(row, index, transactionType);
        if (transaction) {
          transactions.push(transaction);
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        console.warn(`Failed to parse row ${index + 1}:`, row, error);
      }
    });

    console.log(`Parsed ${transactions.length} transactions from ${rows.length} rows (filter: ${transactionType}, skipped: ${skippedCount}, errors: ${errorCount})`);
    return transactions;
  }

  static parseRow(row: BankExcelRow, index: number, transactionType: 'credit' | 'debit' | 'both' = 'credit'): Transaction | null {
    // Use flexible column matching (case-insensitive, handles variations)
    const rowKeys = Object.keys(row);
    const rowLower = Object.fromEntries(
      rowKeys.map((k) => [k.toLowerCase().trim(), row[k]])
    );

    // Find date column (flexible matching)
    let dateValue: string | number = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (
        keyLower.includes("date") &&
        !keyLower.includes("value") &&
        !keyLower.includes("closing")
      ) {
        dateValue = row[key] as string | number;
        break;
      }
    }
    if (!dateValue) {
      dateValue =
        (rowLower["date"] as string | number) ||
        (rowLower["transaction date"] as string | number) ||
        (rowLower["value dt"] as string | number) ||
        (rowLower["value date"] as string | number) ||
        "";
    }

    if (!dateValue || dateValue === "undefined" || dateValue === "null") {
      if (index < 3) {
        console.warn(`Row ${index + 1}: No date found. Available columns:`, rowKeys);
      }
      return null;
    }

    // Parse date (Excel dates are numbers, or strings)
    const date = this.parseDate(dateValue);
    if (!date) {
      if (index < 3) {
        console.warn(`Row ${index + 1}: Invalid date format: ${dateValue}`);
      }
      return null;
    }

    // Find deposit amount column (flexible matching)
    let depositAmtValue: string | number = 0;
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      // More flexible matching for deposit columns
      if (
        (keyLower.includes("deposit") && (keyLower.includes("amt") || keyLower.includes("amount"))) ||
        keyLower === "deposit amt." ||
        keyLower === "deposit amt" ||
        keyLower === "deposit amount" ||
        keyLower === "deposit" ||
        (keyLower.includes("credit") && (keyLower.includes("amt") || keyLower.includes("amount"))) ||
        keyLower === "credit amt." ||
        keyLower === "credit amt" ||
        keyLower === "credit amount" ||
        keyLower === "cr" ||
        keyLower === "credit"
      ) {
        const value = row[key];
        // Check if value exists and is not empty
        if (value !== undefined && value !== null && value !== "" && value !== "undefined" && value !== "null") {
          depositAmtValue = value as string | number;
          break;
        }
      }
    }
    if (!depositAmtValue || depositAmtValue === 0) {
      // Try lowercase lookup
      depositAmtValue =
        (rowLower["deposit amt."] as string | number) ||
        (rowLower["deposit amt"] as string | number) ||
        (rowLower["deposit amount"] as string | number) ||
        (rowLower["deposit"] as string | number) ||
        (rowLower["credit amt."] as string | number) ||
        (rowLower["credit amt"] as string | number) ||
        (rowLower["credit amount"] as string | number) ||
        (rowLower["credit"] as string | number) ||
        (rowLower["cr"] as string | number) ||
        0;
    }

    const depositAmount = this.parseAmount(depositAmtValue);

    // Find withdrawal/debit amount column (flexible matching)
    let withdrawalAmtValue: string | number = 0;
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (
        (keyLower.includes("withdrawal") && (keyLower.includes("amt") || keyLower.includes("amount"))) ||
        keyLower === "withdrawal amt." ||
        keyLower === "withdrawal amt" ||
        keyLower === "withdrawal amount" ||
        keyLower === "withdrawal" ||
        (keyLower.includes("debit") && (keyLower.includes("amt") || keyLower.includes("amount"))) ||
        keyLower === "debit amt." ||
        keyLower === "debit amt" ||
        keyLower === "debit amount" ||
        keyLower === "debit" ||
        keyLower === "dr"
      ) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== "" && value !== "undefined" && value !== "null") {
          withdrawalAmtValue = value as string | number;
          break;
        }
      }
    }
    if (!withdrawalAmtValue || withdrawalAmtValue === 0) {
      withdrawalAmtValue =
        (rowLower["withdrawal amt."] as string | number) ||
        (rowLower["withdrawal amt"] as string | number) ||
        (rowLower["withdrawal amount"] as string | number) ||
        (rowLower["withdrawal"] as string | number) ||
        (rowLower["debit amt."] as string | number) ||
        (rowLower["debit amt"] as string | number) ||
        (rowLower["debit amount"] as string | number) ||
        (rowLower["debit"] as string | number) ||
        (rowLower["dr"] as string | number) ||
        0;
    }

    const withdrawalAmount = this.parseAmount(withdrawalAmtValue);

    // Debug first few rows
    if (index < 5) {
      console.log(`Row ${index + 1}: Deposit amount: "${depositAmtValue}" = ${depositAmount}, Withdrawal amount: "${withdrawalAmtValue}" = ${withdrawalAmount}`);
      console.log(`Row ${index + 1}: Available keys:`, rowKeys);
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
      if (index < 3) {
        console.log(`Row ${index + 1}: Skipping - no amount found`);
      }
      return null; // Skip rows with no amount
    }

    // Filter based on transactionType parameter
    if (transactionType === 'credit' && type !== 'credit') {
      return null;
    }
    if (transactionType === 'debit' && type !== 'debit') {
      return null;
    }

    // Find narration column (flexible matching)
    let narration = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (keyLower.includes("narration") || keyLower.includes("description")) {
        narration = String(row[key] || "").trim();
        break;
      }
    }
    if (!narration) {
      narration = String(
        (rowLower["narration"] as string) || (rowLower["description"] as string) || ""
      ).trim();
    }

    // Find reference number column (flexible matching)
    let referenceNumber = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (
        keyLower.includes("ref") ||
        keyLower.includes("chq") ||
        keyLower.includes("cheque")
      ) {
        referenceNumber = String(row[key] || "").trim();
        break;
      }
    }
    if (!referenceNumber) {
      referenceNumber = String(
        (rowLower["chq./ref.no."] as string) ||
        (rowLower["chq/ref.no."] as string) ||
        (rowLower["ref no"] as string) ||
        ""
      ).trim();
    }

    // Leave party name blank - user will enter it manually and system will learn
    const partyName = "";

    // Auto-categorize based on transaction type
    const category = type === 'credit' 
      ? this.autoCategorize(narration)
      : this.autoCategorizeDebit(narration);

    // Format date as YYYY-MM-DD without timezone conversion
    // Use date components directly to avoid timezone shifts
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

  static parseDate(dateValue: string | number): Date | null {
    if (!dateValue) return null;

    // Excel stores dates as numbers (days since 1900-01-01)
    if (typeof dateValue === "number") {
      // Excel date serial number
      const excelEpoch = new Date(1899, 11, 30); // Excel epoch is Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try parsing as string date
    const dateStr = String(dateValue).trim();

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

  static parseAmount(amountValue: string | number): number {
    if (typeof amountValue === "number") {
      // Excel date serial numbers are typically between 1 and ~50000 (for dates from 1900 to ~2137)
      // If the number is in this range and seems like a date, skip it
      // But amounts can also be in this range, so we'll just return the absolute value
      return Math.abs(amountValue);
    }

    if (!amountValue) return 0;

    // Convert to string and clean
    let cleaned = String(amountValue).trim();

    // Handle empty strings, null, undefined
    if (cleaned === "" || cleaned === "-" || cleaned === "—" || cleaned === "null" || cleaned === "undefined" || cleaned === "NULL" || cleaned === "UNDEFINED") {
      return 0;
    }

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
    if (isNaN(parsed)) {
      return 0;
    }
    
    return Math.abs(parsed);
  }

  static extractPartyName(description: string): string {
    if (!description) return "Unknown";

    // Clean the description first
    let cleaned = String(description).trim();
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

  static autoCategorize(
    description: string
  ):
    | "Credit Sale"
    | "Payment Received"
    | "Refund"
    | "Loan/Credit"
    | "Interest Income"
    | "Other Credit" {
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

