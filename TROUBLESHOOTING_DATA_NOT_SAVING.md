# Troubleshooting: Data Not Saving to Google Sheets

## Issue
Transactions appear to be sent successfully (console shows "✓ Successfully sent"), but no data appears in Google Sheets.

## Root Cause
The iframe method used to send data doesn't verify if the save was actually successful. It just submits the form and assumes it worked.

## Solutions

### 1. Check Google Apps Script Execution Logs

**This is the most important step:**

1. Open your Google Apps Script editor
2. Go to **Executions** tab (left sidebar)
3. Look for recent executions when you tried to upload
4. Click on an execution to see:
   - What parameters were received
   - Any errors that occurred
   - What sheet it tried to write to

**Look for:**
- Errors in the logs
- Whether `sheetName` parameter is being received
- Whether data is being parsed correctly
- Which sheet it's trying to write to

### 2. Verify Google Apps Script Has All Required Actions

Make sure your script includes:
- ✅ `appendRows` action (for batch uploads)
- ✅ `appendRow` action (for single transactions)
- ✅ `getDebitTransactions` action
- ✅ `getSupplierMappings` action (NEW - added in latest fix)

### 3. Check Sheet Names

Verify in your Google Sheet:
- Sheet named exactly: `DebitTransactions` (no space, case-sensitive)
- Sheet named exactly: `Transactions` (for credit)

### 4. Test the Script Directly

1. In Google Apps Script editor, click **Run** on the `doPost` function
2. It will ask for parameters - this is expected
3. Check the logs to see what happens

### 5. Manual Test

Try this in the browser console after uploading:

```javascript
// Check if data was actually sent
fetch('YOUR_APPS_SCRIPT_URL?action=getDebitTransactions')
  .then(r => r.text())
  .then(text => console.log('Response:', text));
```

Replace `YOUR_APPS_SCRIPT_URL` with your actual script URL.

## Updated Script

The latest script in `GOOGLE_SHEETS_SCRIPT_FIXED.md` now includes:
- ✅ `getSupplierMappings` action (was missing)
- ✅ Better error handling
- ✅ More detailed logging

**Action Required:**
1. Copy the updated script from `GOOGLE_SHEETS_SCRIPT_FIXED.md`
2. Replace your current Google Apps Script
3. Save and redeploy
4. Try uploading again
5. Check the Executions tab for detailed logs

## Common Issues

### Issue: "Sheet not found"
- **Fix**: The script will create the sheet automatically, but check the sheet name matches exactly

### Issue: "No data received"
- **Fix**: Check that the form is submitting correctly. Look at browser Network tab to see the POST request

### Issue: Data goes to wrong sheet
- **Fix**: Verify `sheetName` parameter is being sent. Check console logs for `📤 Sending batch to...`

### Issue: Script returns HTML instead of JSON
- **Fix**: This usually means the action doesn't exist. Make sure all actions are in the script.

## Next Steps

1. **Check Executions tab** - This will tell you exactly what's happening
2. **Update the script** - Use the latest version from `GOOGLE_SHEETS_SCRIPT_FIXED.md`
3. **Redeploy** - After updating, create a new deployment
4. **Test again** - Upload a small file and check both:
   - Browser console for frontend logs
   - Google Apps Script Executions tab for backend logs

