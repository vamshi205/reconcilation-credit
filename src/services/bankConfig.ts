// Bank configuration for different bank statement formats

export interface BankConfig {
  name: string;
  code: string;
  // Column name variations for this bank
  dateColumns: string[];
  narrationColumns: string[];
  depositColumns: string[];
  withdrawalColumns: string[];
  referenceColumns: string[];
  // Metadata patterns to skip
  skipPatterns: RegExp[];
  // Optional: Expected header row index (0-based). If specified, will check this row first
  headerRowHint?: number;
  // Maximum rows to search for header (default: 50)
  maxHeaderSearchRows?: number;
}

export const BANK_CONFIGS: Record<string, BankConfig> = {
  HDFC: {
    name: "HDFC Bank",
    code: "HDFC",
    dateColumns: ["Date", "Transaction Date", "Value Dt", "Value Date"],
    narrationColumns: ["Narration", "Description", "Particulars"],
    depositColumns: ["Deposit Amt.", "Deposit Amt", "Credit", "CR"],
    withdrawalColumns: ["Withdrawal Amt.", "Withdrawal Amt", "Debit", "DR"],
    referenceColumns: ["Chq./Ref.No.", "Chq/Ref.No.", "Reference", "Ref"],
    skipPatterns: [
      /page no/i,
      /statement of account/i,
      /statement of accounts/i,
      /account statement/i,
      /^hdfc\s+bank/i,
    ],
  },
  Canara: {
    name: "Canara Bank",
    code: "Canara",
    dateColumns: ["Date", "Transaction Date", "Value Date", "Txn Date"],
    narrationColumns: ["Narration", "Description", "Particulars", "Remarks"],
    // For Canara Bank: Credit = Deposits (money in), Debit = Withdrawals (money out)
    depositColumns: ["Credit", "CR", "Deposit", "Deposit Amount", "Credit Amount"],
    withdrawalColumns: ["Debit", "DR", "Withdrawal", "Withdrawal Amount", "Debit Amount"],
    referenceColumns: ["Reference", "Ref", "Chq No", "Cheque No", "Transaction ID"],
    skipPatterns: [
      /page no/i,
      /statement of account/i,
      /statement of accounts/i,
      /account statement/i,
      /^canara\s+bank/i,
    ],
    headerRowHint: 26, // Line 27 (0-based index 26) - Canara Bank headers are typically here
    maxHeaderSearchRows: 100, // Search more rows for Canara Bank
  },
};

/**
 * Get bank configuration by name or code
 */
export function getBankConfig(bankName: string): BankConfig | null {
  const normalized = bankName.trim();
  
  // Try exact match first
  if (BANK_CONFIGS[normalized]) {
    return BANK_CONFIGS[normalized];
  }
  
  // Try case-insensitive match
  for (const [key, config] of Object.entries(BANK_CONFIGS)) {
    if (key.toLowerCase() === normalized.toLowerCase() || 
        config.name.toLowerCase() === normalized.toLowerCase() ||
        config.code.toLowerCase() === normalized.toLowerCase()) {
      return config;
    }
  }
  
  // Return default HDFC config if not found (for backward compatibility)
  return BANK_CONFIGS.HDFC;
}

/**
 * Get all available banks
 */
export function getAvailableBanks(): BankConfig[] {
  return Object.values(BANK_CONFIGS);
}

/**
 * Get bank name for sheet naming
 */
export function getBankSheetPrefix(bankName: string): string {
  const config = getBankConfig(bankName);
  if (config) {
    return config.code;
  }
  // Fallback: use first 4 uppercase letters of bank name
  return bankName.substring(0, 4).toUpperCase().replace(/\s/g, '');
}

