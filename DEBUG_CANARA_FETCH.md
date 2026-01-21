# Debugging Canara Bank Transactions Not Fetching

## Issue: Canara transactions not showing up

Let's debug step by step:

## Step 1: Check Browser Console

Open your browser console (F12) and look for these logs when you select Canara bank:

**Expected logs:**
```
Fetching credit transactions from Canara_CreditTransactions...
✓ Fetched X credit transactions from Canara
```

**If you see errors, note them down.**

## Step 2: Test the Script URL Directly

Test these URLs in your browser:

### Test Canara Credit Transactions:
```
https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec?action=getTransactions&sheetName=Canara_CreditTransactions
```

**Expected response:**
```json
{"success":true,"data":[[...transaction rows...]]}
```

**If empty:**
```json
{"success":true,"data":[]}
```
(This means the sheet exists but is empty, OR the sheet doesn't exist and it fell back to Transactions sheet)

**If error:**
```json
{"success":false,"error":"..."}
```

## Step 3: Check if Sheet Exists

1. Open your Google Spreadsheet
2. Look for a tab named: **`Canara_CreditTransactions`**
3. If it doesn't exist:
   - You need to upload a Canara bank CSV first
   - The sheet will be created automatically when you upload

## Step 4: Check Bank Code Mapping

The frontend uses the bank **code** from `bankConfig.ts`:
- Canara bank code: `"Canara"`
- Sheet name should be: `Canara_CreditTransactions`

Verify in browser console:
1. Open console (F12)
2. Select Canara bank from dropdown
3. Look for log: `Fetching credit transactions from Canara_CreditTransactions...`
4. If you see a different sheet name, that's the issue

## Step 5: Check Google Apps Script Logs

1. Open Google Apps Script editor
2. Go to **Executions** tab
3. Look for recent executions
4. Click on one to see logs
5. Look for: `Returning X credit transactions from Canara_CreditTransactions`

## Common Issues & Solutions

### Issue 1: Sheet Doesn't Exist
**Symptom:** Returns `{"success":true,"data":[]}`

**Solution:**
- Upload a Canara bank CSV file first
- This will create the `Canara_CreditTransactions` sheet automatically

### Issue 2: Wrong Sheet Name
**Symptom:** Script returns data from wrong sheet

**Check:**
- Browser console should show: `Fetching credit transactions from Canara_CreditTransactions...`
- If it shows a different name, the bank code mapping is wrong

### Issue 3: Script Not Reading sheetName Parameter
**Symptom:** Always returns data from `Transactions` sheet regardless of `sheetName`

**Solution:**
- Make sure your `doGet` function has:
  ```javascript
  const sheetName = e.parameter && e.parameter.sheetName ? e.parameter.sheetName : null;
  ```
- And uses it:
  ```javascript
  let targetSheetName = sheetName || 'Transactions';
  ```

### Issue 4: Bank Code Mismatch
**Symptom:** Frontend sends wrong bank code

**Check:**
- In `bankConfig.ts`, Canara code is `"Canara"`
- In dropdown, the value should be `"Canara"`
- Sheet name constructed as: `${bankCode}_CreditTransactions` = `Canara_CreditTransactions`

## Quick Test in Browser Console

Run this in browser console to test:

```javascript
// Test fetching Canara transactions
fetch('https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec?action=getTransactions&sheetName=Canara_CreditTransactions')
  .then(r => r.text())
  .then(text => {
    console.log('Response:', text);
    try {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', json);
      console.log('Transaction count:', json.data ? json.data.length : 0);
    } catch (e) {
      console.error('Not JSON:', e);
    }
  });
```

## What to Share for Further Debugging

Please share:
1. What you see when testing the URL above
2. Browser console logs when selecting Canara bank
3. Whether `Canara_CreditTransactions` sheet exists in your Google Spreadsheet
4. Any errors from Google Apps Script Executions tab

