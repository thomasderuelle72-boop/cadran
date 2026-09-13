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
import { EntetePage, EtatVide, SqueletteTableau, SqueletteTuiles, Zone } from "../components/etats";
import {
  FormulaireAction,
  VALEURS_VIDES,
  valeursDe,
  type ValeursAction,
} from "../components/FormulaireAction";
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
  A_FAIRE: "text-ink/60 bg-ink/5",
  EN_COURS: "text-warning bg-warning/10",
  FAITE: "text-success bg-success/10",
  ABANDONNEE: "text-ink/40 bg-ink/5",
};

const STATUTS: ActionStatus[] = ["A_FAIRE", "EN_COURS", "FAITE", "ABANDONNEE"];

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
      ? "bg-ink/10"
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
      <div className="h-1.5 rounded-full bg-ink/5 overflow-hidden">
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
  const { data: actions, isLoading, error, refetch } = useActions(undefined, filtre || undefined);
  const { data: synthese } = useSyntheseActions();

  const createAction = useCreateAction();
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();

  const [ouvert, setOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<ActionPlan | null>(null);
  // Une suppression est définitive et emporte l'historique de l'action : on
  // demande confirmation sur la ligne elle-même, sans boîte de dialogue qui
  // masquerait ce qu'on est en train de supprimer.
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const peutEcrire = user?.role === "ADMIN" || user?.role === "DAF" || user?.role === "CONTROLEUR";
  const peutSupprimer = user?.role === "ADMIN" || user?.role === "DAF";

  /** À la création, un champ vide est simplement omis. */
  const nombre = (valeur: string) => (valeur.trim() === "" ? undefined : Number(valeur));
  /** À la modification, un champ vidé doit être effacé : c'est `null`. */
  const nombreOuVide = (valeur: string) => (valeur.trim() === "" ? null : Number(valeur));

  async function creer(valeurs: ValeursAction) {
    setErreur(null);
    try {
      await createAction.mutateAsync({
        constat: valeurs.constat,
        action: valeurs.action,
        entityId: valeurs.entityId || undefined,
        ratioId: valeurs.ratioId || undefined,
        valeurInitiale: nombre(valeurs.valeurInitiale),
        valeurCible: nombre(valeurs.valeurCible),
        impactEstime: nombre(valeurs.impactEstime),
        responsable: valeurs.responsable || undefined,
        echeance: valeurs.echeance ? new Date(valeurs.echeance).toISOString() : undefined,
      });
      setOuvert(false);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    }
  }

  async function enregistrer(valeurs: ValeursAction) {
    if (!enEdition) return;
    setErreur(null);
    try {
      await updateAction.mutateAsync({
        id: enEdition.id,
        constat: valeurs.constat,
        action: valeurs.action,
        ratioId: valeurs.ratioId || null,
        valeurInitiale: nombreOuVide(valeurs.valeurInitiale),
        valeurCible: nombreOuVide(valeurs.valeurCible),
        impactEstime: nombreOuVide(valeurs.impactEstime),
        responsable: valeurs.responsable || null,
        echeance: valeurs.echeance ? new Date(valeurs.echeance).toISOString() : null,
      });
      setEnEdition(null);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Modification impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Plan d'action"
        sousTitre="Une recommandation non tracée n'est pas un conseil, c'est une conversation."
      >
        <select
          className="input w-44"
          value={filtre}
          aria-label="Filtrer par statut"
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setOuvert(!ouvert);
              setEnEdition(null);
              setErreur(null);
            }}
          >
            {ouvert ? "Annuler" : "Nouvelle action"}
          </button>
        )}
      </EntetePage>

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
        <FormulaireAction
          titre="Nouvelle action"
          libelleBouton="Enregistrer l'action"
          valeursInitiales={VALEURS_VIDES}
          entities={entities}
          enCours={createAction.isPending}
          erreur={erreur}
          onValider={(valeurs) => void creer(valeurs)}
          onAnnuler={() => {
            setOuvert(false);
            setErreur(null);
          }}
        />
      )}

      {enEdition && (
        <FormulaireAction
          /* La clé remonte le formulaire quand on passe d'une action à une
             autre : sans elle, React garderait l'état de la précédente. */
          key={enEdition.id}
          titre="Modifier l'action"
          libelleBouton="Enregistrer les modifications"
          valeursInitiales={valeursDe(enEdition)}
          entities={entities}
          enCours={updateAction.isPending}
          erreur={erreur}
          modeEdition
          nomEntite={enEdition.entityName}
          onValider={(valeurs) => void enregistrer(valeurs)}
          onAnnuler={() => {
            setEnEdition(null);
            setErreur(null);
          }}
        />
      )}

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="le plan d'action"
        squelette={
          <div className="space-y-6">
            <SqueletteTuiles />
            <SqueletteTableau lignes={4} colonnes={3} />
          </div>
        }
      >
      {actions && actions.length === 0 && (
        <EtatVide titre="Aucune action enregistrée">
          Une recommandation devient mesurable quand on écrit le constat, l&apos;action, son impact
          chiffré et son échéance — et que l&apos;outil relit l&apos;indicateur au point suivant.
          {filtre && " Aucune action ne porte ce statut : essayez « Tous les statuts »."}
        </EtatVide>
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
                      <button
                        type="button"
                        className="text-xs text-ink/40 hover:text-primary"
                        onClick={() => {
                          setEnEdition(action);
                          setOuvert(false);
                          setErreur(null);
                          setASupprimer(null);
                        }}
                      >
                        Modifier
                      </button>
                      {peutSupprimer &&
                        (aSupprimer === action.id ? (
                          <span className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              className="text-critical font-medium"
                              onClick={() => {
                                deleteAction.mutate(action.id);
                                setASupprimer(null);
                              }}
                            >
                              Confirmer
                            </button>
                            <button
                              type="button"
                              className="text-ink/40"
                              onClick={() => setASupprimer(null)}
                            >
                              Non
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-ink/40 hover:text-critical"
                            onClick={() => setASupprimer(action.id)}
                          >
                            Supprimer
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </Zone>
    </div>
  );
}
