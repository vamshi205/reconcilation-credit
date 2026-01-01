# 🔧 Date Fix - IMPORTANT: Update Google Apps Script

## The Problem
Dates are showing 1 day earlier (03 Jan showing as 02 Jan) because:
1. Google Apps Script returns Date objects
2. These get serialized to ISO strings with timezone (e.g., "2025-01-03T18:30:00.000Z")
3. When parsed, timezone conversion causes the date to shift

## The Solution
**You MUST update your Google Apps Script** to format dates as strings before returning them.

## Step-by-Step Instructions

### 1. Open Google Apps Script
- Go to your Google Sheet
- Click **Extensions** → **Apps Script**
- Or go to: https://script.google.com

### 2. Find the `getTransactions` Function
Look for code that starts with:
```javascript
if (action === 'getTransactions') {
```

### 3. Replace the Entire `getTransactions` Block
Replace it with this code (from `GOOGLE_SHEETS_SETUP.md` lines 242-295):

```javascript
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
  
  // Format dates as strings to avoid timezone issues
  // Date column is index 1 (second column, 0-indexed)
  const formattedRows = dataRows.map(function(row) {
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
  
  Logger.log('Returning ' + formattedRows.length + ' transactions with formatted dates');
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: formattedRows }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 4. Save the Script
- Click **Save** (💾 icon or Ctrl+S / Cmd+S)

### 5. Deploy the Updated Script
- Click **Deploy** → **Manage deployments**
- Click the **pencil icon** (edit) next to your current deployment
- Click **Deploy** to update it
- **OR** create a new deployment:
  - Click **Deploy** → **New deployment**
  - Select type: **Web app**
  - Execute as: **Me**
  - Who has access: **Anyone** (or your preference)
  - Click **Deploy**
  - Copy the new Web App URL

### 6. Update Vercel Environment Variable (if URL changed)
- If you created a new deployment, update `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL` in Vercel
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Update the URL if needed

### 7. Test
- Refresh your application
- Check if dates now match Google Sheets (no more 1-day delay)

## Why This Fixes It

- **Before**: Google Apps Script returns Date objects → JSON serializes to ISO strings → timezone conversion → wrong date
- **After**: Google Apps Script formats dates as "DD MMM YYYY" strings → no timezone conversion → correct date

## Important Notes

- The fix uses `getDate()`, `getMonth()`, `getFullYear()` which use the **local timezone of the Google Apps Script server**
- This matches what Google Sheets displays, so dates will be correct
- The client code now also handles ISO strings as a fallback, but the Google Apps Script fix is the primary solution

## Still Having Issues?

If dates are still wrong after updating:
1. Clear your browser cache
2. Check the browser console (F12) for any errors
3. Verify the Google Apps Script is deployed and the URL is correct
4. Check that dates in Google Sheets are actually correct

