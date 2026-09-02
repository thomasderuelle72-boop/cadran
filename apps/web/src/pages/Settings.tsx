import { useState } from "react";
import { useCreateOrgUser, useOrgUsers } from "../api/hooks";
import { ApiError } from "../api/client";
import type { Role } from "../api/types";
import { useAuth } from "../context/AuthContext";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  DAF: "Directeur financier",
  CONTROLEUR: "Contrôleur de gestion",
  LECTEUR: "Lecteur",
};

export function SettingsPage() {
  const { user } = useAuth();
  const { data: users } = useOrgUsers();
  const createUser = useCreateOrgUser();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "LECTEUR" as Role });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    try {
      await createUser.mutateAsync(form);
      setForm({ name: "", email: "", password: "", role: "LECTEUR" });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible.");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Paramètres</h1>
        <p className="text-sm text-ink/50">Organisation : {user?.organizationName}</p>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold mb-3">Utilisateurs</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
              <th className="py-2">Nom</th>
              <th className="py-2">E-mail</th>
              <th className="py-2">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-black/5 last:border-0">
                <td className="py-2 font-medium">{u.name}</td>
                <td className="py-2 text-ink/60">{u.email}</td>
                <td className="py-2 text-ink/60">{ROLE_LABELS[u.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-display text-lg font-semibold">Ajouter un utilisateur</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Mot de passe temporaire</label>
            <input
              type="password"
              minLength={8}
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Rôle</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-critical text-sm">{error}</p>}
        {success && <p className="text-success text-sm">Utilisateur créé.</p>}
        <button type="submit" className="btn-primary" disabled={createUser.isPending}>
          {createUser.isPending ? "Création…" : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
