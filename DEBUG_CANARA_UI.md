# Debugging Canara Bank Not Showing in UI

## Issue: URL fetches transactions, but UI shows nothing when Canara is selected

## Quick Debug Steps

### Step 1: Check Browser Console

1. Open your app
2. Open Developer Tools (F12)
3. Go to **Console** tab
4. Select "Canara Bank" from dropdown
5. Look for these logs:

**Expected logs:**
```
Fetching credit transactions from Canara_CreditTransactions...
✓ Fetched X credit transactions from Canara
Loaded X transactions from Canara Google Sheets
```

**If you see errors, note them down.**

### Step 2: Check Transaction Bank Field

The issue might be that transactions don't have the `bank` field set correctly.

1. In browser console, after selecting Canara, run:
```javascript
// Check what transactions were loaded
console.log('All transactions:', window.transactions || 'Not available');
```

2. Or add this temporary debug code in Transactions.tsx after line 321:
```typescript
console.log('Raw transactions from Google Sheets:', sheetsTransactions);
console.log('First transaction bank:', sheetsTransactions[0]?.bank);
console.log('Selected bank:', selectedBank);
```

### Step 3: Check Bank Code Match

The dropdown uses `bank.code` which is `"Canara"` (from bankConfig.ts).

Verify:
1. Selected bank value: Should be `"Canara"`
2. Transaction bank field: Should also be `"Canara"`

### Step 4: Check Filtering Logic

The filtering happens at line 478-483 in Transactions.tsx:
```typescript
if (selectedBank) {
  filtered = filtered.filter((t) => {
    const transactionBank = t.bank || "HDFC";
    return transactionBank === selectedBank || 
           transactionBank.toLowerCase() === selectedBank.toLowerCase();
  });
}
```

This should work, but if `t.bank` is undefined or different, transactions will be filtered out.

## Common Issues

### Issue 1: Bank Field Not Set in Transactions
**Symptom:** Transactions fetched but `bank` field is undefined

**Check:**
- In browser console, check if transactions have `bank` field
- Look at the `fetchTransactionsFromSheet` function - it should set `bank` from sheet name

**Fix:** The bank should be extracted from sheet name `"Canara_CreditTransactions"` → `"Canara"`

### Issue 2: Bank Code Mismatch
**Symptom:** `selectedBank` is "Canara" but `transaction.bank` is something else

**Check:**
- Dropdown value should be `bank.code` = `"Canara"`
- Transaction bank should be extracted from sheet name as `"Canara"`

### Issue 3: Transactions Filtered Out
**Symptom:** Transactions are fetched but filtered out by the bank filter

**Check:**
- Add console.log before and after filtering to see count
- Check if `transaction.bank` matches `selectedBank`

## Quick Fix Test

Add this temporary code in Transactions.tsx after line 321 to debug:

```typescript
console.log('=== CANARA DEBUG ===');
console.log('Selected bank:', selectedBank);
console.log('Fetched transactions count:', sheetsTransactions.length);
console.log('First 3 transactions:', sheetsTransactions.slice(0, 3).map(t => ({
  id: t.id,
  description: t.description,
  bank: t.bank,
  amount: t.amount
})));
console.log('All transaction banks:', [...new Set(sheetsTransactions.map(t => t.bank))]);
console.log('===================');
```

This will show:
- What bank is selected
- How many transactions were fetched
- What bank field each transaction has
- All unique bank values in the transactions

## What to Share

Please share:
1. Browser console logs when selecting Canara
2. The output of the debug code above
3. Whether transactions appear in the console but not in the UI

