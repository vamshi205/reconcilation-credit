# 🚀 Deploy to Vercel - Quick Guide

## ✅ Changes Made for Vercel

I've updated your project to work perfectly with Vercel:

1. ✅ **vercel.json** - Updated with API route handling
2. ✅ **AccessCode.tsx** - Fixed API endpoint for production
3. ✅ **Serverless function** - Ready at `/api/verify-access.ts`
4. ✅ **All configurations** - Vercel-ready

---

## 📋 What You Need to Do

### Step 1: Push to GitHub (5 minutes)

```bash
# If not already a git repo
git init
git add .
git commit -m "Ready for Vercel deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/repo-name.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Vercel (5 minutes)

1. Go to [vercel.com](https://vercel.com) → Sign up/Login
2. Click **"Add New Project"**
3. **Import** your GitHub repository
4. Click **"Deploy"** (don't set env vars yet)

### Step 3: Set Environment Variables (2 minutes)

After first deployment:

1. Go to **Settings** → **Environment Variables**
2. Add this:

```
Name: ACCESS_CODE
Value: YourSecretCode123!  (choose your own!)
Environment: Production, Preview, Development (all)
```

3. Click **"Save"**

### Step 4: Redeploy (1 minute)

1. Go to **Deployments** tab
2. Click **"..."** → **"Redeploy"**

### Step 5: Test (1 minute)

1. Visit your Vercel URL
2. Enter your access code
3. Should work! ✅

---

## 🎯 That's It!

Total time: **~15 minutes**

Your app is now:
- ✅ Deployed on Vercel
- ✅ Protected with access code
- ✅ Only you can access it
- ✅ Secure and ready

---

## 📝 Quick Reference

**Environment Variable to Set:**
```
ACCESS_CODE = YourSecretCode123!
```

**Optional (if using Google Sheets):**
```
VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL = your_url
```

**Do NOT Set:**
- ❌ `VITE_ACCESS_CODE`
- ❌ `VITE_APP_PASSWORD`

---

## 🆘 Need Help?

See `VERCEL_DEPLOYMENT_STEPS.md` for detailed instructions.

---

**Ready to deploy?** Follow the 5 steps above! 🚀

