# 🔐 Access Code Setup - Prevent Unauthorized Access

## ✅ What's Been Implemented

I've added a **two-layer security system** to prevent unauthorized users from accessing your application:

1. **Access Code Screen** (First Gate)
   - Users must enter an access code before seeing the login page
   - Access code validated on the server (secure)
   - Session-based (clears when browser closes)

2. **Login Password** (Second Gate)
   - After access code, user sets/enters password
   - Password stored in localStorage

## 🚀 How It Works

### User Flow:
1. User visits your app → **Access Code Screen**
2. User enters access code → Validated on server
3. If correct → **Login Screen**
4. User sets/enters password → **Dashboard**

### Security:
- ✅ Access code validated on server (not exposed to client)
- ✅ Access code stored in Vercel environment variables
- ✅ Session-based (clears on browser close)
- ✅ Two-layer protection

## 📋 Vercel Deployment Setup

### Step 1: Set Access Code in Vercel

In Vercel Dashboard → Settings → Environment Variables:

```
Name: ACCESS_CODE
Value: YourSecretAccessCode123!
Environment: Production, Preview, Development (select all)
```

**Important**: 
- ✅ Use `ACCESS_CODE` (NOT `VITE_ACCESS_CODE`)
- ✅ This stays on the server and is never exposed
- ✅ Choose a strong, unique code

### Step 2: Deploy

The serverless function at `/api/verify-access.ts` will automatically:
- Validate access codes
- Keep the code secure on the server
- Deny access if code is wrong

## 🔒 Security Features

### ✅ What's Secure:
- Access code never in your code
- Access code never exposed to client
- Server-side validation
- Session-based (clears on browser close)
- Two-layer protection (access code + password)

### ⚠️ How It Works:
- Access code checked first (server-side)
- If valid, user can proceed to login
- Access granted for browser session only
- Must re-enter access code if browser closed

## 🎯 Usage

### For You (Authorized User):
1. Visit your deployed app
2. Enter the access code you set in Vercel
3. Set/enter your password
4. Access the application

### For Unauthorized Users:
1. Visit your deployed app
2. See "Access Required" screen
3. Don't know the access code
4. **Cannot proceed** - Access denied! ✅

## 📝 Environment Variables Summary

In Vercel, set these:

```
ACCESS_CODE = YourSecretAccessCode123!  (Server-side, secure)
VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL = your_url (If using Google Sheets)
```

**Do NOT set:**
- ❌ `VITE_ACCESS_CODE` (would be exposed to client)
- ❌ `VITE_APP_PASSWORD` (not needed anymore)

## 🛠️ Development vs Production

### Development (Local):
- If no `ACCESS_CODE` set → Allows access (for development)
- Access code validation optional locally

### Production (Vercel):
- **Must set `ACCESS_CODE`** in Vercel
- Serverless function validates on server
- Access denied if code wrong or missing

## 🔄 Changing Access Code

1. **Update in Vercel**: Change `ACCESS_CODE` environment variable
2. **Redeploy**: Push new commit or redeploy
3. **New code active**: Users need new code to access

## 🎉 Result

**Before**: Anyone could visit and set a password
**After**: Only users with the access code can proceed to login

Your application is now **restricted** and only accessible to users who know the access code! 🔐

