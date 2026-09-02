import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useRegister } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function Register() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [form, setForm] = useState({ organizationName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await registerMutation.mutateAsync(form);
      login(result.accessToken, result.user);
      navigate("/import");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible.");
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
          <h1 className="font-display text-lg font-semibold">Créer votre organisation</h1>
          <div>
            <label className="label">Nom de l'entreprise</label>
            <input
              className="input"
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Votre nom</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Mot de passe (8 caractères min.)</label>
            <input
              className="input"
              type="password"
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
          <p className="text-xs text-ink/50 text-center">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
