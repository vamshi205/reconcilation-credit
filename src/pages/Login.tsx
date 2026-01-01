import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { AuthService } from "../services/authService";
import { Lock, AlertCircle, User } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (AuthService.isAuthenticated()) {
      navigate("/", { replace: true });
      return;
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!userId.trim() || !password.trim()) {
        setError("Please enter both User ID and Password.");
        setIsLoading(false);
        return;
      }

      // Authenticate via serverless function
      const success = await AuthService.login(userId.trim(), password.trim());
      
      if (success) {
        navigate("/", { replace: true });
      } else {
        setError("Invalid User ID or Password. Please try again.");
        setPassword("");
      }
    } catch (err) {
      console.error('Login error:', err);
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
              <User className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display">Secure Access</CardTitle>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your User ID and Password to access the application
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your User ID"
                autoFocus
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                className="w-full"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !userId.trim() || !password.trim()}
              className="w-full btn-gradient"
            >
              {isLoading ? "Authenticating..." : "Login"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border/60">
            <p className="text-xs text-muted-foreground text-center">
              <strong>Note:</strong> Credentials are validated on the server. Session expires when you close the browser.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

