# 🔐 Local Environment Variables Setup

## 📍 Where to Put Environment Variables

For **local development**, create a file called **`.env.local`** in the **root directory** of your project.

```
/Users/vamshikrishna/Documents/srrProjs/reconcilation-credit/
├── .env.local          ← Create this file here
├── package.json
├── vite.config.ts
└── src/
```

## 📝 How to Create `.env.local`

### Option 1: Using Terminal
```bash
cd /Users/vamshikrishna/Documents/srrProjs/reconcilation-credit
touch .env.local
```

### Option 2: Using Your IDE
1. Right-click in the project root folder
2. Create new file: `.env.local`
3. Add your variables

## 🔑 Required Environment Variables

Add these variables to your `.env.local` file:

```bash
# Google Sheets Configuration
# Get this URL from your Google Apps Script deployment
VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec

# Google Sheets API Key (Optional - only if using API method)
VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
```

## ⚠️ Important Notes

1. **VITE_ Prefix Required**: All environment variables that need to be accessible in the browser code must start with `VITE_`

2. **No Quotes Needed**: Don't wrap values in quotes unless the value itself contains spaces
   ```bash
   # ✅ Correct
   VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL=https://script.google.com/...
   
   # ❌ Wrong
   VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL="https://script.google.com/..."
   ```

3. **Restart Dev Server**: After creating or modifying `.env.local`, you must restart the development server:
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

4. **File is Ignored**: `.env.local` is already in `.gitignore`, so your secrets won't be committed to git

## 🔍 How to Access in Code

In your code, access environment variables like this:

```typescript
const apiUrl = import.meta.env.VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL;
```

## 📋 Example `.env.local` File

```bash
# Google Sheets Apps Script URL
VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbwaxqF-hd2tiQKukRnBqMD-Iir56Vpm0CWYL-70YHTXJoMpHTwf_GannYZO-xfrAipXOA/exec

# Optional: Google Sheets API Key (if not using Apps Script)
VITE_GOOGLE_SHEETS_API_KEY=
```

## ✅ Verification

After setting up `.env.local` and restarting the server, check the browser console:
- The app should be able to access `import.meta.env.VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL`
- If it's empty, check that:
  1. The variable name starts with `VITE_`
  2. You restarted the dev server
  3. The file is named exactly `.env.local` (not `.env.local.txt`)

---

**That's it!** Your local environment variables are now configured! 🚀

