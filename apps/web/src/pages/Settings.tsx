import { Fragment, useState } from "react";
import {
  useAuditLogs,
  useCreateEntity,
  useCreateOrgUser,
  useEntities,
  useOrgUsers,
  useSupprimerEntite,
} from "../api/hooks";
import { ApiError } from "../api/client";
import type { Role } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { EntetePage } from "../components/etats";
import { MarqueDocuments } from "../components/MarqueDocuments";
import { BoutonDemonstration } from "../components/BoutonDemonstration";

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

  const { data: entities } = useEntities();
  const createEntity = useCreateEntity();
  // La piste d'audit n'est lisible que par les rôles qui répondent de la
  // conformité ; inutile de déclencher une requête refusée pour les autres.
  const peutVoirAudit = user?.role === "ADMIN" || user?.role === "DAF";
  const { data: auditLogs } = useAuditLogs(25, peutVoirAudit);
  const [entityForm, setEntityForm] = useState({
    name: "",
    country: "",
    currency: "EUR",
    fxRateToOrgCurrency: 1,
    nafCode: "",
    headcount: "",
  });
  const [entityError, setEntityError] = useState<string | null>(null);

  /*
   * Suppression d'un dossier : réservée à l'administrateur, et confirmée en
   * recopiant le nom — l'API le vérifie de son côté. Un seul dossier à la
   * fois en cours de confirmation, sous sa propre ligne, pour qu'on voie
   * lequel on s'apprête à effacer.
   */
  const peutSupprimer = user?.role === "ADMIN";
  const supprimerEntite = useSupprimerEntite();
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [supprime, setSupprime] = useState<string | null>(null);

  function demanderSuppression(id: string) {
    setASupprimer(id);
    setConfirmation("");
    setSupprime(null);
    supprimerEntite.reset();
  }

  function confirmerSuppression(id: string, nom: string) {
    supprimerEntite.mutate(
      { id, nom: confirmation },
      {
        onSuccess: () => {
          setASupprimer(null);
          setSupprime(nom);
        },
      },
    );
  }

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

  async function handleCreateEntity(e: React.FormEvent) {
    e.preventDefault();
    setEntityError(null);
    try {
      await createEntity.mutateAsync({
        name: entityForm.name,
        country: entityForm.country || undefined,
        currency: entityForm.currency,
        fxRateToOrgCurrency: entityForm.fxRateToOrgCurrency,
        nafCode: entityForm.nafCode || undefined,
        headcount: entityForm.headcount ? Number(entityForm.headcount) : undefined,
      });
      setEntityForm({ name: "", country: "", currency: "EUR", fxRateToOrgCurrency: 1, nafCode: "", headcount: "" });
    } catch (err) {
      setEntityError(err instanceof ApiError ? err.message : "Création impossible.");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <EntetePage titre="Paramètres" sousTitre={`Organisation : ${user?.organizationName ?? ""}`} />

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Dossiers</h2>
            <p className="text-sm text-ink-3 mt-0.5 max-w-prose">
              Les entreprises suivies par l&apos;organisation. Le dossier de démonstration est une entreprise
              fictive complète, pour essayer l&apos;outil ; il ne compte pas dans votre formule.
            </p>
          </div>
          <BoutonDemonstration />
        </div>
        {supprime && (
          <p role="status" className="text-sm text-success mb-3">
            Dossier « {supprime} » supprimé.
          </p>
        )}
        <div className="overflow-x-auto">
        <table className="w-full text-sm mb-4 min-w-[560px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
              <th className="py-2">Nom</th>
              <th className="py-2">Pays</th>
              <th className="py-2">Devise</th>
              <th className="py-2">Taux vers devise groupe</th>
              <th className="py-2">Code NAF</th>
              <th className="py-2">Effectif</th>
              {peutSupprimer && (
                <th className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {entities?.map((entity) => (
              <Fragment key={entity.id}>
                <tr className="border-b border-rule/5 last:border-0">
                  <td className="py-2 font-medium">{entity.name}</td>
                  <td className="py-2 text-ink-3">{entity.country ?? "—"}</td>
                  <td className="py-2 text-ink-3">{entity.currency}</td>
                  <td className="py-2 font-mono text-ink-3">{entity.fxRateToOrgCurrency}</td>
                  <td className="py-2 font-mono text-ink-3">{entity.nafCode ?? "—"}</td>
                  <td className="py-2 font-mono text-ink-3">{entity.headcount ?? "—"}</td>
                  {peutSupprimer && (
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => demanderSuppression(entity.id)}
                        className="rounded-md px-2 py-1 text-sm font-medium text-critical hover:bg-critical-soft"
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
                {aSupprimer === entity.id && (
                  <tr>
                    <td colSpan={7} className="pb-4">
                      <div className="rounded-lg border border-critical/30 bg-critical-soft p-4 space-y-3">
                        <p className="text-sm">
                          <strong>Supprimer « {entity.name} » ?</strong> Ses périodes, écritures, ratios, budget,
                          prévisions de trésorerie et plan d&apos;action seront effacés définitivement.
                        </p>
                        <div>
                          <label htmlFor="confirmation-suppression" className="label">
                            Recopiez le nom du dossier pour confirmer
                          </label>
                          <input
                            id="confirmation-suppression"
                            className="input max-w-sm"
                            autoComplete="off"
                            autoFocus
                            value={confirmation}
                            placeholder={entity.name}
                            onChange={(e) => setConfirmation(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-primary bg-critical"
                            disabled={confirmation.trim() !== entity.name || supprimerEntite.isPending}
                            onClick={() => confirmerSuppression(entity.id, entity.name)}
                          >
                            {supprimerEntite.isPending ? "Suppression…" : "Supprimer définitivement"}
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => setASupprimer(null)}>
                            Annuler
                          </button>
                        </div>
                        {supprimerEntite.isError && (
                          <p role="alert" className="text-sm text-critical">
                            {supprimerEntite.error instanceof ApiError
                              ? supprimerEntite.error.message
                              : "La suppression a échoué."}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>

        {user?.role === "ADMIN" || user?.role === "DAF" ? (
          <form onSubmit={handleCreateEntity} className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Nom</label>
              <input
                className="input"
                value={entityForm.name}
                onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Pays</label>
              <input
                className="input"
                value={entityForm.country}
                onChange={(e) => setEntityForm({ ...entityForm, country: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Devise</label>
              <input
                className="input"
                value={entityForm.currency}
                onChange={(e) => setEntityForm({ ...entityForm, currency: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Taux vers devise groupe</label>
              <input
                type="number"
                step="any"
                className="input"
                value={entityForm.fxRateToOrgCurrency}
                onChange={(e) => setEntityForm({ ...entityForm, fxRateToOrgCurrency: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="label">Code NAF</label>
              <input
                className="input"
                placeholder="2599B"
                value={entityForm.nafCode}
                onChange={(e) => setEntityForm({ ...entityForm, nafCode: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Effectif</label>
              <input
                type="number"
                min={0}
                className="input"
                value={entityForm.headcount}
                onChange={(e) => setEntityForm({ ...entityForm, headcount: e.target.value })}
              />
            </div>
            <div className="col-span-4">
              <p className="text-xs text-ink-3 mb-2">
                Le code d&apos;activité et l&apos;effectif situent l&apos;entité dans une cohorte
                sectorielle comparable : ils conditionnent le futur positionnement de ses ratios face
                à son secteur.
              </p>
              {entityError && <p className="text-critical text-sm mb-2">{entityError}</p>}
              <button type="submit" className="btn-secondary" disabled={createEntity.isPending}>
                {createEntity.isPending ? "Création…" : "Ajouter un dossier"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <MarqueDocuments
        nomOrganisation={user?.organizationName ?? ""}
        estAdmin={user?.role === "ADMIN"}
      />

      <div className="card">
        <h2 className="font-display text-lg font-semibold mb-3">Utilisateurs</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
              <th className="py-2">Nom</th>
              <th className="py-2">E-mail</th>
              <th className="py-2">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-rule/5 last:border-0">
                <td className="py-2 font-medium">{u.name}</td>
                <td className="py-2 text-ink-3">{u.email}</td>
                <td className="py-2 text-ink-3">{ROLE_LABELS[u.role]}</td>
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

      {peutVoirAudit && (
        <div className="card">
          <h2 className="font-display text-lg font-semibold mb-1">Piste d&apos;audit</h2>
          <p className="text-sm text-ink-3 mb-3">
            Toute opération qui modifie des données est enregistrée, sans possibilité de modification ni de suppression.
          </p>
          {auditLogs?.items.length === 0 && <p className="text-sm text-ink-3">Aucune opération enregistrée.</p>}
          {auditLogs && auditLogs.items.length > 0 && (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Auteur</th>
                    <th className="py-2 pr-3">Opération</th>
                    <th className="py-2">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.items.map((entry) => (
                    <tr key={entry.id} className="border-b border-rule/5 last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap text-ink-3">
                        {new Date(entry.createdAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="py-2 pr-3">
                        {entry.userEmail}
                        {entry.userRole && <span className="text-ink-3 text-xs"> · {ROLE_LABELS[entry.userRole]}</span>}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{entry.action}</td>
                      <td className="py-2 font-mono text-xs text-ink-3">
                        {entry.targetId ?? "—"}
                        <span className={entry.statusCode >= 400 ? "text-critical" : "text-ink-3"}>
                          {" "}
                          ({entry.statusCode})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
