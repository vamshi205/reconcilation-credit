# Complete Google Apps Script - All Functions

## ⚠️ IMPORTANT: You Only Need ONE Script File

Your Google Apps Script should contain **THREE functions** in the same file:

1. **`doPost`** - Handles saving/updating transactions (✅ Already working, don't change)
2. **`doGet`** - Handles fetching transactions (⚠️ Needs to be updated)
3. **`formatDateRows`** - Helper function for date formatting (⚠️ Must be included)

## Complete Script Structure

```javascript
// ============================================
// FUNCTION 1: doPost - SAVE/UPDATE TRANSACTIONS
// ============================================
// ⚠️ KEEP YOUR EXISTING doPost FUNCTION AS-IS
// It already handles bank-specific sheets correctly
// Don't change this function!

function doPost(e) {
  // ... your existing doPost code ...
  // This should already be working
}

// ============================================
// FUNCTION 2: doGet - FETCH TRANSACTIONS
// ============================================
// ⚠️ REPLACE YOUR EXISTING doGet WITH THIS UPDATED VERSION

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
      // Priority: 1. sheetName parameter, 2. Default 'Transactions' sheet
      let targetSheetName = sheetName || 'Transactions'; // Default to 'Transactions' for backward compatibility
      
      // If sheetName is a bank-specific sheet (e.g., "HDFC_CreditTransactions", "Canara_CreditTransactions")
      // use it directly, otherwise use default "Transactions"
      
      let sheet = spreadsheet.getSheetByName(targetSheetName);
      if (!sheet) {
        // If bank-specific sheet doesn't exist, fallback to default "Transactions" sheet
        Logger.log('Sheet ' + targetSheetName + ' not found, falling back to Transactions sheet');
        sheet = spreadsheet.getSheetByName('Transactions');
        if (!sheet) {
          // If Transactions sheet also doesn't exist, return empty array
          Logger.log('Transactions sheet also not found, returning empty array');
          return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        targetSheetName = 'Transactions'; // Update target name for logging
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
      // Priority: 1. sheetName parameter, 2. Default 'DebitTransactions' sheet
      let targetSheetName = sheetName || 'DebitTransactions'; // Default to 'DebitTransactions' for backward compatibility
      
      // If sheetName is a bank-specific sheet (e.g., "HDFC_DebitTransactions", "Canara_DebitTransactions")
      // use it directly, otherwise use default "DebitTransactions"
      
      let sheet = spreadsheet.getSheetByName(targetSheetName);
      if (!sheet) {
        // If bank-specific sheet doesn't exist, fallback to default "DebitTransactions" sheet
        Logger.log('Sheet ' + targetSheetName + ' not found, falling back to DebitTransactions sheet');
        sheet = spreadsheet.getSheetByName('DebitTransactions');
        if (!sheet) {
          // If DebitTransactions sheet also doesn't exist, return empty array
          Logger.log('DebitTransactions sheet also not found, returning empty array');
          return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        targetSheetName = 'DebitTransactions'; // Update target name for logging
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
      
      Logger.log('Returning ' + formattedRows.length + ' debit transactions from ' + targetSheetName);
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
        
    } else if (action === 'getSupplierMappings') {
      // Fetch all supplier mappings from the SupplierMappings sheet
      let sheet = spreadsheet.getSheetByName('SupplierMappings');
      if (!sheet) {
        // Create SupplierMappings sheet if it doesn't exist
        sheet = spreadsheet.insertSheet('SupplierMappings');
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
      
      Logger.log('Returning ' + dataRows.length + ' supplier mappings');
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: dataRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default response
    return ContentService.createTextOutput('Google Sheets API is running')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// FUNCTION 3: formatDateRows - HELPER FUNCTION
// ============================================
// ⚠️ MUST BE INCLUDED - Used by doGet function

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

## Summary

**You have ONE script file with THREE functions:**

1. ✅ **`doPost`** - Keep your existing one (already working)
2. ⚠️ **`doGet`** - Replace with the updated version above
3. ⚠️ **`formatDateRows`** - Add this helper function (required)

## What to Do

1. Open Google Apps Script editor
2. **Keep** your existing `doPost` function (don't change it)
3. **Replace** your existing `doGet` function with the updated version above
4. **Add** the `formatDateRows` function (if you don't have it)
5. **Save** the script
6. **Deploy** as a new version

That's it! All three functions should be in the same script file.

