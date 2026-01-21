# Multi-Bank Support Setup Guide

This application now supports multiple banks. Each bank's transactions are stored in separate sheets in Google Sheets.

## Supported Banks

- **HDFC Bank** (default)
- **Canara Bank**

## Sheet Naming Convention

Transactions are stored in bank-specific sheets:
- `HDFC_CreditTransactions` - HDFC credit transactions
- `HDFC_DebitTransactions` - HDFC debit transactions
- `Canara_CreditTransactions` - Canara credit transactions
- `Canara_DebitTransactions` - Canara debit transactions

## How It Works

1. **Bank Selection**: When uploading a bank statement, select the bank from the dropdown (HDFC or Canara).

2. **Transaction Mapping**: Transactions can be mapped across banks using the **Vyapar Reference Number**. This allows you to link related transactions from different banks.

3. **Automatic Sheet Creation**: The Google Apps Script will automatically create the appropriate sheets if they don't exist.

4. **Backward Compatibility**: Existing transactions without a bank field will default to HDFC and use the legacy sheet names (`Transactions` and `DebitTransactions`).

## Uploading Bank Statements

1. Go to **CSV Upload** page
2. Select the **Bank** (HDFC or Canara)
3. Select the **Transaction Type** (Credit, Debit, or Both)
4. Upload your bank statement file (CSV or Excel)
5. Review and save transactions

## Google Apps Script Updates

The Google Apps Script needs to be updated to handle bank-specific sheet names. The script will:
- Accept `sheetName` parameter (e.g., `HDFC_CreditTransactions`, `Canara_DebitTransactions`)
- Automatically create sheets if they don't exist
- Add headers to new sheets

## Adding New Banks

To add support for a new bank:

1. **Add Bank Configuration** (`src/services/bankConfig.ts`):
```typescript
NewBank: {
  name: "New Bank Name",
  code: "NewBank",
  dateColumns: ["Date", "Transaction Date"],
  narrationColumns: ["Narration", "Description"],
  depositColumns: ["Deposit", "Credit"],
  withdrawalColumns: ["Withdrawal", "Debit"],
  referenceColumns: ["Reference", "Ref"],
  skipPatterns: [/page no/i, /statement of account/i],
}
```

2. **Update CSV Upload** - The bank will automatically appear in the dropdown

3. **Sheets will be created automatically** when transactions are uploaded

## Vyapar Reference Number Mapping

The Vyapar Reference Number field allows you to link transactions across different banks:
- Enter the same Vyapar Reference Number for related transactions
- Use this to track payments/receipts that span multiple bank accounts
- The system will check for duplicate Vyapar Reference Numbers across all banks

## Notes

- Each bank's transactions are stored separately for better organization
- You can still view all transactions together in the Transactions/Debit Transactions pages
- The bank field is optional for backward compatibility (defaults to HDFC)

