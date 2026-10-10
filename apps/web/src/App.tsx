import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PlateformePage } from "./pages/Plateforme";
import { EvolutionPage } from "./pages/Evolution";
import { PrevisionnelPage } from "./pages/Previsionnel";
import { BilanPage } from "./pages/Bilan";
import { RapportClientPage } from "./pages/RapportClient";
import { PortefeuillePage } from "./pages/Portefeuille";
import { OpportunitesPage } from "./pages/Opportunites";
import { ValeurCreeePage } from "./pages/ValeurCreee";
import { Accueil } from "./pages/Accueil";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { MotDePasseOubli } from "./pages/MotDePasseOubli";
import { MotDePasseNouveau } from "./pages/MotDePasseNouveau";
import { MentionsLegales } from "./pages/MentionsLegales";
import { Confidentialite } from "./pages/Confidentialite";
import { CGV } from "./pages/CGV";
import { Dashboard } from "./pages/Dashboard";
import { AnalysisPage } from "./pages/Analysis";
import { ReceivablesPage } from "./pages/Receivables";
import { DiagnosticPage } from "./pages/Diagnostic";
import { ActionsPage } from "./pages/Actions";
import { ImportPage } from "./pages/Import";
import { ReportsPage } from "./pages/Reports";
import { SettingsPage } from "./pages/Settings";
import { AbonnementPage } from "./pages/Abonnement";
import { ConseilPage } from "./pages/Conseil";
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
      <Route path="/mot-de-passe/oubli" element={<MotDePasseOubli />} />
      <Route path="/mot-de-passe/nouveau" element={<MotDePasseNouveau />} />
      {/* Publiques et accessibles sans compte : leur raison d'être est
          d'informer un visiteur avant qu'il ne s'engage. */}
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      <Route path="/cgv" element={<CGV />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/tableau-de-bord" element={<Dashboard />} />
        {/* Anciennes adresses : les ratios vivent dans le diagnostic, le
            pluriannuel est devenu Évolution et Prévisionnel. */}
        <Route path="/ratios" element={<Navigate to="/diagnostic" replace />} />
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
        <Route path="/conseil" element={<ConseilPage />} />
        <Route path="/abonnement" element={<AbonnementPage />} />
        <Route path="/pluriannuel" element={<Navigate to="/evolution" replace />} />
        <Route path="/bilan" element={<BilanPage />} />
        <Route path="/rapport-client" element={<RapportClientPage />} />
        <Route path="/evolution" element={<EvolutionPage />} />
        <Route path="/previsionnel" element={<PrevisionnelPage />} />
        <Route path="/portefeuille" element={<PortefeuillePage />} />
        <Route path="/opportunites" element={<OpportunitesPage />} />
        <Route path="/valeur-creee" element={<ValeurCreeePage />} />
        <Route path="/plateforme" element={<PlateformePage />} />
      </Route>
    </Routes>
  );
}
