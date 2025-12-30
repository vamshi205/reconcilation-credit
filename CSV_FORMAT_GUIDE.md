# CSV Format Guide

## Supported CSV Formats

The app can automatically detect and parse common bank statement CSV formats. Here's what you need:

### Required Columns

Your CSV file should have headers in the first row with at least one of these column names:

**Date Column** (one of these):
- `Date`
- `Transaction Date`
- `Value Date`
- `Txn Date`

**Amount Columns** (one or both):
- `Credit` or `Deposit` or `CR` (for money received)
- `Debit` or `Withdrawal` or `DR` (for money paid)
- `Amount` (if single column, app will try to determine type)

**Description Column** (one of these):
- `Description`
- `Narration`
- `Particulars`
- `Remarks`
- `Details`

**Reference Column** (optional):
- `Reference`
- `Ref`
- `Cheque`
- `Transaction ID`

### Date Formats Supported

- `DD/MM/YYYY` (e.g., 01/01/2024)
- `DD-MM-YYYY` (e.g., 01-01-2024)
- `YYYY-MM-DD` (e.g., 2024-01-01)

### Example CSV Format

```csv
Date,Description,Credit,Debit,Balance,Reference
01/01/2024,UPI/PAYTM/1234567890/John Doe,5000,0,50000,TXN123456
02/01/2024,NEFT-987654321-Jane Smith,0,2000,48000,NEFT987654
03/01/2024,Salary Credit,50000,0,98000,SALARY001
```

### Common Bank Formats

#### HDFC Bank
```csv
Transaction Date,Value Date,Description,Debit,Credit,Balance
01/01/2024,01/01/2024,UPI Payment,0,5000,50000
```

#### ICICI Bank
```csv
Date,Narration,Debit Amount,Credit Amount,Balance
01/01/2024,UPI Payment,0,5000,50000
```

#### SBI Bank
```csv
Txn Date,Description,Debit,Credit,Balance
01/01/2024,UPI Payment,0,5000,50000
```

#### Axis Bank
```csv
Transaction Date,Description,Debit,Credit,Balance
01/01/2024,UPI Payment,0,5000,50000
```

### Tips

1. **Always include headers** - The first row must contain column names
2. **Use consistent date format** - Stick to one format throughout
3. **Numeric amounts** - Amount columns should contain numbers only (no currency symbols)
4. **No empty rows** - Remove blank rows between data
5. **Encoding** - Save CSV as UTF-8 encoding

### Testing

Use the provided `sample-bank-statement.csv` file to test the upload functionality.

### Troubleshooting

**"No transactions found" error:**
- Check if CSV has headers in first row
- Verify column names match supported formats
- Ensure date format is recognizable
- Check that amount columns contain numeric values

**"Failed to parse file" error:**
- Ensure file is a valid CSV (not Excel)
- Check file encoding (should be UTF-8)
- Verify CSV is not corrupted
- Try opening in Excel and re-saving as CSV

**Transactions not showing correctly:**
- Check browser console (F12) for detailed error messages
- Verify date format matches supported formats
- Ensure amounts are numeric (no commas or currency symbols in numbers)

