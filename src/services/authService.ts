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
   * Validates via serverless function (server-side)
   * @param userId - User ID
   * @param password - Password
   * @returns Promise<boolean> - true if login successful
   */
  static async login(userId: string, password: string): Promise<boolean> {
    if (!userId || !password) {
      return false;
    }

    try {
      // Use absolute URL for production, relative for development
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

