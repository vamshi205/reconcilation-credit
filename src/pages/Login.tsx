import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { AuthService } from "../services/authService";
import { Lock, AlertCircle, Key } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (AuthService.isAuthenticated()) {
      navigate("/", { replace: true });
      return;
    }

    // Check if this is first-time setup (no password set)
    setIsFirstTime(!AuthService.hasPassword());
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isFirstTime) {
        // First time - set password
        if (password.length < 4) {
          setError("Password must be at least 4 characters long.");
          setIsLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match. Please try again.");
          setConfirmPassword("");
          setIsLoading(false);
          return;
        }

        const success = AuthService.setPassword(password);
        if (success) {
          navigate("/", { replace: true });
        } else {
          setError("Failed to set password. Please try again.");
        }
      } else {
        // Regular login
        const success = AuthService.login(password);
        
        if (success) {
          navigate("/", { replace: true });
        } else {
          setError("Incorrect password. Please try again.");
          setPassword("");
        }
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="glass-card border-2 border-border/60 w-full max-w-md animate-fade-in">
        <CardHeader className="bg-muted/30 border-b border-border/60 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              {isFirstTime ? (
                <Key className="h-8 w-8 text-primary" />
              ) : (
                <Lock className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-display">
            {isFirstTime ? "Set Up Password" : "Secure Access"}
          </CardTitle>
          <p className="text-muted-foreground mt-2 text-sm">
            {isFirstTime
              ? "Create a password to secure your application"
              : "Enter your password to access the application"}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isFirstTime ? "Enter a secure password" : "Enter your password"}
                autoFocus
                disabled={isLoading}
                className="w-full"
              />
            </div>

            {isFirstTime && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={
                isLoading ||
                !password.trim() ||
                (isFirstTime && (!confirmPassword.trim() || password !== confirmPassword))
              }
              className="w-full btn-gradient"
            >
              {isLoading
                ? isFirstTime
                  ? "Setting up..."
                  : "Authenticating..."
                : isFirstTime
                ? "Set Password"
                : "Login"}
            </Button>
          </form>

          {!isFirstTime && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border/60">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Password is stored locally in your browser. If you clear browser data, you'll need to set a new password.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

