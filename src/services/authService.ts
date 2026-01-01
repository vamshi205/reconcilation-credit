// Authentication Service
// Simple password-based authentication for single-user applications
// Password is set on first login and stored in localStorage (not in code or env variables)

const AUTH_KEY = 'app_auth_token';
const PASSWORD_KEY = 'app_password_hash';

// Simple hash function (for basic security - in production, use proper hashing)
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export class AuthService {
  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const token = localStorage.getItem(AUTH_KEY);
    return token === 'authenticated';
  }

  /**
   * Check if password has been set (first-time setup check)
   */
  static hasPassword(): boolean {
    return !!localStorage.getItem(PASSWORD_KEY);
  }

  /**
   * Set password (for first-time setup)
   * @param password - The password to set
   * @returns true if password set successfully
   */
  static setPassword(password: string): boolean {
    if (!password || password.length < 4) {
      return false;
    }
    const hash = simpleHash(password);
    localStorage.setItem(PASSWORD_KEY, hash);
    // Auto-login after setting password
    localStorage.setItem(AUTH_KEY, 'authenticated');
    return true;
  }

  /**
   * Login with password
   * @param password - The password to authenticate with
   * @returns true if login successful, false otherwise
   */
  static login(password: string): boolean {
    const storedHash = localStorage.getItem(PASSWORD_KEY);
    
    // If no password is set, this is first-time access - allow setting password
    if (!storedHash) {
      // Allow access without password on first visit
      // User will be prompted to set password
      return true;
    }

    // Check password against stored hash
    const inputHash = simpleHash(password);
    if (inputHash === storedHash) {
      localStorage.setItem(AUTH_KEY, 'authenticated');
      return true;
    }

    return false;
  }

  /**
   * Logout user
   */
  static logout(): void {
    localStorage.removeItem(AUTH_KEY);
    // Note: Password hash remains in localStorage for next login
  }

  /**
   * Change password (requires current password)
   * @param oldPassword - Current password
   * @param newPassword - New password
   * @returns true if password changed successfully
   */
  static changePassword(oldPassword: string, newPassword: string): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (!newPassword || newPassword.length < 4) {
      return false;
    }

    const hash = localStorage.getItem(PASSWORD_KEY);
    if (!hash) {
      // No password set, just set new one
      return this.setPassword(newPassword);
    }

    // Verify old password
    const oldHash = simpleHash(oldPassword);
    if (oldHash !== hash) {
      return false;
    }

    // Set new password
    const newHash = simpleHash(newPassword);
    localStorage.setItem(PASSWORD_KEY, newHash);
    return true;
  }

  /**
   * Clear all auth data (for reset)
   */
  static reset(): void {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(PASSWORD_KEY);
  }
}

