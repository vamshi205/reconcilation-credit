// Authentication Service
// Server-side authentication using USER_ID and PASSWORD from environment variables
// No localStorage - works across multiple devices
// Credentials validated via serverless function

const AUTH_TOKEN_KEY = 'app_auth_token'; // Use sessionStorage, not localStorage

export class AuthService {
  /**
   * Check if user is authenticated
   * Uses sessionStorage (clears on browser close, but works across devices)
   */
  static isAuthenticated(): boolean {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    return !!token && token !== '';
  }

  /**
   * Login with user ID and password
   * Validates via serverless function (server-side) or local env vars (development)
   * @param userId - User ID
   * @param password - Password
   * @returns Promise<boolean> - true if login successful
   */
  static async login(userId: string, password: string): Promise<boolean> {
    if (!userId || !password) {
      return false;
    }

    try {
      // In development mode, check local environment variables directly
      // Note: This is less secure but necessary for local development
      if (import.meta.env.DEV) {
        const validUserId = import.meta.env.VITE_USER_ID;
        const validPassword = import.meta.env.VITE_APP_PASSWORD;

        if (validUserId && validPassword) {
          const trimmedInputUserId = String(userId).trim();
          const trimmedInputPassword = String(password).trim();
          const trimmedValidUserId = String(validUserId).trim();
          const trimmedValidPassword = String(validPassword).trim();

          if (trimmedInputUserId === trimmedValidUserId && 
              trimmedInputPassword === trimmedValidPassword) {
            // Generate a simple session token for local dev
            const sessionToken = btoa(`${Date.now()}-${Math.random()}`);
            sessionStorage.setItem(AUTH_TOKEN_KEY, sessionToken);
            console.log('✅ Local development authentication successful');
            return true;
          } else {
            console.log('❌ Local development authentication failed - invalid credentials');
            return false;
          }
        } else {
          console.warn('⚠️ VITE_USER_ID or VITE_APP_PASSWORD not set in .env.local for local development');
        }
      }

      // Production mode: Use serverless function
      const apiUrl = import.meta.env.PROD 
        ? `${window.location.origin}/api/authenticate`
        : '/api/authenticate';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, password }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Server returned non-JSON response');
        // If API endpoint doesn't exist (local dev without vercel), fall back to local check
        if (import.meta.env.DEV && response.status === 404) {
          console.warn('⚠️ API endpoint not found. Make sure to add VITE_USER_ID and VITE_APP_PASSWORD to .env.local for local development');
        }
        return false;
      }

      const result = await response.json();

      if (response.ok && result.success && result.token) {
        // Store session token in sessionStorage (not localStorage)
        // This works across devices for the same browser session
        sessionStorage.setItem(AUTH_TOKEN_KEY, result.token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  /**
   * Logout user
   * Clears session token
   */
  static logout(): void {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  }

  /**
   * Get current session token
   */
  static getToken(): string | null {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  }
}

