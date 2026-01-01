# 🧪 Local Testing Guide

## 🚀 Quick Start

### Step 1: Start Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3000`

### Step 2: Test Access Code Flow

1. **Open browser**: Go to `http://localhost:3000`
2. **You'll see**: "Access Required" screen
3. **Enter access code**: See options below

---

## 🔧 Testing Options

### Option 1: Test with Access Code (Recommended)

#### Setup:

1. **Create `.env.local` file** in project root:
   ```env
   VITE_ACCESS_CODE=test123
   ```

2. **Restart dev server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

3. **Test**:
   - Go to `http://localhost:3000`
   - Enter access code: `test123`
   - Should proceed to login screen ✅

#### How It Works:
- Uses `VITE_ACCESS_CODE` for local development
- Validates on client-side (for development)
- Serverless function not needed locally

---

### Option 2: Test Without Access Code (Development Mode)

#### Setup:

**Don't set `VITE_ACCESS_CODE`** in `.env.local`

#### Test:

1. Go to `http://localhost:3000`
2. **In development mode**, if no access code is set, it will:
   - Allow access automatically
   - Skip to login screen
   - Show a message in console

#### How It Works:
- Detects `import.meta.env.DEV` (development mode)
- Allows access if no code configured
- Makes local development easier

---

### Option 3: Test Serverless Function Locally (Advanced)

#### Setup:

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm i -g vercel
   ```

2. **Run Vercel dev**:
   ```bash
   vercel dev
   ```

3. **Set environment variable**:
   - Create `.env.local`:
     ```env
     ACCESS_CODE=test123
     ```
   - Note: Use `ACCESS_CODE` (not `VITE_ACCESS_CODE`) for serverless functions

4. **Test**:
   - Go to `http://localhost:3000`
   - Access code validation will use serverless function
   - More similar to production

---

## 📋 Step-by-Step Testing Guide

### Test 1: Access Code Screen

1. **Start server**: `npm run dev`
2. **Visit**: `http://localhost:3000`
3. **Expected**: See "Access Required" screen
4. **Verify**: 
   - ✅ Shows "Enter the access code to continue"
   - ✅ Input field for access code
   - ✅ "Continue" button

### Test 2: Invalid Access Code

1. **Set access code** in `.env.local`:
   ```env
   VITE_ACCESS_CODE=correct123
   ```

2. **Restart server**: `npm run dev`

3. **Enter wrong code**: Try `wrong123`

4. **Expected**: 
   - ✅ Error message: "Invalid access code. Access denied."
   - ✅ Input cleared
   - ✅ Stays on access code screen

### Test 3: Valid Access Code

1. **Enter correct code**: `correct123`

2. **Expected**:
   - ✅ Redirects to `/login`
   - ✅ Shows login screen
   - ✅ Access granted for session

### Test 4: Login Flow

1. **After access code**, you should see login screen

2. **First time** (no password set):
   - ✅ Shows "Set Up Password"
   - ✅ Enter password
   - ✅ Confirm password
   - ✅ Sets password and logs in

3. **Subsequent times**:
   - ✅ Shows "Secure Access"
   - ✅ Enter password
   - ✅ Logs in

### Test 5: Session Persistence

1. **Enter access code** → Login → Access app

2. **Navigate around**:
   - ✅ Can access all pages
   - ✅ Access code not required again (same session)

3. **Close browser tab**:
   - ✅ Open new tab
   - ✅ Must enter access code again
   - ✅ Session cleared

### Test 6: Protected Routes

1. **Try direct URL**: `http://localhost:3000/transactions`

2. **Expected**:
   - ✅ Redirects to `/access` (access code screen)
   - ✅ Must enter access code first
   - ✅ Then login
   - ✅ Then can access route

---

## 🛠️ Environment Variables for Local Testing

### Create `.env.local` file:

```env
# Access Code (for local testing)
VITE_ACCESS_CODE=test123

# Google Sheets (if testing Google Sheets integration)
VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL=your_url_here
```

### Important Notes:

- ✅ `.env.local` is in `.gitignore` (won't be committed)
- ✅ Use `VITE_` prefix for client-side variables
- ✅ Restart server after changing `.env.local`
- ✅ `VITE_ACCESS_CODE` is for local development only

---

## 🐛 Troubleshooting

### "Access code not working"

**Check:**
1. Is `.env.local` file created?
2. Is `VITE_ACCESS_CODE` set correctly?
3. Did you restart the dev server?
4. Check browser console for errors

**Solution:**
```bash
# Stop server
# Create/update .env.local
# Restart server
npm run dev
```

### "Always allows access (no access code screen)"

**Reason**: Development mode allows access if no code is set

**Solution**: Set `VITE_ACCESS_CODE` in `.env.local`

### "Serverless function not working locally"

**Reason**: Serverless functions need Vercel CLI or production

**Solution**: 
- Use `VITE_ACCESS_CODE` for local testing (client-side)
- Or install Vercel CLI: `npm i -g vercel` and run `vercel dev`

### "Can't access routes directly"

**Expected behavior**: All routes require access code first

**Solution**: This is correct! Enter access code, then login, then access routes.

---

## 📝 Testing Checklist

- [ ] Access code screen appears on first visit
- [ ] Invalid access code shows error
- [ ] Valid access code redirects to login
- [ ] Login screen appears after access code
- [ ] Can set password on first login
- [ ] Can login with password after setting
- [ ] Protected routes redirect to access code
- [ ] Session persists during navigation
- [ ] Session clears on browser close
- [ ] Must re-enter access code in new session

---

## 🎯 Quick Test Commands

```bash
# Start dev server
npm run dev

# Test with access code
# 1. Create .env.local with VITE_ACCESS_CODE=test123
# 2. Restart server
# 3. Visit http://localhost:3000
# 4. Enter: test123

# Test without access code (dev mode)
# 1. Don't set VITE_ACCESS_CODE
# 2. Visit http://localhost:3000
# 3. Should auto-allow in dev mode
```

---

## 💡 Pro Tips

1. **Use different codes** for local vs production
   - Local: `test123` or `dev123`
   - Production: Strong, unique code

2. **Test both flows**:
   - With access code set
   - Without access code (dev mode)

3. **Check browser console** for any errors

4. **Test in incognito mode** to simulate new sessions

5. **Clear localStorage/sessionStorage** to test first-time flows:
   ```javascript
   // In browser console:
   localStorage.clear();
   sessionStorage.clear();
   ```

---

## 🚀 Ready to Test!

1. **Start server**: `npm run dev`
2. **Open browser**: `http://localhost:3000`
3. **Test access code flow**
4. **Test login flow**
5. **Test protected routes**

Everything should work just like production! 🎉

