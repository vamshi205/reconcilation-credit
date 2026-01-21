# Debugging Google Apps Script - Not Fetching Transactions

## Quick Test URLs

Test these URLs in your browser to see what the script returns:

### 1. Test Default (HDFC) - Should fetch from Transactions sheet:
```
https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec?action=getTransactions
```

### 2. Test Canara Credit - Should fetch from Canara_CreditTransactions sheet:
```
https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec?action=getTransactions&sheetName=Canara_CreditTransactions
```

### 3. Test Canara Debit - Should fetch from Canara_DebitTransactions sheet:
```
https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec?action=getDebitTransactions&sheetName=Canara_DebitTransactions
```

## Expected Responses

✅ **Success Response:**
```json
{"success":true,"data":[[...transaction rows...]]}
```

❌ **Error Response:**
```json
{"success":false,"error":"..."}
```

❌ **Empty Response (if sheet doesn't exist or is empty):**
```json
{"success":true,"data":[]}
```

## Common Issues & Solutions

### Issue 1: Script Not Updated
**Symptom:** Still returns old behavior or errors

**Solution:**
1. Open Google Apps Script editor
2. Make sure you replaced the ENTIRE `doGet` function
3. Click **Save** (Ctrl+S / Cmd+S)
4. Click **Deploy** → **Manage deployments**
5. Click the **pencil icon** (Edit) on your deployment
6. Click **New version** (or just click Deploy)
7. Click **Deploy**
8. Wait 1-2 minutes for deployment to propagate

### Issue 2: Sheet Doesn't Exist
**Symptom:** Returns `{"success":true,"data":[]}`

**Solution:**
1. Check if the sheet exists in your Google Spreadsheet:
   - `Canara_CreditTransactions`
   - `Canara_DebitTransactions`
2. If sheets don't exist, upload a Canara bank CSV first - it will create the sheets automatically

### Issue 3: Syntax Error in Script
**Symptom:** Returns error or "Google Sheets API is running" (default response)

**Solution:**
1. Open Google Apps Script editor
2. Click **Run** → Check for syntax errors (red underlines)
3. Check the **Executions** tab for error logs
4. Make sure you copied the ENTIRE `doGet` function correctly

### Issue 4: Authorization Required
**Symptom:** Returns HTML sign-in page instead of JSON

**Solution:**
1. Open the script URL in a new tab
2. Authorize the script
3. Try again

## Debugging Steps

### Step 1: Check Script Logs
1. Open Google Apps Script editor
2. Go to **Executions** tab
3. Look for recent executions
4. Click on an execution to see logs
5. Look for `Logger.log()` messages showing which sheet is being accessed

### Step 2: Verify doGet Function
Make sure your `doGet` function has:
- Line 14: `const sheetName = e.parameter && e.parameter.sheetName ? e.parameter.sheetName : null;`
- Line 20: `let targetSheetName = sheetName || 'Transactions';`
- Line 61: `let targetSheetName = sheetName || 'DebitTransactions';`

### Step 3: Test in Browser Console
Open browser console (F12) and run:
```javascript
// Test HDFC (should work)
fetch('https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec?action=getTransactions')
  .then(r => r.text())
  .then(console.log);

// Test Canara (might return empty if sheet doesn't exist)
fetch('https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec?action=getTransactions&sheetName=Canara_CreditTransactions')
  .then(r => r.text())
  .then(console.log);
```

### Step 4: Check Frontend Console
1. Open your app in browser
2. Open Developer Tools (F12)
3. Go to **Console** tab
4. Look for errors or logs like:
   - `Fetching credit transactions from Canara_CreditTransactions...`
   - `✓ Fetched X credit transactions from Canara`
   - Or error messages

## Quick Fix Checklist

- [ ] Updated `doGet` function in Google Apps Script
- [ ] Saved the script
- [ ] Deployed as new version
- [ ] Waited 1-2 minutes after deployment
- [ ] Tested URL directly in browser
- [ ] Checked if sheets exist in Google Spreadsheet
- [ ] Checked script execution logs for errors
- [ ] Verified frontend is sending correct `sheetName` parameter

## Still Not Working?

If none of the above works, please share:
1. What you see when you test the URLs above
2. Any errors from browser console (F12)
3. Any errors from Google Apps Script Executions tab
4. Which bank you're trying to fetch (HDFC or Canara)

