import Papa from "papaparse";
import { Transaction, TransactionType, TransactionCategory } from "../types/transaction";

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  type: TransactionType;
  category?: TransactionCategory;
  partyName: string;
  referenceNumber?: string;
}

export class CSVParser {
  static parseFile(file: File): Promise<ParsedTransaction[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
        complete: (results) => {
          try {
            console.log("PapaParse complete. Rows:", results.data.length);
            console.log("Errors:", results.errors);
            
            if (results.errors && results.errors.length > 0) {
              console.warn("CSV parsing errors:", results.errors);
            }

            if (!results.data || results.data.length === 0) {
              reject(new Error("CSV file appears to be empty or has no data rows"));
              return;
            }

            const transactions = this.parseRows(results.data as any[]);
            
            if (transactions.length === 0) {
              reject(new Error("No valid transactions found. Please check CSV format and column names."));
              return;
            }

            resolve(transactions);
          } catch (error) {
            console.error("Error processing parsed data:", error);
            reject(error);
          }
        },
        error: (error) => {
          console.error("PapaParse error:", error);
          reject(new Error(`Failed to parse CSV: ${error.message || "Unknown error"}`));
        },
      });
    });
  }

  static parseRows(rows: any[]): ParsedTransaction[] {
    if (!rows || rows.length === 0) {
      console.warn("No rows found in CSV");
      return [];
    }

    console.log("Parsing rows:", rows.length);
    console.log("First row sample:", rows[0]);
    console.log("Column names:", Object.keys(rows[0] || {}));

    const transactions = rows
      .map((row, index) => {
        try {
          return this.parseRow(row);
        } catch (error) {
          console.warn(`Failed to parse row ${index}:`, row, error);
          return null;
        }
      })
      .filter((t): t is ParsedTransaction => t !== null);

    console.log("Successfully parsed transactions:", transactions.length);
    return transactions;
  }

  static parseRow(row: any): ParsedTransaction | null {
    // Try to detect column names (case-insensitive)
    const keys = Object.keys(row).map((k) => k.toLowerCase());

    // Find date column
    const dateKey = keys.find(
      (k) =>
        k.includes("date") ||
        k.includes("transaction date") ||
        k.includes("value date")
    );
    const dateStr = dateKey ? row[Object.keys(row).find((k) => k.toLowerCase() === dateKey)!] : null;

    // Find amount columns
    const creditKey = keys.find(
      (k) => k.includes("credit") || k.includes("deposit") || k.includes("cr")
    );
    const debitKey = keys.find(
      (k) => k.includes("debit") || k.includes("withdrawal") || k.includes("dr")
    );
    const amountKey = keys.find((k) => k.includes("amount") && !k.includes("credit") && !k.includes("debit"));

    // Find description column
    const descKey = keys.find(
      (k) =>
        k.includes("description") ||
        k.includes("narration") ||
        k.includes("particulars") ||
        k.includes("remarks") ||
        k.includes("details")
    );

    // Find reference column
    const refKey = keys.find(
      (k) =>
        k.includes("reference") ||
        k.includes("ref") ||
        k.includes("cheque") ||
        k.includes("transaction id")
    );

    if (!dateStr) {
      return null; // Skip rows without date
    }

    // Parse date (try multiple formats)
    const date = this.parseDate(dateStr);
    if (!date) {
      return null;
    }

    // Parse amounts
    let creditAmount = 0;
    let debitAmount = 0;

    if (creditKey) {
      const creditValue = row[Object.keys(row).find((k) => k.toLowerCase() === creditKey)!];
      creditAmount = this.parseAmount(creditValue);
    }

    if (debitKey) {
      const debitValue = row[Object.keys(row).find((k) => k.toLowerCase() === debitKey)!];
      debitAmount = this.parseAmount(debitValue);
    }

    if (amountKey && creditAmount === 0 && debitAmount === 0) {
      const amountValue = row[Object.keys(row).find((k) => k.toLowerCase() === amountKey)!];
      const amount = this.parseAmount(amountValue);
      // Try to determine type from description or use absolute value
      if (amount > 0) {
        creditAmount = amount;
      } else {
        debitAmount = Math.abs(amount);
      }
    }

    if (creditAmount === 0 && debitAmount === 0) {
      return null; // Skip rows without amount
    }

    const description = descKey
      ? row[Object.keys(row).find((k) => k.toLowerCase() === descKey)!] || ""
      : "";

    const referenceNumber = refKey
      ? row[Object.keys(row).find((k) => k.toLowerCase() === refKey)!] || ""
      : "";

    const type: TransactionType = creditAmount > 0 ? "credit" : "debit";
    const amount = creditAmount > 0 ? creditAmount : debitAmount;

    // Extract party name from description
    const partyName = this.extractPartyName(description);

    // Auto-categorize
    const category = this.autoCategorize(description, type);

    return {
      date: date.toISOString().split("T")[0],
      amount,
      description: description.trim(),
      type,
      category,
      partyName,
      referenceNumber: referenceNumber.trim() || undefined,
    };
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

    // Remove currency symbols and commas
    const cleaned = String(amountStr)
      .replace(/[₹,]/g, "")
      .replace(/\s/g, "")
      .trim();

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }

  static extractPartyName(description: string): string {
    if (!description) return "Unknown";

    // Common patterns
    // UPI: "UPI/PAYTM/1234567890/John Doe"
    // NEFT: "NEFT-123456-John Doe"
    // IMPS: "IMPS/John Doe/123456"

    const upiMatch = description.match(/UPI[\/\-]([^\/\-\d]+)/i);
    if (upiMatch) {
      return upiMatch[1].trim();
    }

    const neftMatch = description.match(/NEFT[\/\-]([^\/\-]+)/i);
    if (neftMatch) {
      return neftMatch[1].replace(/\d+/g, "").trim();
    }

    const impsMatch = description.match(/IMPS[\/\-]([^\/\-]+)/i);
    if (impsMatch) {
      return impsMatch[1].trim();
    }

    // If no pattern found, return first few words
    const words = description.split(/\s+/).filter((w) => w.length > 2);
    return words.slice(0, 2).join(" ") || "Unknown";
  }

  static autoCategorize(
    description: string,
    type: TransactionType
  ): TransactionCategory {
    const desc = description.toLowerCase();

    if (type === "credit") {
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
    } else {
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
}

