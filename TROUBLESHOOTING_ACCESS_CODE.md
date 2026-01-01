# 🔧 Troubleshooting Access Code Issues

## 🐛 Common Issues and Solutions

### Issue 1: "Invalid access code" even with correct code

#### Possible Causes:
1. **Environment variable not set correctly**
2. **Serverless function not deployed**
3. **API endpoint not accessible**
4. **Case sensitivity or whitespace issues**

#### Solutions:

**Check 1: Verify Environment Variable in Vercel**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify `ACCESS_CODE` is set:
   - Name: `ACCESS_CODE` (exactly, no spaces)
   - Value: Your access code (check for extra spaces)
   - Environment: All (Production, Preview, Development)
3. **Redeploy** after checking

**Check 2: Verify Serverless Function**
1. Go to Vercel Dashboard → Your Project → Functions tab
2. Check if `/api/verify-access` appears
3. If not, the function might not be deployed

**Check 3: Test API Directly**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try this:
   ```javascript
   fetch('/api/verify-access', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ accessCode: 'YOUR_CODE' })
   }).then(r => r.json()).then(console.log)
   ```
4. Check the response

**Check 4: Check for Whitespace**
- Make sure access code in Vercel has no leading/trailing spaces
- Make sure you're not copying extra characters

---

### Issue 2: "Unable to verify access code" error

#### Cause:
Serverless function is not accessible or returning error

#### Solutions:

**Solution 1: Check Function Deployment**
1. In Vercel, go to Deployments tab
2. Check latest deployment logs
3. Look for errors in function deployment

**Solution 2: Verify File Structure**
Make sure `/api/verify-access.ts` exists in your project root:
```
project-root/
  ├── api/
  │   └── verify-access.ts  ← Should be here
  ├── src/
  └── vercel.json
```

**Solution 3: Check vercel.json**
Make sure `vercel.json` has API route handling:
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

---

### Issue 3: Works locally but not on Vercel

#### Cause:
Environment variable not available in production

#### Solutions:

**Solution 1: Redeploy After Setting Variable**
1. Set `ACCESS_CODE` in Vercel
2. **Must redeploy** for it to take effect
3. Go to Deployments → Click "..." → Redeploy

**Solution 2: Check Environment Scope**
Make sure `ACCESS_CODE` is set for:
- ✅ Production
- ✅ Preview  
- ✅ Development

**Solution 3: Check Variable Name**
- Must be exactly: `ACCESS_CODE`
- Not: `VITE_ACCESS_CODE`
- Not: `access_code`
- Not: `ACCESS_CODE ` (with space)

---

### Issue 4: API returns 404 or 500

#### Solutions:

**Check 1: Function File Location**
- File must be at: `/api/verify-access.ts` (not in src/)
- Must export default handler

**Check 2: Check Build Logs**
1. Vercel Dashboard → Deployments
2. Click on deployment
3. Check "Functions" section
4. Look for errors

**Check 3: Test Function Directly**
Visit: `https://your-app.vercel.app/api/verify-access`
- Should return method not allowed (405) for GET
- This confirms function exists

---

## 🔍 Debugging Steps

### Step 1: Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Try entering access code
4. Look for errors

### Step 2: Check Network Tab
1. Open DevTools → Network tab
2. Try entering access code
3. Find `/api/verify-access` request
4. Check:
   - Status code
   - Response body
   - Request payload

### Step 3: Check Vercel Logs
1. Vercel Dashboard → Your Project
2. Go to "Logs" or "Functions" tab
3. Look for function execution logs
4. Check for errors

### Step 4: Test with curl
```bash
curl -X POST https://your-app.vercel.app/api/verify-access \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"YOUR_CODE"}'
```

---

## ✅ Quick Fix Checklist

- [ ] `ACCESS_CODE` set in Vercel (exact name, no spaces)
- [ ] Environment variable set for all environments
- [ ] Redeployed after setting variable
- [ ] `/api/verify-access.ts` exists in project root
- [ ] `vercel.json` configured correctly
- [ ] No typos in access code
- [ ] No extra spaces in access code
- [ ] Checked browser console for errors
- [ ] Checked Vercel deployment logs

---

## 🚀 Quick Test

### Test 1: Verify Function Exists
Visit: `https://your-app.vercel.app/api/verify-access`
- Should get 405 (Method Not Allowed) - this is good!
- Means function exists

### Test 2: Test with Correct Code
Use browser console:
```javascript
fetch('/api/verify-access', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ accessCode: 'YOUR_ACTUAL_CODE' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### Test 3: Check Environment Variable
In Vercel:
1. Settings → Environment Variables
2. Verify `ACCESS_CODE` is there
3. Check the value (no spaces)

---

## 💡 Most Common Fix

**90% of issues are solved by:**
1. Setting `ACCESS_CODE` in Vercel
2. **Redeploying** the application
3. Waiting 1-2 minutes for deployment

---

## 🆘 Still Not Working?

1. **Check Vercel deployment logs** for function errors
2. **Test the API endpoint directly** (see above)
3. **Verify file structure** is correct
4. **Check for typos** in access code
5. **Clear browser cache** and try again

---

## 📝 Example: Correct Setup

### In Vercel Environment Variables:
```
Name: ACCESS_CODE
Value: MySecret123!
Environment: Production, Preview, Development
```

### File Structure:
```
project/
├── api/
│   └── verify-access.ts  ✅
├── src/
│   └── pages/
│       └── AccessCode.tsx  ✅
└── vercel.json  ✅
```

### After Setting Variable:
1. ✅ Save environment variable
2. ✅ Redeploy application
3. ✅ Test with access code

---

**Need more help?** Check Vercel deployment logs and browser console for specific error messages.

