import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AccessCode } from "./pages/AccessCode";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ManualEntry } from "./pages/ManualEntry";
import { CSVUpload } from "./pages/CSVUpload";
import { Transactions } from "./pages/Transactions";
import { Reconciliation } from "./pages/Reconciliation";
import { Parties } from "./pages/Parties";
import { PartyMappings } from "./pages/PartyMappings";

// Check if access code has been granted
function hasAccessCode(): boolean {
  return sessionStorage.getItem('app_access_granted') === 'true';
}

// Component to protect routes with access code
function AccessCodeProtected({ children }: { children: React.ReactNode }) {
  if (!hasAccessCode()) {
    return <Navigate to="/access" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Access code route - first gate */}
        <Route path="/access" element={<AccessCode />} />
        
        {/* Login route - requires access code */}
        <Route
          path="/login"
          element={
            <AccessCodeProtected>
              <Login />
            </AccessCodeProtected>
          }
        />
        
        {/* Protected routes - require both access code and authentication */}
        <Route
          path="/*"
          element={
            <AccessCodeProtected>
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
                        <Route path="/reconciliation" element={<Reconciliation />} />
                        <Route path="/parties" element={<Parties />} />
                        <Route path="/party-mappings" element={<PartyMappings />} />
                      </Routes>
                    </div>
                  </main>
                </div>
              </ProtectedRoute>
            </AccessCodeProtected>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
