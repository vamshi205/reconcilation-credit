# 🚀 Vercel Deployment - Complete Step-by-Step Guide

## ✅ Pre-Deployment Checklist

- [x] Access code protection implemented
- [x] Serverless function created (`/api/verify-access.ts`)
- [x] Vercel configuration updated (`vercel.json`)
- [x] Environment variables ready
- [x] Build configuration correct

---

## 📋 Step 1: Push Code to GitHub

### 1.1 Initialize Git (if not done)

```bash
git init
git add .
git commit -m "Ready for Vercel deployment"
```

### 1.2 Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click **"+"** → **"New repository"**
3. Name: `reconcilation-credit` (or your choice)
4. Choose **Private** (recommended)
5. **Don't** initialize with README
6. Click **"Create repository"**

### 1.3 Push Code

```bash
# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/reconcilation-credit.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 📋 Step 2: Deploy to Vercel

### 2.1 Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login (use GitHub for easy integration)

### 2.2 Import Project

1. Click **"Add New Project"**
2. **Import Git Repository**:
   - Select your GitHub repository
   - Click **"Import"**

### 2.3 Configure Project

Vercel will auto-detect Vite. Verify these settings:

- **Framework Preset**: Vite ✅
- **Root Directory**: `./` ✅
- **Build Command**: `npm run build` ✅
- **Output Directory**: `dist` ✅
- **Install Command**: `npm install` ✅

**Click "Deploy"** (don't set environment variables yet - we'll do that after first deploy)

---

## 📋 Step 3: Set Environment Variables

### 3.1 Go to Project Settings

1. After deployment, go to your project
2. Click **"Settings"** tab
3. Click **"Environment Variables"**

### 3.2 Add Environment Variables

Add these variables:

#### Variable 1: Access Code (REQUIRED)

```
Name: ACCESS_CODE
Value: YourSecretAccessCode123!
Environment: Production, Preview, Development (select all)
```

**Important**: 
- ✅ Use a strong, unique code
- ✅ Don't use `VITE_` prefix (server-side only)
- ✅ Select all environments

#### Variable 2: Google Sheets URL (If using)

```
Name: VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL
Value: https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
Environment: Production, Preview, Development (select all)
```

### 3.3 Save Variables

Click **"Save"** for each variable

---

## 📋 Step 4: Redeploy

After adding environment variables:

1. Go to **"Deployments"** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger redeploy

---

## 📋 Step 5: Test Deployment

### 5.1 Visit Your App

1. Go to your Vercel deployment URL
2. You should see **"Access Required"** screen

### 5.2 Test Access Code

1. Enter the access code you set in Vercel
2. Should proceed to login screen ✅

### 5.3 Test Login

1. Set password on first login
2. Should access dashboard ✅

---

## 🔧 Configuration Files

### vercel.json (Already Configured)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures:
- ✅ API routes work correctly
- ✅ React Router works (SPA routing)
- ✅ Serverless functions accessible

---

## 🔒 Security Checklist

Before going live:

- [x] `ACCESS_CODE` set in Vercel (server-side)
- [x] Strong access code chosen
- [x] No `VITE_ACCESS_CODE` in environment variables
- [x] No passwords in client code
- [x] Serverless function working
- [x] HTTPS enabled (automatic on Vercel)

---

## 📝 Environment Variables Summary

### Required:
```
ACCESS_CODE = YourSecretAccessCode123!
```

### Optional (if using Google Sheets):
```
VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL = your_url_here
```

### Do NOT Set:
- ❌ `VITE_ACCESS_CODE` (would be exposed)
- ❌ `VITE_APP_PASSWORD` (not needed)

---

## 🎯 What Happens After Deployment

### User Flow:
1. User visits your app URL
2. Sees **"Access Required"** screen
3. Must enter **ACCESS_CODE** (set in Vercel)
4. If correct → Login screen
5. Sets/enters password
6. Accesses application

### For Unauthorized Users:
- See access code screen
- Don't know the code
- **Cannot proceed** ✅

---

## 🐛 Troubleshooting

### "Access code not working"

**Check:**
1. Is `ACCESS_CODE` set in Vercel?
2. Did you redeploy after setting variables?
3. Is the code correct?

**Solution:**
- Verify environment variable in Vercel dashboard
- Redeploy the application
- Test with correct access code

### "API route not found"

**Check:**
- Is `vercel.json` in project root?
- Is `/api/verify-access.ts` in project root?

**Solution:**
- Verify file structure
- Check Vercel build logs

### "404 on page refresh"

**Check:**
- Is `vercel.json` configured correctly?

**Solution:**
- Should have rewrite rule for `/(.*)` → `/index.html`
- Already configured ✅

### "Build failed"

**Check:**
- Build logs in Vercel dashboard
- TypeScript errors
- Missing dependencies

**Solution:**
- Check build logs
- Fix any TypeScript errors
- Ensure all dependencies in `package.json`

---

## 🎉 Success!

Once deployed:

1. ✅ Your app is live on Vercel
2. ✅ Access code protection active
3. ✅ Only users with access code can proceed
4. ✅ Secure and ready for use

---

## 📚 Next Steps

1. **Custom Domain** (Optional):
   - Go to Settings → Domains
   - Add your custom domain
   - Vercel handles SSL automatically

2. **Monitor Usage**:
   - Check Analytics tab
   - Monitor deployments
   - View logs if needed

3. **Update Access Code**:
   - Change `ACCESS_CODE` in Vercel
   - Redeploy
   - New code active

---

## 🆘 Need Help?

- Check Vercel build logs
- Review environment variables
- Test locally first (`npm run dev`)
- Check browser console for errors

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] First deployment successful
- [ ] `ACCESS_CODE` set in Vercel
- [ ] Redeployed after setting variables
- [ ] Access code screen appears
- [ ] Access code works
- [ ] Login flow works
- [ ] All routes protected

**You're all set!** 🚀

