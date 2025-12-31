# Google Sheets Integration Setup Guide

This guide will help you set up automatic writing of transactions to Google Sheets when you upload CSV files.

## Step 1: Create Google Apps Script

1. Open your Google Sheet (or create a new one)
2. Go to **Extensions** → **Apps Script**
3. Delete any existing code
4. Copy and paste this code:

```javascript
function doPost(e) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    // Use Transactions sheet (or create it if it doesn't exist)
    let sheet = spreadsheet.getSheetByName('Transactions');
    if (!sheet) {
      sheet = spreadsheet.getActiveSheet();
      // If active sheet is not Transactions, create it
      if (sheet.getName() !== 'Transactions') {
        sheet = spreadsheet.insertSheet('Transactions');
      }
    }
    
    // Log received parameters for debugging
    Logger.log('Received parameters: ' + JSON.stringify(e.parameter));
    Logger.log('PostData: ' + (e.postData ? e.postData.contents : 'none'));
    
    // Handle form data (URL-encoded) - supports both single row and batch
    let action, dataArray;
    
    if (e.parameter && e.parameter.action) {
      action = e.parameter.action;
      try {
        // data is sent as JSON string, parse it
        dataArray = JSON.parse(e.parameter.data);
        Logger.log('Parsed data, action: ' + action + ', rows: ' + (Array.isArray(dataArray[0]) ? dataArray.length : 1));
      } catch (parseError) {
        Logger.log('Error parsing data: ' + parseError.toString());
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Failed to parse data: ' + parseError.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    } else if (e.postData && e.postData.contents) {
      // JSON payload (fallback)
      const data = JSON.parse(e.postData.contents);
      action = data.action;
      dataArray = data.data;
    } else {
      Logger.log('No valid data received');
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'No data received. Parameters: ' + JSON.stringify(e.parameter) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Add headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Transaction ID',
        'Date',
        'Narration',
        'Bank Ref No.',
        'Amount',
        'Party Name',
        'Category',
        'Type',
        'Added to Vyapar',
        'Vyapar Ref No.',
        'Hold',
        'Notes',
        'Created At',
        'Updated At'
      ]);
    }
    
    if (action === 'appendRow') {
      // Single row append
      sheet.appendRow(dataArray);
      Logger.log('Successfully appended 1 row to sheet');
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'updateRow') {
      // Update existing row by Transaction ID or fallback matching
      const transactionId = e.parameter.transactionId;
      if (!transactionId) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Transaction ID required' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Parse the new row data
      const rowData = JSON.parse(e.parameter.data);
      
      // Find the row with matching Transaction ID (first column)
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      let rowIndex = -1;
      
      // Skip header row (row 0), search from row 1
      // First try: Match by Transaction ID (column 0)
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === transactionId) {
          rowIndex = i + 1; // +1 because sheet rows are 1-indexed
          Logger.log('Found transaction by ID at row ' + rowIndex);
          break;
        }
      }
      
      // Fallback: If ID not found, try matching by Date + Amount + Reference Number
      // Column order: [ID, Date, Narration, Bank Ref No., Amount, ...]
      if (rowIndex === -1) {
        Logger.log('Transaction ID not found, trying fallback matching...');
        const newDate = rowData[1]; // Date (column 1)
        const newAmount = rowData[4]; // Amount (column 4)
        const newRefNo = rowData[3] || ''; // Bank Ref No. (column 3)
        const newNarration = rowData[2] || ''; // Narration (column 2)
        
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          const rowDate = row[1]; // Date
          const rowAmount = row[4]; // Amount
          const rowRefNo = row[3] || ''; // Bank Ref No.
          const rowNarration = row[2] || ''; // Narration
          
          // Match by Date + Amount + Reference Number (if available)
          if (rowDate === newDate && rowAmount === newAmount) {
            if (newRefNo && rowRefNo === newRefNo) {
              // Perfect match with reference number
              rowIndex = i + 1;
              Logger.log('Found transaction by Date + Amount + Ref No. at row ' + rowIndex);
              break;
            } else if (!newRefNo && !rowRefNo && rowNarration === newNarration) {
              // Match by Date + Amount + Narration (when no ref number)
              rowIndex = i + 1;
              Logger.log('Found transaction by Date + Amount + Narration at row ' + rowIndex);
              break;
            }
          }
        }
      }
      
      if (rowIndex === -1) {
        Logger.log('Transaction not found by ID or fallback matching. ID: ' + transactionId);
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Transaction not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Update the row with new data (including the Transaction ID)
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      
      Logger.log('Successfully updated row ' + rowIndex + ' for transaction ID: ' + transactionId);
      return ContentService.createTextOutput(JSON.stringify({ success: true, row: rowIndex }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'appendRows') {
      // Batch append - multiple rows at once (much faster!)
      Logger.log('Appending ' + dataArray.length + ' rows to sheet');
      
      if (dataArray.length > 0) {
        // Use setValues for batch insert (more efficient than appendRow in a loop)
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, dataArray.length, dataArray[0].length).setValues(dataArray);
      }
      
      Logger.log('Successfully appended ' + dataArray.length + ' rows to sheet');
      return ContentService.createTextOutput(JSON.stringify({ success: true, count: dataArray.length }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'appendPartyMapping') {
      // Append party mapping to PartyMappings sheet
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      let mappingSheet = spreadsheet.getSheetByName('PartyMappings');
      if (!mappingSheet) {
        // Create PartyMappings sheet if it doesn't exist
        mappingSheet = spreadsheet.insertSheet('PartyMappings');
        mappingSheet.appendRow(['ID', 'Original Name', 'Corrected Name', 'Confidence', 'Last Used', 'Created At']);
      }
      
      // If this is the first row, headers are already added
      const rowData = JSON.parse(e.parameter.data);
      mappingSheet.appendRow(rowData);
      
      Logger.log('Successfully appended party mapping');
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'updatePartyMapping') {
      // Update existing party mapping by ID
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      let mappingSheet = spreadsheet.getSheetByName('PartyMappings');
      if (!mappingSheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'PartyMappings sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const mappingId = e.parameter.mappingId;
      const rowData = JSON.parse(e.parameter.data);
      
      // Find the row with matching ID (first column)
      const dataRange = mappingSheet.getDataRange();
      const values = dataRange.getValues();
      let rowIndex = -1;
      
      // Skip header row, search from row 1
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === mappingId) {
          rowIndex = i + 1; // +1 because sheet rows are 1-indexed
          break;
        }
      }
      
      if (rowIndex === -1) {
        Logger.log('Party mapping ID not found: ' + mappingId);
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Mapping not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Update the row
      mappingSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      
      Logger.log('Successfully updated party mapping at row ' + rowIndex);
      return ContentService.createTextOutput(JSON.stringify({ success: true, row: rowIndex }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getTransactions') {
      // Fetch all transactions from the Transactions sheet
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = spreadsheet.getSheetByName('Transactions');
      if (!sheet) {
        // Fallback to active sheet if Transactions sheet doesn't exist
        sheet = spreadsheet.getActiveSheet();
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
      
      Logger.log('Returning ' + dataRows.length + ' transactions');
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: dataRows }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'getPartyMappings') {
      // Fetch all party mappings from the PartyMappings sheet
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = spreadsheet.getSheetByName('PartyMappings');
      if (!sheet) {
        // Create PartyMappings sheet if it doesn't exist
        sheet = spreadsheet.insertSheet('PartyMappings');
        sheet.appendRow(['ID', 'Original Name', 'Corrected Name', 'Confidence', 'Last Used', 'Created At']);
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
      
      Logger.log('Returning ' + dataRows.length + ' party mappings');
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: dataRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default response
    return ContentService.createTextOutput('Google Sheets API is running')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Step 2: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type" → Choose **Web app**
3. Set:
   - **Description**: "Credit Transactions API"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone" (or "Anyone with Google account" for more security)
4. Click **Deploy**
5. **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/.../exec`)

## Step 3: Update Your App

1. Open: `src/services/googleSheetsService.ts`
2. Find this line:
   ```typescript
   const APPS_SCRIPT_URL = ''; // Add your Google Apps Script web app URL here
   ```
3. Replace the empty string with your Web App URL:
   ```typescript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
   ```

## Step 4: Authorize the Script

1. When you first run the script, Google will ask for authorization
2. Click **Review Permissions**
3. Choose your Google account
4. Click **Advanced** → **Go to [Your Project Name] (unsafe)**
5. Click **Allow**

## Step 5: Test It

1. Upload a CSV file with transactions
2. Click "Save Transactions"
3. Check your Google Sheet - the transactions should appear automatically!

## How It Works

- When you upload CSV and save transactions, they are automatically written to Google Sheets
- Each transaction appears as a new row
- If the sheet is empty, headers are automatically added
- Transactions are saved one by one with a small delay to avoid rate limiting

## Troubleshooting

### "Google Apps Script URL not configured"
- Make sure you've added the Web App URL to `googleSheetsService.ts`
- The URL should start with `https://script.google.com/macros/s/`

### "Failed to save to Google Sheets"
- Check that the script is deployed and authorized
- Make sure "Who has access" is set to "Anyone" or "Anyone with Google account"
- Verify the sheet is not protected/read-only
- Check the browser console for detailed error messages

### Data not appearing in Google Sheets
- Check the sheet name matches (default is "Sheet1")
- Verify you're looking at the correct sheet
- Make sure there are no empty rows at the top (headers should be in row 1)
- Check the Apps Script execution log for errors

### Rate Limiting
- If you're uploading many transactions, they're saved with a 100ms delay between each
- For very large batches (100+ transactions), you may need to wait a bit

## Column Structure

The following columns are written to Google Sheets:
1. Date
2. Narration
3. Bank Ref No.
4. Amount
5. Party Name
6. Category
7. Type
8. Added to Vyapar (Yes/No)
9. Vyapar Ref No.
10. Hold (Yes/No)
11. Notes
12. Created At
13. Updated At

## Notes

- The Google Sheets integration is optional - if not configured, transactions will still be saved locally
- You can configure it later without losing any data
- The service gracefully handles errors and won't break the CSV upload if Google Sheets fails

