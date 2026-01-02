# 🔄 Vercel Deployment Behavior - When Commits Trigger Deployments

## ⚠️ Important: It Depends on Your Branch!

**Short Answer:** 
- ✅ **If you commit to the branch connected to Vercel** → **YES, it will trigger a deployment**
- ✅ **If you commit to a different branch** → **NO, it won't affect the deployment**

---

## 📍 How to Check Which Branch is Connected

### In Vercel Dashboard:
1. Go to your project on [vercel.com](https://vercel.com)
2. Click **"Settings"** → **"Git"**
3. Look for **"Production Branch"** - this is the branch that auto-deploys

**Common setups:**
- Production Branch: `vercel-deployment` → Commits to `vercel-deployment` trigger deployments
- Production Branch: `main` → Commits to `main` trigger deployments

---

## 🎯 Current Situation

You're on: **`vercel-deployment`** branch

**If `vercel-deployment` is your Production Branch:**
- ✅ Committing and pushing to `vercel-deployment` **WILL trigger a new deployment**
- ✅ Every push = New deployment (automatic)

**If `main` is your Production Branch:**
- ✅ Committing to `vercel-deployment` **WON'T trigger a deployment**
- ✅ Only commits to `main` will trigger deployments

---

## 🛡️ How to Prevent Auto-Deployment

### Option 1: Work on a Different Branch
```bash
# Create a feature branch
git checkout -b feature/my-changes

# Make changes and commit
git add .
git commit -m "My changes"

# This won't trigger deployment
# When ready, merge to production branch
```

### Option 2: Disable Auto-Deploy in Vercel
1. Go to Vercel Dashboard → Your Project
2. Settings → Git
3. Toggle **"Automatic deployments from Git"** to OFF
4. Now you can commit without auto-deploying
5. Deploy manually when ready

### Option 3: Use [skip] in Commit Message
Some Vercel setups respect `[skip ci]` or `[skip vercel]`:
```bash
git commit -m "[skip vercel] My changes"
```

---

## ✅ Best Practices

### For Safe Development:
1. **Work on feature branches** (not production branch)
2. **Test locally** first
3. **Merge to production branch** when ready
4. **Let Vercel auto-deploy** from production branch

### Example Workflow:
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
# ... edit files ...

# 3. Commit (won't trigger deployment)
git add .
git commit -m "Add new feature"

# 4. Test locally
npm run dev

# 5. When ready, merge to production branch
git checkout vercel-deployment  # or main
git merge feature/new-feature
git push  # This WILL trigger deployment
```

---

## 🔍 How to Check Your Current Setup

### Check which branch Vercel is watching:
1. Vercel Dashboard → Your Project → Settings → Git
2. Look at "Production Branch" setting

### Check your current branch:
```bash
git branch --show-current
```

### Check remote branches:
```bash
git branch -r
```

---

## 💡 Summary

| Action | Will Trigger Deployment? |
|--------|-------------------------|
| Commit to Production Branch | ✅ YES (if auto-deploy is ON) |
| Commit to Feature Branch | ❌ NO |
| Push to Production Branch | ✅ YES (if auto-deploy is ON) |
| Push to Feature Branch | ❌ NO |
| Manual Deploy in Vercel | ✅ YES (always) |

---

**Recommendation:** 
- If you want to test changes without deploying → work on a feature branch
- If you want changes to go live → commit to production branch
- Check Vercel Settings → Git to see which branch is your production branch

