import Papa from "papaparse";
import { Transaction } from "../types/transaction";
import { generateId } from "../lib/utils";

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
   * Only processes rows where Deposit Amt. > 0
   */
  static parseFile(file: File): Promise<Transaction[]> {
    return new Promise((resolve, reject) => {
      // First, read the file as text to find the header row
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error("Failed to read file"));
          return;
        }

        // Find the header row (contains "Date", "Narration", "Deposit Amt.")
        const lines = text.split("\n");
        let headerRowIndex = -1;
        let headerRow = "";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (
            line.includes("date") &&
            (line.includes("narration") || line.includes("description")) &&
            (line.includes("deposit") || line.includes("deposit amt"))
          ) {
            headerRowIndex = i;
            headerRow = lines[i];
            break;
          }
        }

        if (headerRowIndex === -1) {
          reject(
            new Error(
              "Could not find header row with Date, Narration, and Deposit Amt. columns"
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

              // Filter out separator rows (rows with mostly asterisks, dashes, or empty)
              const validRows = (results.data as any[]).filter((row) => {
                const values = Object.values(row);
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

              const transactions = this.parseRows(validRows as BankCSVRow[]);

              if (transactions.length === 0) {
                // Provide more helpful error message
                const sampleRow = validRows[0] as any;
                const availableColumns = sampleRow
                  ? Object.keys(sampleRow).join(", ")
                  : "none";
                console.log("Sample row:", sampleRow);
                reject(
                  new Error(
                    `No deposit transactions found. Only rows with Deposit Amt. > 0 are processed.\n\n` +
                    `Found columns: ${availableColumns}\n` +
                    `Sample row values: ${JSON.stringify(sampleRow)}\n` +
                    `Please check that the Deposit Amt. column has values > 0.`
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

  static parseRows(rows: BankCSVRow[]): Transaction[] {
    const transactions: Transaction[] = [];

    // Debug: Log first row to see structure
    if (rows.length > 0) {
      console.log("First row sample:", rows[0]);
      console.log("Available columns:", Object.keys(rows[0]));
    }

    rows.forEach((row, index) => {
      try {
        const transaction = this.parseRow(row, index);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Failed to parse row ${index + 1}:`, row, error);
      }
    });

    console.log(`Parsed ${transactions.length} transactions from ${rows.length} rows`);
    return transactions;
  }

  static parseRow(row: BankCSVRow, index: number): Transaction | null {
    // Use flexible column matching (case-insensitive, handles variations)
    const rowKeys = Object.keys(row);
    const rowLower = Object.fromEntries(
      rowKeys.map((k) => [k.toLowerCase().trim(), row[k]])
    );

    // Find narration column first to check for summary/total rows
    let narration = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (keyLower.includes("narration") || keyLower.includes("description")) {
        narration = String(row[key] || "").trim();
        break;
      }
    }
    if (!narration) {
      narration = String(rowLower["narration"] || rowLower["description"] || "").trim();
    }

    // Filter out summary/total rows
    const narrationLower = narration.toLowerCase();
    const summaryKeywords = [
      "total", "summary", "grand total", "opening balance", 
      "closing balance", "balance", "total deposit", "total withdrawal",
      "total credit", "total debit", "net balance", "balance brought forward",
      "balance carried forward", "opening", "closing"
    ];
    
    const isSummaryRow = summaryKeywords.some(keyword => 
      narrationLower.includes(keyword) && narrationLower.length < 50 // Short descriptions are likely summary rows
    );
    
    if (isSummaryRow) {
      console.log(`Skipping summary row ${index + 1}: "${narration}"`);
      return null;
    }

    // Find date column (flexible matching)
    let dateStr = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (
        keyLower.includes("date") &&
        !keyLower.includes("value") &&
        !keyLower.includes("closing")
      ) {
        dateStr = String(row[key] || "");
        break;
      }
    }
    if (!dateStr) {
      dateStr = String(
        rowLower["date"] ||
        rowLower["transaction date"] ||
        rowLower["value dt"] ||
        rowLower["value date"] ||
        ""
      );
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

    // Find deposit amount column (flexible matching)
    let depositAmtStr = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (
        (keyLower.includes("deposit") && keyLower.includes("amt")) ||
        (keyLower.includes("deposit") && keyLower.includes("amount")) ||
        (keyLower === "deposit amt.") ||
        (keyLower === "deposit amt") ||
        (keyLower === "deposit amount")
      ) {
        depositAmtStr = String(row[key] || "0");
        break;
      }
    }
    if (!depositAmtStr) {
      depositAmtStr = String(
        rowLower["deposit amt."] ||
        rowLower["deposit amt"] ||
        rowLower["deposit amount"] ||
        "0"
      );
    }

    const depositAmount = this.parseAmount(depositAmtStr);

    // Debug first few rows
    if (index < 3) {
      console.log(`Row ${index + 1}: Deposit amount found: "${depositAmtStr}" = ${depositAmount}`);
    }

    // Only process deposits > 0
    if (depositAmount <= 0) {
      return null; // Skip withdrawals and zero amounts
    }

    // Find narration column (flexible matching)
    let narration = "";
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase().trim();
      if (keyLower.includes("narration") || keyLower.includes("description")) {
        narration = String(row[key] || "");
        break;
      }
    }
    if (!narration) {
      narration = String(rowLower["narration"] || rowLower["description"] || "");
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
        referenceNumber = String(row[key] || "");
        break;
      }
    }
    if (!referenceNumber) {
      referenceNumber = String(
        rowLower["chq./ref.no."] ||
        rowLower["chq/ref.no."] ||
        rowLower["ref no"] ||
        ""
      );
    }

    // Leave party name blank - user will enter it manually and system will learn
    const partyName = "";

    // Auto-categorize
    const category = this.autoCategorize(narration);

    const transaction: Transaction = {
      id: generateId(),
      date: date.toISOString().split("T")[0],
      amount: depositAmount,
      description: narration,
      type: "credit",
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
}

