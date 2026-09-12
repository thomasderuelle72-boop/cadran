import { useState } from "react";
import {
  useActions,
  useCreateAction,
  useDeleteAction,
  useEntities,
  useSyntheseActions,
  useUpdateAction,
} from "../api/hooks";
import { ApiError } from "../api/client";
import { RATIO_CATALOG } from "../lib/ratioCatalog";
import { formatCurrency, formatDate } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import type { ActionPlan, ActionStatus } from "../api/types";

const LIBELLE_STATUT: Record<ActionStatus, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  FAITE: "Faite",
  ABANDONNEE: "Abandonnée",
};

const COULEUR_STATUT: Record<ActionStatus, string> = {
  A_FAIRE: "text-ink/60 bg-black/5",
  EN_COURS: "text-warning bg-warning/10",
  FAITE: "text-success bg-success/10",
  ABANDONNEE: "text-ink/40 bg-black/5",
};

const STATUTS: ActionStatus[] = ["A_FAIRE", "EN_COURS", "FAITE", "ABANDONNEE"];

const FORMULAIRE_VIDE = {
  constat: "",
  action: "",
  entityId: "",
  ratioId: "",
  valeurInitiale: "",
  valeurCible: "",
  impactEstime: "",
  responsable: "",
  echeance: "",
};

/**
 * Barre d'avancement d'une action vers sa cible. La progression peut sortir
 * de [0, 1] — au-delà la cible est battue, en dessous on s'est éloigné — et
 * ces deux cas se lisent à la couleur plutôt que d'être écrêtés en silence.
 */
function Avancement({ action }: { action: ActionPlan }) {
  const avancement = action.avancement;
  if (!avancement) return <span className="text-ink/30 text-xs">Pas d&apos;indicateur suivi</span>;

  const progression = avancement.progression;
  const largeur = progression === null ? 0 : Math.min(100, Math.max(0, progression * 100));
  const couleur =
    progression === null
      ? "bg-black/10"
      : avancement.cibleAtteinte
        ? "bg-success"
        : progression < 0
          ? "bg-critical"
          : "bg-primary";

  const formater = (valeur: number | null) =>
    valeur === null ? "—" : Math.abs(valeur) < 1 ? valeur.toFixed(3) : valeur.toFixed(1);

  return (
    <div className="min-w-[180px]">
      <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
        <span className="text-ink/50">{avancement.ratioLabel}</span>
        <span className="font-mono font-medium">
          {progression === null ? "—" : `${Math.round(progression * 100)} %`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${largeur}%` }} />
      </div>
      <div className="text-xs text-ink/40 font-mono mt-1">
        {formater(avancement.valeurInitiale)} → {formater(avancement.valeurActuelle)} (cible{" "}
        {formater(avancement.valeurCible)})
      </div>
      {avancement.periodeLue && (
        <div className="text-xs text-ink/30">lu sur {avancement.periodeLue}</div>
      )}
    </div>
  );
}

export function ActionsPage() {
  const { user } = useAuth();
  const { data: entities } = useEntities();
  const [filtre, setFiltre] = useState<ActionStatus | "">("");
  const { data: actions } = useActions(undefined, filtre || undefined);
  const { data: synthese } = useSyntheseActions();

  const createAction = useCreateAction();
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();

  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const peutEcrire = user?.role === "ADMIN" || user?.role === "DAF" || user?.role === "CONTROLEUR";
  const peutSupprimer = user?.role === "ADMIN" || user?.role === "DAF";

  const nombre = (valeur: string) => (valeur.trim() === "" ? undefined : Number(valeur));

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      await createAction.mutateAsync({
        constat: form.constat,
        action: form.action,
        entityId: form.entityId || undefined,
        ratioId: form.ratioId || undefined,
        valeurInitiale: nombre(form.valeurInitiale),
        valeurCible: nombre(form.valeurCible),
        impactEstime: nombre(form.impactEstime),
        responsable: form.responsable || undefined,
        echeance: form.echeance ? new Date(form.echeance).toISOString() : undefined,
      });
      setForm(FORMULAIRE_VIDE);
      setOuvert(false);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Plan d&apos;action</h1>
          <p className="text-sm text-ink/50">
            Une recommandation non tracée n&apos;est pas un conseil, c&apos;est une conversation.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="input w-44"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as ActionStatus | "")}
          >
            <option value="">Tous les statuts</option>
            {STATUTS.map((statut) => (
              <option key={statut} value={statut}>
                {LIBELLE_STATUT[statut]}
              </option>
            ))}
          </select>
          {peutEcrire && (
            <button type="button" className="btn-primary" onClick={() => setOuvert(!ouvert)}>
              {ouvert ? "Annuler" : "Nouvelle action"}
            </button>
          )}
        </div>
      </div>

      {synthese && synthese.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Actions ouvertes</div>
            <div className="font-mono text-2xl font-semibold">
              {synthese.parStatut.A_FAIRE + synthese.parStatut.EN_COURS}
            </div>
            <div className="text-xs text-ink/40 mt-1">sur {synthese.total} au total</div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Échéance dépassée</div>
            <div
              className={`font-mono text-2xl font-semibold ${synthese.enRetard > 0 ? "text-critical" : ""}`}
            >
              {synthese.enRetard}
            </div>
            <div className="text-xs text-ink/40 mt-1">à reprendre au prochain point</div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Impact à réaliser</div>
            <div className="font-mono text-2xl font-semibold">
              {formatCurrency(synthese.impactOuvert)}
            </div>
            <div className="text-xs text-ink/40 mt-1">si le plan est mené à terme</div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Impact réalisé</div>
            <div className="font-mono text-2xl font-semibold text-success">
              {formatCurrency(synthese.impactRealise)}
            </div>
            <div className="text-xs text-ink/40 mt-1">sur les actions faites</div>
          </div>
        </div>
      )}

      {ouvert && (
        <form onSubmit={soumettre} className="card space-y-4">
          <h2 className="font-display text-lg font-semibold">Nouvelle action</h2>

          <div>
            <label className="label" htmlFor="constat">
              Constat — ce qu&apos;on a observé
            </label>
            <input
              id="constat"
              className="input"
              placeholder="Le DSO est à 83 jours, contre 45 dans le secteur"
              value={form.constat}
              onChange={(e) => setForm({ ...form, constat: e.target.value })}
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="label" htmlFor="action">
              Action — ce qu&apos;on fait
            </label>
            <input
              id="action"
              className="input"
              placeholder="Relancer à J+30 et passer les trois plus gros clients en prélèvement"
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              required
              minLength={3}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="entite">
                Entité
              </label>
              <select
                id="entite"
                className="input"
                value={form.entityId}
                onChange={(e) => setForm({ ...form, entityId: e.target.value })}
              >
                <option value="">— Aucune —</option>
                {entities?.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="indicateur">
                Indicateur suivi
              </label>
              <select
                id="indicateur"
                className="input"
                value={form.ratioId}
                onChange={(e) => setForm({ ...form, ratioId: e.target.value })}
              >
                <option value="">— Aucun —</option>
                {RATIO_CATALOG.map((ratio) => (
                  <option key={ratio.id} value={ratio.id}>
                    {ratio.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="impact">
                Impact estimé
              </label>
              <input
                id="impact"
                type="number"
                step="any"
                className="input"
                placeholder="84000"
                value={form.impactEstime}
                onChange={(e) => setForm({ ...form, impactEstime: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="initiale">
                Valeur initiale
              </label>
              <input
                id="initiale"
                type="number"
                step="any"
                className="input"
                placeholder="83"
                value={form.valeurInitiale}
                onChange={(e) => setForm({ ...form, valeurInitiale: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="cible">
                Valeur cible
              </label>
              <input
                id="cible"
                type="number"
                step="any"
                className="input"
                placeholder="65"
                value={form.valeurCible}
                onChange={(e) => setForm({ ...form, valeurCible: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="echeance">
                Échéance
              </label>
              <input
                id="echeance"
                type="date"
                className="input"
                value={form.echeance}
                onChange={(e) => setForm({ ...form, echeance: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="responsable">
                Responsable
              </label>
              <input
                id="responsable"
                className="input"
                value={form.responsable}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-ink/40">
            L&apos;indicateur suivi est relu automatiquement sur la dernière période de
            l&apos;entité : c&apos;est ce qui permet de dire au point suivant si la cible a été
            atteinte. Il demande donc de préciser une entité.
          </p>

          {erreur && <p className="text-critical text-sm">{erreur}</p>}

          <button type="submit" className="btn-primary" disabled={createAction.isPending}>
            {createAction.isPending ? "Enregistrement…" : "Enregistrer l'action"}
          </button>
        </form>
      )}

      {actions && actions.length === 0 && (
        <div className="card text-sm text-ink/50">
          Aucune action enregistrée. Une recommandation devient mesurable quand on écrit le constat,
          l&apos;action, son impact chiffré et son échéance — et que l&apos;outil relit
          l&apos;indicateur au point suivant.
        </div>
      )}

      {actions && actions.length > 0 && (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`card ${action.enRetard ? "border-critical/30 bg-critical/[0.03]" : ""}`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className={`text-xs font-mono uppercase tracking-wide px-2 py-0.5 rounded ${COULEUR_STATUT[action.statut]}`}
                    >
                      {LIBELLE_STATUT[action.statut]}
                    </span>
                    {action.entityName && (
                      <span className="text-xs text-ink/40">{action.entityName}</span>
                    )}
                    {action.enRetard && (
                      <span className="text-xs text-critical font-medium">
                        échéance dépassée
                      </span>
                    )}
                    {action.avancement?.cibleAtteinte && (
                      <span className="text-xs text-success font-medium">cible atteinte</span>
                    )}
                  </div>

                  <p className="text-sm text-ink/60 mb-1">
                    <span className="text-ink/40">Constat — </span>
                    {action.constat}
                  </p>
                  <p className="text-sm font-medium mb-2">{action.action}</p>

                  <div className="flex gap-5 flex-wrap text-xs text-ink/50">
                    {action.impactEstime !== null && (
                      <span>
                        Impact estimé{" "}
                        <span className="font-mono font-medium text-ink/70">
                          {formatCurrency(action.impactEstime)}
                        </span>
                      </span>
                    )}
                    {action.echeance && (
                      <span>
                        Échéance{" "}
                        <span className={action.enRetard ? "text-critical font-medium" : ""}>
                          {formatDate(action.echeance)}
                        </span>
                      </span>
                    )}
                    {action.responsable && <span>Responsable {action.responsable}</span>}
                    <span className="text-ink/30">posée par {action.auteurEmail}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <Avancement action={action} />
                  {peutEcrire && (
                    <div className="flex gap-2 items-center">
                      <select
                        className="input w-36 text-xs py-1"
                        value={action.statut}
                        aria-label={`Statut de : ${action.action}`}
                        onChange={(e) =>
                          updateAction.mutate({
                            id: action.id,
                            statut: e.target.value as ActionStatus,
                          })
                        }
                      >
                        {STATUTS.map((statut) => (
                          <option key={statut} value={statut}>
                            {LIBELLE_STATUT[statut]}
                          </option>
                        ))}
                      </select>
                      {peutSupprimer && (
                        <button
                          type="button"
                          className="text-xs text-ink/40 hover:text-critical"
                          onClick={() => deleteAction.mutate(action.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
