export type TransactionType = "credit" | "debit";

export type TransactionCategory =
  | "Credit Sale"
  | "Payment Received"
  | "Refund"
  | "Loan/Credit"
  | "Interest Income"
  | "Other Credit"
  | "Purchase"
  | "Payment Made"
  | "Expense"
  | "Other Debit";

export interface Transaction {
  id: string;
  date: string; // ISO date string
  amount: number;
  description: string;
  type: TransactionType;
  category: TransactionCategory;
  partyName: string;
  referenceNumber?: string; // Bank reference number (Chq./Ref.No.)
  bankAccount?: string;
  added_to_vyapar: boolean; // Renamed from inVyapar for consistency
  vyapar_reference_number?: string; // Vyapar reference number
  hold?: boolean; // Hold status - transaction is on hold
  notes?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  // Legacy support
  inVyapar?: boolean; // For backward compatibility
}

export interface Party {
  id: string;
  name: string;
  type: "customer" | "supplier";
  balance: number; // positive = owes us, negative = we owe
  totalCredits: number;
  totalDebits: number;
  lastTransactionDate?: string;
  notes?: string;
}

export interface DashboardStats {
  totalDepositAmount: number; // Total of all deposits
  pendingAmount: number; // Amount of pending transactions
  completedAmount: number; // Amount of completed transactions
  pendingCount: number; // Number of pending transactions
  totalCredits: number; // Legacy
  totalDebits: number; // Legacy
  netBalance: number; // Legacy
  pendingSyncCount: number; // Legacy
  transactionsThisMonth: number;
  transactionsThisYear: number;
}

