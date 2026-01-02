import { Transaction } from "../types/transaction";
import { StorageService } from "./storageService";
import { fetchTransactionsFromSheets, isGoogleSheetsConfigured } from "./googleSheetsService";

/**
 * Party Summary Interface
 * Simple structure for displaying party with total amount
 */
export interface PartySummary {
  name: string;
  totalAmount: number; // Total of COMPLETED transactions only (credits - debits)
  transactionCount: number; // Count of COMPLETED transactions only
}

/**
 * Parties List Service
 * Extracts parties from transactions and calculates totals
 * Separate implementation - doesn't touch existing code
 */
export class PartiesListService {
  /**
   * Get all transactions from the appropriate source
   */
  private static async getTransactions(): Promise<Transaction[]> {
    if (isGoogleSheetsConfigured()) {
      try {
        return await fetchTransactionsFromSheets();
      } catch (error) {
        console.error('Error fetching transactions from Google Sheets:', error);
        // Fallback to localStorage
        return StorageService.getTransactions();
      }
    } else {
      return StorageService.getTransactions();
    }
  }

  /**
   * Get list of parties with their total amounts
   * Returns a simple list: party name and total amount
   * IMPORTANT: Only includes COMPLETED transactions (added_to_vyapar = true AND has vyapar_reference_number)
   */
  static async getPartiesList(): Promise<PartySummary[]> {
    try {
      const transactions = await this.getTransactions();
      
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
        
        // Only include completed transactions with party names
        return isCompleted && t.partyName && t.partyName.trim() !== "";
      });

      if (completedTransactions.length === 0) {
        return [];
      }

      // Group by party name (case-insensitive) and calculate totals
      const partyMap = new Map<string, {
        name: string;
        totalAmount: number;
        count: number;
      }>();

      completedTransactions.forEach((transaction) => {
        const partyName = transaction.partyName.trim();
        const normalizedName = partyName.toLowerCase();

        if (!partyMap.has(normalizedName)) {
          partyMap.set(normalizedName, {
            name: partyName, // Keep original case for display
            totalAmount: 0,
            count: 0,
          });
        }

        const party = partyMap.get(normalizedName)!;
        
        // Calculate amount: credits are positive, debits are negative
        if (transaction.type === "credit") {
          party.totalAmount += transaction.amount;
        } else {
          party.totalAmount -= transaction.amount;
        }
        
        party.count += 1;
      });

      // Convert to array and sort by total amount (highest first)
      const partiesList: PartySummary[] = Array.from(partyMap.values())
        .map((party) => ({
          name: party.name,
          totalAmount: party.totalAmount,
          transactionCount: party.count,
        }))
        .sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));

      return partiesList;
    } catch (error) {
      console.error('[PartiesListService] Error getting parties list:', error);
      return [];
    }
  }
}

