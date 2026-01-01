# 🔐 Environment Variables Setup - USER_ID and PASSWORD

## 📋 Required Environment Variables

In Vercel Dashboard → Settings → Environment Variables, set these:

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

### Variable 3: ACCESS_CODE (if using access code)
```
Name: ACCESS_CODE
Value: your_access_code_here
Environment: Production, Preview, Development (select all)
```

### Variable 4: Google Sheets URL (if using)
```
Name: VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL
Value: https://script.google.com/macros/s/...
Environment: Production, Preview, Development (select all)
```

---

## ✅ Important Notes

1. **No `VITE_` Prefix for Credentials**
   - ✅ `USER_ID` (correct - server-side)
   - ✅ `APP_PASSWORD` (correct - server-side)
   - ❌ `VITE_USER_ID` (wrong - would be exposed)
   - ❌ `VITE_APP_PASSWORD` (wrong - would be exposed)

2. **Select All Environments**
   - Production
   - Preview
   - Development
   - This ensures it works in all deployments

3. **Redeploy After Setting**
   - Environment variables only load on deployment
   - Must redeploy after adding/changing variables

---

## 🔒 Security

- ✅ Credentials stay on server (not exposed to client)
- ✅ Validated via serverless function
- ✅ Never in source code
- ✅ Protected by HTTPS

---

## 🚀 After Setting Variables

1. **Save** each variable
2. **Redeploy** your application
3. **Test** login with your USER_ID and APP_PASSWORD

---

**That's it!** Your credentials are now secure and work across all devices! 🔐

