import { Navigate } from "react-router-dom";
import { AuthService } from "../services/authService";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = AuthService.isAuthenticated();

  if (!isAuthenticated) {
    // Check if access code is granted (for redirect)
    const hasAccessCode = sessionStorage.getItem('app_access_granted') === 'true';
    if (hasAccessCode) {
      return <Navigate to="/login" replace />;
    }
    // If no access code, redirect to access code screen
    return <Navigate to="/access" replace />;
  }

  return <>{children}</>;
}

