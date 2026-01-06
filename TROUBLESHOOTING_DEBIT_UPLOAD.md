# Troubleshooting Debit Transactions Upload

## Issues Fixed:

1. ✅ **Test Connection Alert**: Now shows clear success message without authorization link when connection is successful
2. ✅ **Better Error Messages**: Upload errors now show detailed information about what failed
3. ✅ **Improved Logging**: Console now shows detailed logs for debit transaction uploads

## Current Status:

The frontend code is now:
- ✅ Sending debit transactions to `DebitTransactions` sheet (no space)
- ✅ Using `sheetName` parameter in the payload
- ✅ Logging detailed information to console

## What You Need to Check:

### 1. Google Apps Script Sheet Name

**IMPORTANT**: Your Google Apps Script must use the exact sheet name `DebitTransactions` (no space).

**Check your Google Apps Script:**
- Open your Google Apps Script editor
- Look for the sheet name in the `appendRows` action handler
- It should be: `'DebitTransactions'` (no space)
- NOT: `'Debit Transactions'` (with space)

### 2. Update Your Google Apps Script

Your current script uses separate actions (`appendDebitRow`, `appendDebitRows`), but the frontend now uses the unified approach with `sheetName` parameter.

**You MUST update your Google Apps Script** with the code from `GOOGLE_SHEETS_SETUP_UPDATED.md`.

### 3. Verify Sheet Exists

1. Open your Google Sheet
2. Check if you have a sheet named exactly: `DebitTransactions` (no space)
3. If you have `Debit Transactions` (with space), rename it to `DebitTransactions` (no space)

### 4. Check Browser Console

When uploading debit transactions:
1. Open browser console (F12)
2. Look for logs like:
   - `📤 Sending batch to DebitTransactions sheet:`
   - `✓ Successfully sent X debit transactions to DebitTransactions sheet`
3. If you see errors, they will show what went wrong

### 5. Test Upload

1. Go to CSV Upload page
2. Select "Debit Transactions Only" from dropdown
3. Upload a file with withdrawal amounts
4. Check browser console for logs
5. Check Google Sheet to see if data appears

## Quick Fix Checklist:

- [ ] Updated Google Apps Script with code from `GOOGLE_SHEETS_SETUP_UPDATED.md`
- [ ] Sheet name is exactly `DebitTransactions` (no space) in Google Sheets
- [ ] Sheet name is exactly `DebitTransactions` (no space) in Google Apps Script
- [ ] Test connection shows success (no authorization link)
- [ ] Browser console shows logs when uploading
- [ ] Check Google Sheet after upload to verify data

## If Still Not Working:

1. **Check Browser Console** (F12 → Console tab):
   - Look for any red error messages
   - Look for logs starting with `📤` or `✓` or `❌`

2. **Check Google Apps Script Logs**:
   - Open Google Apps Script editor
   - Go to Executions tab
   - Check recent executions for errors

3. **Verify Sheet Name**:
   - In Google Sheets, the sheet tab should say exactly: `DebitTransactions`
   - In Google Apps Script, search for `DebitTransactions` and verify it matches

4. **Test with Credit Transactions**:
   - Try uploading credit transactions first
   - If credit works but debit doesn't, the issue is with the sheet name or script routing

## Most Common Issue:

**Sheet name mismatch**: The frontend sends to `DebitTransactions` (no space), but your script might be looking for `Debit Transactions` (with space).

**Solution**: Either:
- Rename the sheet in Google Sheets to `DebitTransactions` (no space), OR
- Update the frontend code to use `Debit Transactions` (with space)

I recommend renaming the sheet to match the frontend (`DebitTransactions`).

