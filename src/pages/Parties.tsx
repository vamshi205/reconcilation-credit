import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PartiesListService, PartySummary } from "../services/partiesListService";
import { formatCurrency } from "../lib/utils";
import { AuthService } from "../services/authService";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Search, RefreshCw, Eye, LogOut } from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { cn } from "../lib/utils";

export function Parties() {
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
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParties = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const partiesList = await PartiesListService.getPartiesList();
      setParties(partiesList);
      
      if (partiesList.length === 0) {
        setError('No parties found. Make sure you have transactions with party names assigned.');
      }
    } catch (error) {
      console.error("[Parties] Error loading parties:", error);
      setError(`Error loading parties: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setParties([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadParties();
  }, []);

  const handleRefresh = () => {
    loadParties();
  };

  const handleViewTransactions = (partyName: string) => {
    // Navigate to Transactions page with party name in search query and view set to completed
    navigate(`/transactions?party=${encodeURIComponent(partyName)}&view=completed`);
  };

  // Filter parties based on search query
  const filteredParties = parties.filter((party) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return party.name.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-gradient">
            Parties
          </h1>
          <p className="text-muted-foreground mt-2">
            View parties with total amounts from completed transactions only
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
              placeholder="Search parties..."
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
              <p>Loading parties...</p>
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
                <li>• Check if you have transactions in the Transactions page</li>
                <li>• Make sure transactions have party names assigned</li>
                <li>• Click Refresh to reload data</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : filteredParties.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="mb-2 font-medium">No parties found.</p>
            <p className="text-sm">Make sure you have transactions with party names assigned.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredParties.map((party, index) => (
            <Card key={`${party.name}-${index}`} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{party.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {party.transactionCount} completed transaction{party.transactionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p
                        className={`text-2xl font-bold ${
                          party.totalAmount >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {party.totalAmount >= 0 ? "+" : ""}
                        {formatCurrency(party.totalAmount)}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleViewTransactions(party.name)}
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
