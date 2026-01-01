# Vercel Deployment Guide

## ✅ Repository Requirements

**Good News!** Vercel supports **both public and private repositories**:

- **Hobby Plan (Free)**: ✅ Supports private repos under your personal GitHub/GitLab/Bitbucket account
- **Pro Plan**: ✅ Supports private organization repos

You can keep your repository **private** and still deploy to Vercel!

## 🚀 Deployment Steps

### Step 1: Push Your Code to GitHub

1. **Create a GitHub repository** (can be private):
   ```bash
   # If not already initialized
   git init
   git add .
   git commit -m "Initial commit"
   
   # Create repo on GitHub (private is fine!)
   # Then add remote:
   git remote add origin https://github.com/YOUR_USERNAME/reconcilation-credit.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign up/login
2. **Click "Add New Project"**
3. **Import your GitHub repository**:
   - Select your repository (private repos will show if connected)
   - Click "Import"
4. **Configure Project Settings**:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)
5. **Click "Deploy"**

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? reconcilation-credit (or your choice)
# - Directory? ./
# - Override settings? No
```

### Step 3: Configure Environment Variables

**CRITICAL**: You must set environment variables in Vercel!

1. **Go to your project on Vercel Dashboard**
2. **Click "Settings" → "Environment Variables"**
3. **Add these variables**:

   ```
   Name: VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL
   Value: https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   Environment: Production, Preview, Development (select all)
   ```

   ```
   Name: VITE_APP_PASSWORD
   Value: YourSecurePassword123!
   Environment: Production, Preview, Development (select all)
   ```

   ```
   Name: VITE_GOOGLE_SHEETS_API_KEY
   Value: (leave empty or add if using)
   Environment: Production, Preview, Development (select all)
   ```

4. **Click "Save"** for each variable

### Step 4: Redeploy

After adding environment variables:

1. **Go to "Deployments" tab**
2. **Click the "..." menu on latest deployment**
3. **Click "Redeploy"**
4. **Or push a new commit** to trigger automatic redeploy

## 🔒 Security Checklist

Before deploying, ensure:

- ✅ `.env` file is in `.gitignore` (already done)
- ✅ No sensitive data in source code
- ✅ Environment variables set in Vercel dashboard
- ✅ Strong password set for `VITE_APP_PASSWORD`
- ✅ Google Sheets URL is correct

## 📝 Vercel Configuration

### Optional: Create `vercel.json`

You can create a `vercel.json` file for custom configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures React Router works correctly with client-side routing.

## 🌐 Custom Domain (Optional)

1. **Go to "Settings" → "Domains"**
2. **Add your domain** (e.g., `yourdomain.com`)
3. **Follow DNS configuration instructions**
4. **Vercel will automatically configure SSL**

## 🔄 Automatic Deployments

Vercel automatically deploys when you:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment
- Open a Pull Request → Preview deployment

## 🐛 Troubleshooting

### "Build Failed"
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Check for TypeScript/ESLint errors locally first

### "Environment variables not working"
- Make sure variable names start with `VITE_`
- Redeploy after adding variables
- Check variable is set for correct environment (Production/Preview/Development)

### "404 on page refresh"
- Add `vercel.json` with rewrites (see above)
- This is needed for React Router client-side routing

### "Authentication not working"
- Verify `VITE_APP_PASSWORD` is set in Vercel
- Check the value matches what you're entering
- Clear browser cache/localStorage

### "Google Sheets not working"
- Verify `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL` is set correctly
- Check Google Apps Script is deployed and accessible
- Check CORS settings in Google Apps Script

## 📊 Monitoring

Vercel provides:
- **Analytics**: View page views, performance
- **Logs**: Check server logs and errors
- **Speed Insights**: Monitor Core Web Vitals

## 💰 Pricing

- **Hobby Plan (Free)**:
  - ✅ Unlimited personal projects
  - ✅ Private repositories (personal account)
  - ✅ Automatic SSL
  - ✅ Preview deployments
  - ✅ 100GB bandwidth/month

- **Pro Plan ($20/month)**:
  - ✅ Everything in Hobby
  - ✅ Private organization repos
  - ✅ Team collaboration
  - ✅ More bandwidth

## 🎯 Quick Deploy Checklist

- [ ] Code pushed to GitHub (can be private)
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Environment variables configured
- [ ] Initial deployment successful
- [ ] Test login with password
- [ ] Test Google Sheets integration
- [ ] Custom domain configured (optional)

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#vercel)
- [Environment Variables in Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

