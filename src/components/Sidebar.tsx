import { Link, useLocation } from "react-router-dom";
import { Home, Plus, Upload, List, CheckSquare, Users, Menu, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Manual Entry", href: "/manual-entry", icon: Plus },
  { name: "CSV Upload", href: "/csv-upload", icon: Upload },
  { name: "Transactions", href: "/transactions", icon: List },
  { name: "Reconciliation", href: "/reconciliation", icon: CheckSquare },
  { name: "Parties", href: "/parties", icon: Users },
  { name: "Party Mappings", href: "/party-mappings", icon: Sparkles },
];

export function Sidebar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md bg-card border border-input"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile sidebar */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-border">
            <h1 className="text-xl font-bold">Credit Records</h1>
            <p className="text-sm text-muted-foreground mt-1">Manager</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

