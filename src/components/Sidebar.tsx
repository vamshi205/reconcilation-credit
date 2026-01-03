import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Plus, Upload, List, Users, Menu, X, Sparkles, LogOut, ChevronDown, ChevronRight, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { AuthService } from "../services/authService";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Manual Entry", href: "/manual-entry", icon: Plus },
  { name: "CSV Upload", href: "/csv-upload", icon: Upload },
  { name: "Credit Transactions", href: "/transactions", icon: List },
  { name: "Debit Transactions", href: "/debit-transactions", icon: List },
];

const utilityMenu = {
  name: "Utility",
  icon: Settings,
  items: [
    { name: "Parties", href: "/parties", icon: Users },
    { name: "Suppliers", href: "/suppliers", icon: Users },
    { name: "Party Mappings", href: "/party-mappings", icon: Sparkles },
    { name: "Supplier Mappings", href: "/supplier-mappings", icon: Sparkles },
  ],
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    icon: React.ReactNode;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'warning' | 'info' | 'danger';
  } | null>(null);

  const handleLogout = () => {
    setConfirmationModal({
      isOpen: true,
      title: "Logout",
      message: `Are you sure you want to logout?\n\n` +
        `You will be redirected to the login page.`,
      icon: <LogOut className="h-8 w-8 text-red-600" />,
      variant: 'danger',
      confirmText: "Yes, Logout",
      cancelText: "Cancel",
      onConfirm: () => {
        AuthService.logout();
        navigate("/login", { replace: true });
      }
    });
  };

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
          "fixed top-0 left-0 z-40 h-full w-64 bg-sidebar border-r border-sidebar-border shadow-lg transform transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-sidebar-border">
            <h1 className="text-2xl font-display font-bold text-foreground">Credit Records</h1>
            <p className="text-sm text-muted-foreground mt-1">Transaction Manager</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
            
            {/* Utility Menu */}
            <div className="mt-2">
              <button
                onClick={() => setUtilityMenuOpen(!utilityMenuOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md transition-all duration-200 group",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <utilityMenu.icon className="h-5 w-5" />
                  <span className="font-medium">{utilityMenu.name}</span>
                </div>
                {utilityMenuOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {utilityMenuOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-sidebar-border pl-2">
                  {utilityMenu.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 rounded-md transition-all duration-200 group",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Logout button */}
          <div className="p-4 border-t border-sidebar-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Confirmation Modal */}
      {confirmationModal && (
        <Modal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(null)}
          title=""
        >
          <div className="space-y-6">
            {/* Icon and Title */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={cn(
                "p-4 rounded-full",
                confirmationModal.variant === 'warning' && "bg-yellow-100",
                confirmationModal.variant === 'info' && "bg-blue-100",
                confirmationModal.variant === 'danger' && "bg-red-100"
              )}>
                {confirmationModal.icon}
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                {confirmationModal.title}
              </h3>
            </div>

            {/* Message */}
            <div className="text-center">
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {confirmationModal.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setConfirmationModal(null)}
              >
                {confirmationModal.cancelText || "Cancel"}
              </Button>
              <Button
                onClick={confirmationModal.onConfirm}
                className={cn(
                  confirmationModal.variant === 'warning' && "bg-yellow-600 hover:bg-yellow-700",
                  confirmationModal.variant === 'info' && "bg-blue-600 hover:bg-blue-700",
                  confirmationModal.variant === 'danger' && "bg-red-600 hover:bg-red-700",
                  !confirmationModal.variant && "btn-gradient"
                )}
              >
                {confirmationModal.confirmText || "Confirm"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

