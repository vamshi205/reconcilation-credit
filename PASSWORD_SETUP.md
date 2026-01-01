# How to Set Your Password

## Quick Guide

### Step 1: Open `.env` File
Open the `.env` file in the root directory of your project.

### Step 2: Find This Line
```env
VITE_APP_PASSWORD=ChangeThisPassword123!
```

### Step 3: Replace with Your Password
```env
VITE_APP_PASSWORD=YourSecurePasswordHere
```

**Example:**
```env
VITE_APP_PASSWORD=MySecurePass123!
```

### Step 4: Save and Restart
1. Save the `.env` file
2. Restart your development server:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Step 5: Login
1. Go to `http://localhost:3000`
2. You'll see the login page
3. Enter the password you just set
4. Click "Login"

## Password Requirements

- **Minimum 8 characters** (recommended)
- Can include letters, numbers, and special characters
- Make it strong and unique

## Examples of Good Passwords

✅ Good:
- `MyApp2024!Secure`
- `CreditMgr#123`
- `SecurePass@2024`

❌ Avoid:
- `password`
- `12345678`
- `admin`

## Troubleshooting

### "Password not working"
- Make sure you saved the `.env` file
- Restart the development server after changing password
- Check for typos in the password

### "Can't find .env file"
- Create it in the root directory (same level as `package.json`)
- Copy from `.env.example` if it exists

### "Still can access without password"
- Clear browser localStorage: Open DevTools → Application → Local Storage → Clear
- Make sure `VITE_APP_PASSWORD` is set in `.env`
- Restart the server

## First Time Setup

If this is your first time:
1. The `.env` file should already exist
2. Just change `VITE_APP_PASSWORD=ChangeThisPassword123!` to your password
3. Restart the server
4. Login with your new password

## Need Help?

If you're having issues:
1. Check that `.env` file is in the root directory
2. Verify the line starts with `VITE_APP_PASSWORD=`
3. Make sure there are no spaces around the `=` sign
4. Restart the development server

