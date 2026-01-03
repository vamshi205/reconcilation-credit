import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ManualEntry } from "./pages/ManualEntry";
import { CSVUpload } from "./pages/CSVUpload";
import { Transactions } from "./pages/Transactions";
import { DebitTransactions } from "./pages/DebitTransactions";
import { Reconciliation } from "./pages/Reconciliation";
import { Parties } from "./pages/Parties";
import { Suppliers } from "./pages/Suppliers";
import { PartyMappings } from "./pages/PartyMappings";
import { SupplierMappings } from "./pages/SupplierMappings";

function App() {
  return (
    <Router>
      <Routes>
        {/* Login route - public */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected routes - require authentication */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-gradient-hero">
                <Sidebar />
                <main className="lg:ml-64 min-h-screen">
                  <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/manual-entry" element={<ManualEntry />} />
                      <Route path="/csv-upload" element={<CSVUpload />} />
                      <Route path="/transactions" element={<Transactions />} />
                      <Route path="/debit-transactions" element={<DebitTransactions />} />
                      <Route path="/reconciliation" element={<Reconciliation />} />
                      <Route path="/parties" element={<Parties />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/party-mappings" element={<PartyMappings />} />
                      <Route path="/supplier-mappings" element={<SupplierMappings />} />
                    </Routes>
                  </div>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
        
        {/* Redirect root to login if not authenticated (handled by ProtectedRoute) */}
      </Routes>
    </Router>
  );
}

export default App;
