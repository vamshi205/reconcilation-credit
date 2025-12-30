import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { ManualEntry } from "./pages/ManualEntry";
import { CSVUpload } from "./pages/CSVUpload";
import { Transactions } from "./pages/Transactions";
import { Reconciliation } from "./pages/Reconciliation";
import { Parties } from "./pages/Parties";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="lg:ml-64 p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/manual-entry" element={<ManualEntry />} />
            <Route path="/csv-upload" element={<CSVUpload />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/reconciliation" element={<Reconciliation />} />
            <Route path="/parties" element={<Parties />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
