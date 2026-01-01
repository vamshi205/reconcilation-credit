# 🔧 Fix: "Access denied. Server not configured"

## 🐛 The Problem

This error means: **`ACCESS_CODE` environment variable is not set in Vercel**

The serverless function can't find the `ACCESS_CODE` variable, so it's denying access.

---

## ✅ Solution: Set ACCESS_CODE in Vercel

### Step 1: Go to Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Login to your account
3. Select your project: `reconcilation-credit`

### Step 2: Add Environment Variable

1. Click **"Settings"** tab (top menu)
2. Click **"Environment Variables"** (left sidebar)
3. Click **"Add New"** button

### Step 3: Enter Details

Fill in the form:

```
Name: ACCESS_CODE
Value: srrOrthOSat
Environment: 
  ☑ Production
  ☑ Preview
  ☑ Development
```

**Important:**
- ✅ Name must be exactly: `ACCESS_CODE` (all caps, underscore)
- ✅ Value: Your access code (e.g., `srrOrthOSat`)
- ✅ Select ALL environments (Production, Preview, Development)

### Step 4: Save

1. Click **"Save"** button
2. You should see `ACCESS_CODE` in the list

### Step 5: Redeploy (CRITICAL!)

**This is the most important step!**

1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click the **"..."** (three dots) menu
4. Click **"Redeploy"**
5. Wait 1-2 minutes for deployment to complete

**Why?** Environment variables are only loaded when the function is deployed. Changing the variable doesn't affect running deployments.

---

## 🎯 Quick Checklist

- [ ] Went to Vercel Dashboard
- [ ] Settings → Environment Variables
- [ ] Added `ACCESS_CODE` (exact name)
- [ ] Set value to your access code
- [ ] Selected all environments
- [ ] Clicked Save
- [ ] **Redeployed the application**
- [ ] Waited for deployment to complete

---

## 🔍 Verify It's Set

### Check 1: In Vercel Dashboard
1. Settings → Environment Variables
2. You should see `ACCESS_CODE` in the list
3. Value should show (masked, but you can edit to verify)

### Check 2: Test After Redeploy

After redeploying, test again:

```javascript
fetch('/api/verify-access', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ accessCode: 'srrOrthOSat' })
})
.then(r => r.json())
.then(console.log)
```

**Expected result:**
```json
{success: true, message: 'Access granted'}
```

**If still "Server not configured":**
- Check you redeployed after setting the variable
- Check the variable name is exactly `ACCESS_CODE`
- Check it's set for the correct environment (Production)

---

## 📝 Common Mistakes

### Mistake 1: Wrong Variable Name
- ❌ `access_code` (lowercase)
- ❌ `VITE_ACCESS_CODE` (wrong prefix)
- ❌ `ACCESS_CODE ` (with space)
- ✅ `ACCESS_CODE` (correct)

### Mistake 2: Not Redeploying
- ❌ Setting variable but not redeploying
- ✅ Setting variable AND redeploying

### Mistake 3: Wrong Environment
- ❌ Only set for Development
- ✅ Set for Production, Preview, AND Development

---

## 🚀 Step-by-Step Visual Guide

```
Vercel Dashboard
  ↓
Your Project (reconcilation-credit)
  ↓
Settings (top menu)
  ↓
Environment Variables (left sidebar)
  ↓
Add New
  ↓
Name: ACCESS_CODE
Value: srrOrthOSat
Environment: ☑ All
  ↓
Save
  ↓
Deployments Tab
  ↓
Latest Deployment → ... → Redeploy
  ↓
Wait 1-2 minutes
  ↓
Test!
```

---

## ✅ After Fixing

Once you've:
1. ✅ Set `ACCESS_CODE` in Vercel
2. ✅ Redeployed
3. ✅ Waited for deployment

You should be able to:
- Enter access code in your app
- Get "Access granted"
- Proceed to login screen

---

## 🆘 Still Not Working?

If you've done all the above and still get "Server not configured":

1. **Check Vercel Logs**:
   - Deployments → Latest → Functions tab
   - Look for `/api/verify-access` logs
   - Check for errors

2. **Verify Variable Name**:
   - Must be exactly: `ACCESS_CODE`
   - Case-sensitive
   - No spaces

3. **Check Deployment**:
   - Make sure latest deployment completed successfully
   - Check for build errors

4. **Try Different Environment**:
   - Set for Preview environment
   - Deploy a preview branch
   - Test there

---

**The fix is simple: Set `ACCESS_CODE` in Vercel and redeploy!** 🚀

