# Security Setup Guide

## 🔒 Security Features Implemented

1. **Environment Variables**: Sensitive data moved to `.env` file
2. **Authentication**: Password-based login system
3. **Protected Routes**: All pages require authentication
4. **Secure Storage**: Passwords are hashed before storage

## 📋 Setup Instructions

### Step 1: Create `.env` File

Create a `.env` file in the root directory with the following content:

```env
# Google Sheets Configuration
# Get this URL from your Google Apps Script Web App deployment
VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec

# Authentication
# Set a secure password for accessing the application
VITE_APP_PASSWORD=your_secure_password_here

# Optional: Google Sheets API Key (if using API instead of Apps Script)
VITE_GOOGLE_SHEETS_API_KEY=
```

### Step 2: Replace Sensitive Values

1. **Google Sheets URL**: 
   - Replace `YOUR_SCRIPT_ID` with your actual Google Apps Script Web App URL
   - This was previously hardcoded in `googleSheetsService.ts` - now it's secure!

2. **App Password**:
   - Set a strong password for accessing the application
   - Use a combination of letters, numbers, and special characters
   - Minimum 8 characters recommended

### Step 3: Restart Development Server

After creating the `.env` file, restart your development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## 🚨 What Was Secured

### Before (Exposed):
- ❌ Google Apps Script URL hardcoded in source code
- ❌ No authentication - anyone could access
- ❌ Sensitive URLs visible in browser console

### After (Secure):
- ✅ Google Apps Script URL in environment variables
- ✅ Password-based authentication required
- ✅ All routes protected
- ✅ Sensitive data not in source code

## 🔐 Authentication

### First Time Login

1. If no password is set in `.env`, you can access the app directly
2. Once you set `VITE_APP_PASSWORD` in `.env`, you'll need to enter it to login
3. The password is hashed and stored in localStorage

### Login Flow

1. Navigate to the app - you'll be redirected to `/login`
2. Enter your password (from `VITE_APP_PASSWORD`)
3. Click "Login"
4. You'll be authenticated and can access all pages

### Logout

- Click the "Logout" button in the sidebar
- You'll be logged out and redirected to the login page

## 📝 Important Notes

1. **Never commit `.env` file**: It's already in `.gitignore`
2. **Keep password secure**: Don't share your `.env` file
3. **Environment variables**: Must start with `VITE_` to be accessible in the app
4. **Production**: For production, set environment variables on your hosting platform

## 🔄 Changing Password

Currently, password changes require:
1. Updating `VITE_APP_PASSWORD` in `.env`
2. Restarting the server
3. All users will need to use the new password

Future enhancement: Add a password change feature in the UI (requires old password verification).

## 🛡️ Additional Security Recommendations

For production deployment:

1. **Use HTTPS**: Always use HTTPS in production
2. **Strong Passwords**: Use complex passwords (12+ characters)
3. **Session Timeout**: Consider adding automatic logout after inactivity
4. **Rate Limiting**: Add rate limiting to login attempts
5. **Two-Factor Authentication**: Consider adding 2FA for enhanced security
6. **Backend Authentication**: For production, consider moving authentication to a backend server

## 🐛 Troubleshooting

### "Cannot access app after setting password"
- Make sure `VITE_APP_PASSWORD` is set correctly in `.env`
- Restart the development server
- Clear browser localStorage if needed

### "Google Sheets not working"
- Check that `VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL` is set correctly
- Make sure the URL is the full Web App URL from Google Apps Script
- Restart the server after updating `.env`

### "Login page not showing"
- Check browser console for errors
- Make sure all files are saved
- Restart the development server

