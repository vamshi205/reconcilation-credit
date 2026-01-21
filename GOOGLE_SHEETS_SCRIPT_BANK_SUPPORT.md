# Google Apps Script Update for Bank-Specific Sheets

## Overview

The frontend now supports fetching transactions from bank-specific sheets. The Google Apps Script needs to be updated to support the `sheetName` parameter in GET requests.

## Required Changes to Google Apps Script

### Update `doGet` function to handle `sheetName` parameter:

```javascript
function doGet(e) {
  try {
    if (!e) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Event object is undefined' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const action = e.parameter && e.parameter.action ? e.parameter.action : null;
    const sheetName = e.parameter && e.parameter.sheetName ? e.parameter.sheetName : null;
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'getTransactions') {
      // Determine which sheet to fetch from
      let targetSheetName = sheetName || 'Transactions'; // Default to 'Transactions' for backward compatibility
      
      // If sheetName is a bank-specific sheet (e.g., "HDFC_CreditTransactions", "Canara_CreditTransactions")
      // use it directly, otherwise use default "Transactions"
      
      let sheet = spreadsheet.getSheetByName(targetSheetName);
      if (!sheet) {
        // If bank-specific sheet doesn't exist, fallback to default "Transactions" sheet
        sheet = spreadsheet.getSheetByName('Transactions');
        if (!sheet) {
          // If Transactions sheet also doesn't exist, return empty array
          return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // Skip header row (row 0)
      if (values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Get all data rows (skip header)
      const dataRows = values.slice(1);
      
      // Format dates as strings to avoid timezone issues
      const formattedRows = formatDateRows(dataRows);
      
      Logger.log('Returning ' + formattedRows.length + ' credit transactions from ' + targetSheetName);
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: formattedRows }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'getDebitTransactions') {
      // Determine which sheet to fetch from
      let targetSheetName = sheetName || 'DebitTransactions'; // Default to 'DebitTransactions' for backward compatibility
      
      // If sheetName is a bank-specific sheet (e.g., "HDFC_DebitTransactions", "Canara_DebitTransactions")
      // use it directly, otherwise use default "DebitTransactions"
      
      let sheet = spreadsheet.getSheetByName(targetSheetName);
      if (!sheet) {
        // If bank-specific sheet doesn't exist, fallback to default "DebitTransactions" sheet
        sheet = spreadsheet.getSheetByName('DebitTransactions');
        if (!sheet) {
          // If DebitTransactions sheet also doesn't exist, return empty array
          return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      const dataRange = sheet.getDataRange();
      const values = dataRange.getDataRange();
      
      // Skip header row (row 0)
      if (values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Get all data rows (skip header)
      const dataRows = values.slice(1);
      
      // Format dates as strings to avoid timezone issues
      const formattedRows = formatDateRows(dataRows);
      
      Logger.log('Returning ' + formattedRows.length + ' debit transactions from ' + targetSheetName);
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: formattedRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ... rest of your doGet function ...
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Sheet Naming Convention

The frontend expects these sheet names:
- **Credit Transactions**:
  - `HDFC_CreditTransactions` - HDFC credit transactions
  - `Canara_CreditTransactions` - Canara credit transactions
  - `Transactions` - Legacy/default (for backward compatibility)

- **Debit Transactions**:
  - `HDFC_DebitTransactions` - HDFC debit transactions
  - `Canara_DebitTransactions` - Canara debit transactions
  - `DebitTransactions` - Legacy/default (for backward compatibility)

## How It Works

1. **Frontend sends request**: `?action=getTransactions&sheetName=Canara_CreditTransactions`
2. **Script checks for sheet**: Looks for `Canara_CreditTransactions` sheet
3. **Fallback**: If sheet doesn't exist, falls back to `Transactions` sheet
4. **Returns data**: Returns transactions from the found sheet

## Backward Compatibility

- If `sheetName` is not provided, defaults to `Transactions` or `DebitTransactions`
- Existing HDFC transactions continue to work without changes
- Legacy sheets are still supported

## Testing

After updating the script:
1. Deploy as a new version
2. Test fetching from `HDFC_CreditTransactions` sheet
3. Test fetching from `Canara_CreditTransactions` sheet
4. Verify fallback to `Transactions` sheet if bank-specific sheet doesn't exist

