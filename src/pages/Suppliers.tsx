import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SuppliersListService, SupplierSummary } from "../services/suppliersListService";
import { formatCurrency } from "../lib/utils";
import { AuthService } from "../services/authService";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Search, RefreshCw, Eye, LogOut } from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { cn } from "../lib/utils";

export function Suppliers() {
  const navigate = useNavigate();
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
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const suppliersList = await SuppliersListService.getSuppliersList();
      setSuppliers(suppliersList);
      
      if (suppliersList.length === 0) {
        setError('No suppliers found. Make sure you have debit transactions with supplier names assigned.');
      }
    } catch (error) {
      console.error("[Suppliers] Error loading suppliers:", error);
      setError(`Error loading suppliers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSuppliers([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadSuppliers();
  }, []);

  const handleRefresh = () => {
    loadSuppliers();
  };

  const handleViewTransactions = (supplierName: string) => {
    // Navigate to Debit Transactions page with supplier name in search query and view set to completed
    navigate(`/debit-transactions?supplier=${encodeURIComponent(supplierName)}&view=completed`);
  };

  // Filter suppliers based on search query
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return supplier.name.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-gradient">
            Suppliers
          </h1>
          <p className="text-muted-foreground mt-2">
            View suppliers with total amounts from completed debit transactions only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
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
            }}
            className="flex items-center gap-2 border-slate-300 hover:bg-red-50 hover:border-red-400 hover:text-red-700 shadow-sm"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p>Loading suppliers...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <p className="mb-2 font-medium text-destructive">{error}</p>
              <p className="text-sm mt-4">Troubleshooting:</p>
              <ul className="text-sm text-left mt-2 space-y-1 max-w-md mx-auto">
                <li>• Check if you have debit transactions in the Debit Transactions page</li>
                <li>• Make sure debit transactions have supplier names assigned</li>
                <li>• Click Refresh to reload data</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="mb-2 font-medium">No suppliers found.</p>
            <p className="text-sm">Make sure you have debit transactions with supplier names assigned.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredSuppliers.map((supplier, index) => (
            <Card key={`${supplier.name}-${index}`} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{supplier.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {supplier.transactionCount} completed transaction{supplier.transactionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(supplier.totalAmount)}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleViewTransactions(supplier.name)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}

