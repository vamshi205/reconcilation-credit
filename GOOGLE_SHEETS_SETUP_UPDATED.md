# Updated Google Apps Script - Unified Approach

Copy and paste this updated script into your Google Apps Script editor. This version uses the `sheetName` parameter to route transactions to the correct sheet, matching the frontend implementation.

```javascript
function doPost(e) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
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
    
    // Helper function to get or create a sheet
    function getOrCreateSheet(sheetName) {
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
        // Add headers
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
          'Self Transfer',
          'Notes',
          'Created At',
          'Updated At'
        ]);
        Logger.log('Created new sheet: ' + sheetName);
      } else {
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
            'Self Transfer',
            'Notes',
            'Created At',
            'Updated At'
          ]);
        }
      }
      return sheet;
    }
    
    if (action === 'appendRow') {
      // Single row append
      // Check if sheetName parameter is provided, otherwise use default or determine from transaction type
      let targetSheetName = e.parameter.sheetName || 'Transactions';
      
      // If no sheetName provided, check transaction type in row data (column 7, index 7)
      if (!e.parameter.sheetName && dataArray.length > 7) {
        const transactionType = dataArray[7]; // Type column (index 7)
        if (transactionType === 'debit') {
          targetSheetName = 'DebitTransactions';
        }
      }
      
      const sheet = getOrCreateSheet(targetSheetName);
      sheet.appendRow(dataArray);
      Logger.log('Successfully appended 1 row to ' + targetSheetName + ' sheet');
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheet: targetSheetName }))
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
      
      // Determine which sheet to update based on sheetName parameter or transaction type
      let targetSheetName = e.parameter.sheetName || 'Transactions';
      
      // If no sheetName provided, check transaction type in row data (column 7, index 7)
      if (!e.parameter.sheetName && rowData.length > 7) {
        const transactionType = rowData[7]; // Type column (index 7)
        if (transactionType === 'debit') {
          targetSheetName = 'DebitTransactions';
        }
      }
      
      // Get the target sheet
      let targetSheet = spreadsheet.getSheetByName(targetSheetName);
      if (!targetSheet) {
        Logger.log('Sheet not found: ' + targetSheetName);
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Sheet not found: ' + targetSheetName }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Find the row with matching Transaction ID (first column)
      const dataRange = targetSheet.getDataRange();
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
      
      // CRITICAL: Preserve original date from sheet - Date should NEVER be updated
      // Date column is index 1 (second column, 0-indexed)
      const existingRow = values[rowIndex - 1]; // rowIndex is 1-indexed, values array is 0-indexed
      const originalDate = existingRow[1]; // Get original date from existing row
      
      // Preserve the original date - do NOT update it
      rowData[1] = originalDate;
      Logger.log('🔒 Preserving original date: ' + originalDate + ' (Date updates are FORBIDDEN)');
      
      // Update the row with new data, but with preserved original date
      targetSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      
      Logger.log('Successfully updated row ' + rowIndex + ' in ' + targetSheetName + ' sheet for transaction ID: ' + transactionId + ' (date preserved)');
      return ContentService.createTextOutput(JSON.stringify({ success: true, row: rowIndex, sheet: targetSheetName }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'appendRows') {
      // Batch append - multiple rows at once (much faster!)
      // Check if sheetName parameter is provided, otherwise use default or determine from transaction type
      let targetSheetName = e.parameter.sheetName || 'Transactions';
      
      // If no sheetName provided, check transaction type in first row (column 7, index 7)
      if (!e.parameter.sheetName && dataArray.length > 0 && dataArray[0].length > 7) {
        const transactionType = dataArray[0][7]; // Type column (index 7)
        if (transactionType === 'debit') {
          targetSheetName = 'DebitTransactions';
        }
      }
      
      const sheet = getOrCreateSheet(targetSheetName);
      
      Logger.log('Appending ' + dataArray.length + ' rows to sheet: ' + targetSheetName);
      
      if (dataArray.length > 0) {
        // Use setValues for batch insert (more efficient than appendRow in a loop)
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, dataArray.length, dataArray[0].length).setValues(dataArray);
      }
      
      Logger.log('Successfully appended ' + dataArray.length + ' rows to ' + targetSheetName + ' sheet');
      return ContentService.createTextOutput(JSON.stringify({ success: true, count: dataArray.length, sheet: targetSheetName }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'appendPartyMapping') {
      // Append party mapping to PartyMappings sheet
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
    
    // Unknown action
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'getTransactions') {
      // Fetch all transactions from the Transactions sheet
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
      
      // Format dates as strings to avoid timezone issues
      const formattedRows = formatDateRows(dataRows);
      
      Logger.log('Returning ' + formattedRows.length + ' credit transactions with formatted dates');
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: formattedRows }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'getDebitTransactions') {
      // Fetch all debit transactions from the DebitTransactions sheet
      let sheet = spreadsheet.getSheetByName('DebitTransactions');
      if (!sheet) {
        // Return empty array if DebitTransactions sheet doesn't exist
        Logger.log('DebitTransactions sheet not found, returning empty array');
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
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
      
      Logger.log('Returning ' + formattedRows.length + ' debit transactions with formatted dates');
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: formattedRows }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'getPartyMappings') {
      // Fetch all party mappings from the PartyMappings sheet
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
        
    } else if (action === 'getParties') {
      // Fetch all parties from the Parties sheet (for word-by-word matching)
      let sheet = spreadsheet.getSheetByName('Parties');
      if (!sheet) {
        // Create Parties sheet if it doesn't exist
        sheet = spreadsheet.insertSheet('Parties');
        sheet.appendRow(['Party Name']); // Header row
      }
      
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // Skip header row (row 0)
      if (values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Get all data rows (skip header) - each row contains a party name in the first column
      const dataRows = values.slice(1).map(row => [row[0] || '']); // Only return first column (party name)
      
      Logger.log('Returning ' + dataRows.length + ' parties');
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: dataRows }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'getSuppliers') {
      // Fetch all suppliers from the Suppliers sheet (for word-by-word matching in debit transactions)
      let sheet = spreadsheet.getSheetByName('Suppliers');
      if (!sheet) {
        // Create Suppliers sheet if it doesn't exist
        sheet = spreadsheet.insertSheet('Suppliers');
        sheet.appendRow(['Supplier Name']); // Header row
      }
      
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // Skip header row (row 0)
      if (values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Get all data rows (skip header) - each row contains a supplier name in the first column
      const dataRows = values.slice(1).map(row => [row[0] || '']); // Only return first column (supplier name)
      
      Logger.log('Returning ' + dataRows.length + ' suppliers');
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

// Helper function to format date rows
function formatDateRows(dataRows) {
  return dataRows.map(function(row) {
    const formattedRow = row.slice(); // Copy the row
    
    // Format date column (index 1) as "DD MMM YYYY" string
    if (formattedRow[1] instanceof Date) {
      const date = formattedRow[1];
      var day = date.getDate();
      day = day < 10 ? '0' + day : String(day);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      formattedRow[1] = day + ' ' + month + ' ' + year; // "DD MMM YYYY" format
    } else if (formattedRow[1]) {
      // If it's already a string, keep it as-is
      formattedRow[1] = String(formattedRow[1]);
    }
    
    // Format Created At (index 13) and Updated At (index 14) if they exist
    if (formattedRow[13] instanceof Date) {
      const date = formattedRow[13];
      var day = date.getDate();
      day = day < 10 ? '0' + day : String(day);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      formattedRow[13] = day + ' ' + month + ' ' + year;
    }
    
    if (formattedRow[14] instanceof Date) {
      const date = formattedRow[14];
      var day = date.getDate();
      day = day < 10 ? '0' + day : String(day);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      formattedRow[14] = day + ' ' + month + ' ' + year;
    }
    
    return formattedRow;
  });
}
```

## Key Changes from Your Current Script:

1. **Unified Actions**: Uses the same actions (`appendRow`, `appendRows`, `updateRow`) for both credit and debit transactions, routing via the `sheetName` parameter
2. **Sheet Name**: Uses "DebitTransactions" (no space) to match the frontend
3. **Automatic Routing**: If `sheetName` is not provided, it determines the sheet from the transaction type (column 7)
4. **Helper Function**: Added `getOrCreateSheet()` to reduce code duplication
5. **Date Formatting**: Extracted to a helper function `formatDateRows()` for reuse

## Migration Note:

If you have existing data in "Debit Transactions" (with space), you can either:
1. Rename the sheet to "DebitTransactions" (no space) in Google Sheets
2. Or update the frontend to use "Debit Transactions" (with space)

I recommend option 1 (renaming the sheet) to match the frontend code.

