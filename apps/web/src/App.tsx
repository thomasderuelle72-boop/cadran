import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { RatiosPage } from "./pages/Ratios";
import { ImportPage } from "./pages/Import";
import { ReportsPage } from "./pages/Reports";
import { SettingsPage } from "./pages/Settings";
import { BudgetPage } from "./pages/Budget";
import { AlertsPage } from "./pages/Alerts";
import { CashPage } from "./pages/Cash";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/ratios" element={<RatiosPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/cash" element={<CashPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
