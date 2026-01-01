# 🔐 Simple Authentication Setup

## ✅ What's Implemented

**Simple two-step authentication:**
1. User ID (from environment variable)
2. Password (from environment variable)

**No access code, no password setup, no localStorage!**

---

## 📋 Vercel Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

### Variable 1: USER_ID
```
Name: USER_ID
Value: your_user_id_here
Environment: Production, Preview, Development (select all)
```

### Variable 2: APP_PASSWORD
```
Name: APP_PASSWORD
Value: your_password_here
Environment: Production, Preview, Development (select all)
```

### Variable 3: Google Sheets URL (if using)
```
Name: VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL
Value: https://script.google.com/macros/s/...
Environment: Production, Preview, Development (select all)
```

---

## 🚀 How It Works

### User Flow:
1. Visit app → **Login screen** (shows User ID and Password fields)
2. Enter User ID and Password
3. Server validates via `/api/authenticate`
4. If correct → **Dashboard**
5. If wrong → Error message

### Security:
- ✅ Credentials validated on server
- ✅ Never exposed to client
- ✅ Session token in sessionStorage
- ✅ Works across multiple devices

---

## 🔒 Security

**Exposure Risk:**
- ✅ Source code: **ZERO** (credentials not in code)
- ✅ Client-side: **ZERO** (credentials not in browser)
- ✅ Network: **LOW** (HTTPS encrypted)
- ✅ Server logs: **VERY LOW** (private)

**Perfect for single-user personal business app!**

---

## 📝 That's It!

Just set `USER_ID` and `APP_PASSWORD` in Vercel, redeploy, and you're done! 🎉

