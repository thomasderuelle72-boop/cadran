import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Accueil } from "./pages/Accueil";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { RatiosPage } from "./pages/Ratios";
import { AnalysisPage } from "./pages/Analysis";
import { ReceivablesPage } from "./pages/Receivables";
import { DiagnosticPage } from "./pages/Diagnostic";
import { ActionsPage } from "./pages/Actions";
import { ImportPage } from "./pages/Import";
import { ReportsPage } from "./pages/Reports";
import { SettingsPage } from "./pages/Settings";
import { BudgetPage } from "./pages/Budget";
import { AlertsPage } from "./pages/Alerts";
import { CashPage } from "./pages/Cash";

/**
 * La racine sert deux publics.
 *
 * Un visiteur y trouve la page de présentation ; un utilisateur connecté n'a
 * rien à y faire et part directement à son tableau de bord. Le temps de
 * vérifier le jeton, on n'affiche ni l'un ni l'autre : montrer la page
 * commerciale à un client qui revient, même une demi-seconde, donne
 * l'impression d'avoir été déconnecté.
 */
function Racine() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-paper" />;
  return isAuthenticated ? <Navigate to="/tableau-de-bord" replace /> : <Accueil />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Racine />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/tableau-de-bord" element={<Dashboard />} />
        <Route path="/ratios" element={<RatiosPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/receivables" element={<ReceivablesPage />} />
        <Route path="/diagnostic" element={<DiagnosticPage />} />
        <Route path="/actions" element={<ActionsPage />} />
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
