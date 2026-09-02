import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useLogin } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [email, setEmail] = useState("demo@cadran.fr");
  const [password, setPassword] = useState("CadranDemo123!");
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      login(result.accessToken, result.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span
            className="w-7 h-7 rounded-full flex-none"
            style={{ background: "conic-gradient(from -90deg, #9C5F26 0 25%, #E5E7DD 25% 100%)" }}
          />
          <span className="font-display font-semibold text-2xl">Cadran</span>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h1 className="font-display text-lg font-semibold">Connexion</h1>
          <div>
            <label className="label">E-mail</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-critical text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Connexion…" : "Se connecter"}
          </button>
          <p className="text-xs text-ink/50 text-center">
            Identifiants de démonstration pré-remplis. Pas de compte ?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Créer une organisation
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
