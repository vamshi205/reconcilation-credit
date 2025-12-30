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
   * Only processes rows where Deposit Amt. > 0
   */
  static parseFile(file: File): Promise<Transaction[]> {
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

          // First row should be headers
          const headers = jsonData[0] as any[];
          if (!headers || headers.length === 0) {
            reject(new Error("Excel file has no headers"));
            return;
          }

          console.log("Excel Headers:", headers);

          // Convert to object array
          const rows: BankExcelRow[] = jsonData.slice(1).map((row: any[]) => {
            const obj: any = {};
            headers.forEach((header, index) => {
              if (header) {
                obj[header] = row[index] || "";
              }
            });
            return obj;
          });

          console.log("Excel Rows:", rows.length);

          const transactions = this.parseRows(rows);

          if (transactions.length === 0) {
            reject(
              new Error(
                "No deposit transactions found. Only rows with Deposit Amt. > 0 are processed."
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

  static parseRows(rows: BankExcelRow[]): Transaction[] {
    const transactions: Transaction[] = [];

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

    return transactions;
  }

  static parseRow(row: BankExcelRow, index: number): Transaction | null {
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
      if (
        (keyLower.includes("deposit") && keyLower.includes("amt")) ||
        (keyLower.includes("deposit") && keyLower.includes("amount")) ||
        keyLower === "deposit amt." ||
        keyLower === "deposit amt" ||
        keyLower === "deposit amount"
      ) {
        depositAmtValue = row[key] as string | number;
        break;
      }
    }
    if (!depositAmtValue) {
      depositAmtValue =
        (rowLower["deposit amt."] as string | number) ||
        (rowLower["deposit amt"] as string | number) ||
        (rowLower["deposit amount"] as string | number) ||
        0;
    }

    const depositAmount = this.parseAmount(depositAmtValue);

    // Debug first few rows
    if (index < 3) {
      console.log(`Row ${index + 1}: Deposit amount found: "${depositAmtValue}" = ${depositAmount}`);
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

    // Extract party name from narration (if possible)
    const partyName = this.extractPartyName(narration);

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
      return Math.abs(amountValue);
    }

    if (!amountValue) return 0;

    // Convert to string and clean
    let cleaned = String(amountValue).trim();

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

    // Common patterns
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
}

