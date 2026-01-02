import { Transaction } from "../types/transaction";
import { StorageService } from "./storageService";
import { fetchDebitTransactionsFromSheets, isGoogleSheetsConfigured } from "./googleSheetsService";

/**
 * Supplier Summary Interface
 * Simple structure for displaying supplier with total amount
 */
export interface SupplierSummary {
  name: string;
  totalAmount: number; // Total of COMPLETED transactions only (debits)
  transactionCount: number; // Count of COMPLETED transactions only
}

/**
 * Suppliers List Service
 * Extracts suppliers from debit transactions and calculates totals
 * Separate implementation - doesn't touch existing code
 */
export class SuppliersListService {
  /**
   * Get all debit transactions from the appropriate source
   */
  private static async getDebitTransactions(): Promise<Transaction[]> {
    if (isGoogleSheetsConfigured()) {
      try {
        return await fetchDebitTransactionsFromSheets();
      } catch (error) {
        console.error('Error fetching debit transactions from Google Sheets:', error);
        // Fallback to localStorage - filter for debits
        const allTransactions = StorageService.getTransactions();
        return allTransactions.filter(t => t.type === 'debit');
      }
    } else {
      const allTransactions = StorageService.getTransactions();
      return allTransactions.filter(t => t.type === 'debit');
    }
  }

  /**
   * Get list of suppliers with their total amounts
   * Returns a simple list: supplier name and total amount
   * IMPORTANT: Only includes COMPLETED transactions (added_to_vyapar = true AND has vyapar_reference_number)
   */
  static async getSuppliersList(): Promise<SupplierSummary[]> {
    try {
      const transactions = await this.getDebitTransactions();
      
      if (transactions.length === 0) {
        return [];
      }

      // Filter only COMPLETED transactions (added_to_vyapar = true AND has vyapar_reference_number)
      // Also migrate legacy inVyapar field for backward compatibility
      const completedTransactions = transactions.filter((t) => {
        // Migrate legacy inVyapar to added_to_vyapar
        const isCompleted = Boolean(
          (t.added_to_vyapar || t.inVyapar) && 
          t.vyapar_reference_number && 
          String(t.vyapar_reference_number).trim() !== ''
        );
        
        // Only include completed debit transactions with supplier names
        return isCompleted && t.type === 'debit' && t.partyName && t.partyName.trim() !== "";
      });

      if (completedTransactions.length === 0) {
        return [];
      }

      // Group by supplier name (case-insensitive) and calculate totals
      const supplierMap = new Map<string, {
        name: string;
        totalAmount: number;
        count: number;
      }>();

      completedTransactions.forEach((transaction) => {
        const supplierName = transaction.partyName.trim();
        const normalizedName = supplierName.toLowerCase();

        if (!supplierMap.has(normalizedName)) {
          supplierMap.set(normalizedName, {
            name: supplierName, // Keep original case for display
            totalAmount: 0,
            count: 0,
          });
        }

        const supplier = supplierMap.get(normalizedName)!;
        
        // For debits, amount is already positive (withdrawal amount)
        supplier.totalAmount += transaction.amount;
        supplier.count += 1;
      });

      // Convert to array and sort by total amount (highest first)
      const suppliersList: SupplierSummary[] = Array.from(supplierMap.values())
        .map((supplier) => ({
          name: supplier.name,
          totalAmount: supplier.totalAmount,
          transactionCount: supplier.count,
        }))
        .sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));

      return suppliersList;
    } catch (error) {
      console.error('[SuppliersListService] Error getting suppliers list:', error);
      return [];
    }
  }
}

