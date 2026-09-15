import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useRegister } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { ApiError, cookiesRefuses } from "../api/client";
import { CadreAuth } from "../components/CadreAuth";

export function Register() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [form, setForm] = useState({ organizationName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) return <Navigate to="/tableau-de-bord" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await registerMutation.mutateAsync(form);
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
      navigate("/import");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible.");
    }
  }

  return (
    <CadreAuth titre="Créer votre organisation">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="inscription-organisation">
            Nom de l'entreprise
          </label>
          <input
            id="inscription-organisation"
            className="input"
            autoComplete="organization"
            value={form.organizationName}
            onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="inscription-nom">
            Votre nom
          </label>
          <input
            id="inscription-nom"
            className="input"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="inscription-email">
            E-mail
          </label>
          <input
            id="inscription-email"
            className="input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="inscription-mdp">
            Mot de passe (8 caractères min.)
          </label>
          <input
            id="inscription-mdp"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        {error && <p className="text-critical text-sm">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "Création…" : "Créer mon compte"}
        </button>
      </form>
      <p className="text-xs text-ink/50 text-center">
        Déjà un compte ?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </CadreAuth>
  );
}
