import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useLogin } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { ApiError, cookiesRefuses } from "../api/client";
import { CadreAuth } from "../components/CadreAuth";

export function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const [email, setEmail] = useState("demo@cadran.fr");
  const [password, setPassword] = useState("CadranDemo123!");
  const [error, setError] = useState<string | null>(null);

  /* Posé par l'écran de nouveau mot de passe : sans ce retour, la
   * réinitialisation se terminait sur un écran de connexion muet, qui ne
   * disait pas si elle avait abouti. */
  const motDePasseChange =
    (location.state as { motDePasseChange?: boolean } | null)?.motDePasseChange === true;

  if (isAuthenticated) return <Navigate to="/tableau-de-bord" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await loginMutation.mutateAsync({ email, password });
      /*
       * La requête a abouti, mais le cookie a-t-il été accepté ? Sans ce
       * contrôle, un navigateur qui les refuse renvoie l'utilisateur sur cet
       * écran sans un mot d'explication — il conclut que son mot de passe est
       * faux.
       */
      if (cookiesRefuses()) {
        setError(
          "Votre navigateur a refusé le cookie de session. Safari et les navigateurs "
            + "en navigation privée bloquent les cookies dits tiers ; Cadran servant "
            + "son interface et son API depuis deux domaines, le nôtre en est un. "
            + "Autorisez les cookies pour ce site, ou utilisez Chrome ou Firefox."
        );
        return;
      }
      login();
      navigate("/tableau-de-bord");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    }
  }

  return (
    <CadreAuth titre="Connexion">
      {motDePasseChange && (
        <p className="text-sm text-success border border-success/30 bg-success-soft rounded px-3 py-2">
          Mot de passe enregistré. Connectez-vous avec le nouveau.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="connexion-email">
            E-mail
          </label>
          <input
            id="connexion-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="label" htmlFor="connexion-mdp">
              Mot de passe
            </label>
            <Link to="/mot-de-passe/oubli" className="text-xs text-primary hover:underline">
              Oublié ?
            </Link>
          </div>
          <input
            id="connexion-mdp"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-critical text-sm">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p className="text-xs text-ink/50 text-center">
        Identifiants de démonstration pré-remplis. Pas de compte ?{" "}
        <Link to="/register" className="text-primary hover:underline">
          Créer une organisation
        </Link>
      </p>
    </CadreAuth>
  );
}
