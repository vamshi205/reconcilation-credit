# Quick Start Guide - Credit Records Manager

## Installation

```bash
cd add-credit-trans
npm install
```

## Running the App

```bash
npm run dev
```

The app will be available at `http://127.0.0.1:8082`

## Features Overview

### 1. **Dashboard**
- View total credits, debits, and net balance
- See pending sync count (transactions not yet entered in Vyapar)
- Quick stats and workflow guide

### 2. **Manual Entry**
- Add transactions one by one
- Fill in: date, amount, description, type (credit/debit), category, party name
- Automatically creates/updates party records

### 3. **CSV Upload**
- Upload bank statement CSV files
- Auto-parses common formats (HDFC, ICICI, SBI, Axis, etc.)
- Auto-categorizes transactions
- Preview before saving
- Bulk import all transactions at once

### 4. **Transactions**
- View all transactions with filters
- Search by description, party name, or reference number
- Filter by type (credit/debit), category, or Vyapar sync status
- Delete transactions if needed

### 5. **Reconciliation**
- See all pending transactions (not yet in Vyapar)
- Check the box when you've entered transaction in Vyapar
- Track sync status
- Bulk mark as synced

### 6. **Parties**
- View all customers and suppliers
- See balances (positive = owes you, negative = you owe)
- Track total credits and debits per party
- See last transaction date

## Workflow

1. **Add Transactions**
   - Option A: Manual Entry - Add one transaction at a time
   - Option B: CSV Upload - Bulk import from bank statement

2. **Review & Categorize**
   - Go to Transactions page
   - Review imported transactions
   - Edit categories if needed

3. **Enter in Vyapar**
   - Manually enter transactions in Vyapar app
   - Go to Reconciliation page

4. **Mark as Synced**
   - Check the checkbox next to each transaction you've entered in Vyapar
   - Track what's pending vs synced

## CSV Format Support

The app automatically detects common bank statement formats:
- Date columns: "Date", "Transaction Date", "Value Date"
- Amount columns: "Credit", "Debit", "Amount"
- Description: "Description", "Narration", "Particulars", "Remarks"
- Reference: "Reference", "Ref", "Cheque", "Transaction ID"

**Supported Date Formats:**
- DD/MM/YYYY
- DD-MM-YYYY
- YYYY-MM-DD

## Data Storage

Currently uses **localStorage** (browser storage). Your data is stored locally in your browser.

**To backup your data:**
- Export from browser DevTools → Application → Local Storage
- Or we can add export/import feature later

**Future: Google Sheets Integration**
- Can be upgraded to sync with Google Sheets (like your other projects)
- Keeps data accessible from anywhere
- Can share with accountant

## Tips

- **Regular Sync**: Mark transactions as synced daily/weekly
- **Party Names**: Use consistent names for same customers/suppliers
- **Categories**: Helps with reporting and analysis
- **Reference Numbers**: Useful for matching with bank statements

## Troubleshooting

**CSV not parsing correctly?**
- Check if CSV has headers in first row
- Ensure date format is recognizable (DD/MM/YYYY recommended)
- Make sure amount columns are numeric

**Transactions not showing?**
- Check filters on Transactions page
- Clear search query
- Verify transaction was saved (check Dashboard count)

**Party balance incorrect?**
- Parties are auto-created from transactions
- Balance = Total Credits - Total Debits
- For customers: positive balance = they owe you
- For suppliers: negative balance = you owe them

## Next Steps

1. Start by adding a few transactions manually
2. Try uploading a CSV from your bank
3. Review and categorize
4. Enter in Vyapar and mark as synced
5. Check Dashboard for overview

Enjoy managing your credit records! 🎉

