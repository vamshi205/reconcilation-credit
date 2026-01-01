import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Shield, AlertCircle } from "lucide-react";

const ACCESS_CODE_KEY = 'app_access_granted';

export function AccessCode() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Check if access was already granted in this session
  const hasAccess = sessionStorage.getItem(ACCESS_CODE_KEY) === 'true';

  if (hasAccess) {
    // Redirect to login if access already granted
    navigate("/login", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Try to validate via serverless function first (more secure)
      try {
        // Use absolute URL for production, relative for development
        const apiUrl = import.meta.env.PROD 
          ? `${window.location.origin}/api/verify-access`
          : '/api/verify-access';
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessCode }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Access granted via server
          sessionStorage.setItem(ACCESS_CODE_KEY, 'true');
          navigate("/login", { replace: true });
          return;
        } else {
          // Server validation failed
          setError(result.error || "Invalid access code. Access denied.");
          setAccessCode("");
          setIsLoading(false);
          return;
        }
      } catch (apiError) {
        // If serverless function doesn't exist or fails, fall back to client-side
        // This allows development without serverless function
        const validAccessCode = import.meta.env.VITE_ACCESS_CODE || '';
        
        if (!validAccessCode) {
          // If no access code is set anywhere, deny access in production
          // Allow in development (when running locally)
          if (import.meta.env.DEV) {
            sessionStorage.setItem(ACCESS_CODE_KEY, 'true');
            navigate("/login", { replace: true });
            return;
          } else {
            setError("Access code not configured. Please set ACCESS_CODE in Vercel environment variables.");
            setIsLoading(false);
            return;
          }
        }

        if (accessCode === validAccessCode) {
          // Grant access for this session (client-side fallback)
          sessionStorage.setItem(ACCESS_CODE_KEY, 'true');
          navigate("/login", { replace: true });
        } else {
          setError("Invalid access code. Access denied.");
          setAccessCode("");
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
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display">Access Required</CardTitle>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter the access code to continue
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessCode">Access Code</Label>
              <Input
                id="accessCode"
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter access code"
                autoFocus
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
              disabled={isLoading || !accessCode.trim()}
              className="w-full btn-gradient"
            >
              {isLoading ? "Verifying..." : "Continue"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border/60">
            <p className="text-xs text-muted-foreground text-center">
              <strong>Restricted Access:</strong> This application is private. Only authorized users can proceed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

