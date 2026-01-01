# 🔍 Why Transactions Are Not Loading

## 🐛 Common Issues

### Issue 1: Google Sheets URL Not Configured

**Symptom**: Empty transaction list, no errors

**Check:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Look for `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL`
3. Is it set? Is it correct?

**Fix:**
1. Set `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL` in Vercel
2. Value should be: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
3. Redeploy after setting

---

### Issue 2: Google Sheets Is Empty

**Symptom**: App loads but shows 0 transactions

**Check:**
1. Open your Google Sheet
2. Do you have transactions in it?
3. Are they in the correct format?

**Fix:**
1. Upload a CSV file to add transactions
2. Or manually add transactions via "Manual Entry"
3. Transactions should appear after upload

---

### Issue 3: Google Apps Script Not Authorized

**Symptom**: Error message about authorization

**Check:**
1. Open browser console (F12)
2. Look for errors about "authorization" or "401"
3. Check network tab for failed requests

**Fix:**
1. Open your Google Apps Script Web App URL
2. Sign in with Google account
3. Click "Review Permissions" or "Allow"
4. Authorize the script
5. Refresh the app

---

### Issue 4: Wrong Google Sheets URL

**Symptom**: 404 errors or "Script not found"

**Check:**
1. Verify the URL in Vercel is correct
2. URL should be the Web App deployment URL
3. Not the script editor URL

**Fix:**
1. Go to Google Apps Script
2. Deploy → Manage deployments
3. Copy the Web App URL (ends with `/exec`)
4. Update in Vercel
5. Redeploy

---

## 🔍 How to Debug

### Step 1: Check Browser Console

1. Open DevTools (F12)
2. Go to Console tab
3. Look for:
   - "Loading transactions from Google Sheets..."
   - "Fetched X transactions..."
   - Any error messages

### Step 2: Check Network Tab

1. Open DevTools → Network tab
2. Refresh the page
3. Look for request to Google Sheets
4. Check:
   - Status code (200 = success, 401 = auth needed, 404 = not found)
   - Response body

### Step 3: Check Environment Variable

1. Vercel Dashboard → Settings → Environment Variables
2. Verify `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL` is set
3. Check the value is correct

### Step 4: Test Google Sheets Connection

1. Go to CSV Upload page
2. Click "Test Google Sheets" button
3. See if connection works

---

## ✅ Quick Checklist

- [ ] `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL` set in Vercel
- [ ] URL is correct (Web App URL, not script editor)
- [ ] Google Apps Script is deployed as Web App
- [ ] Script is authorized (you've clicked "Allow")
- [ ] Google Sheet has transactions
- [ ] Redeployed after setting environment variable

---

## 🚀 Most Common Fix

**90% of the time:**

1. **Set `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL` in Vercel**
2. **Redeploy**
3. **Authorize Google Apps Script** (open the URL, click Allow)
4. **Upload a CSV** to add transactions

---

## 📝 If You Don't Have Transactions Yet

**To add transactions:**

1. **Upload CSV**: Go to CSV Upload page → Upload bank statement
2. **Manual Entry**: Go to Manual Entry page → Add transaction manually

Both will save to Google Sheets, then they'll appear in Dashboard and Transactions pages.

---

## 🆘 Still Not Working?

1. **Check browser console** for specific errors
2. **Check Vercel logs** for deployment errors
3. **Test Google Sheets URL** directly in browser
4. **Verify Google Sheet** has data

---

**Most likely**: Google Sheets URL not set in Vercel, or Google Sheet is empty! 🔍

