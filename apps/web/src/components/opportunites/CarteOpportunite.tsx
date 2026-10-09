import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Lightbulb, ListPlus, OctagonAlert, type LucideIcon } from "lucide-react";
import { useCreateAction } from "../../api/hooks";
import { ApiError } from "../../api/client";
import type { NatureEnjeu, Opportunite, PrioriteOpportunite } from "../../api/types";
import { formatCurrency } from "../../lib/format";

export const PRIORITES: Record<PrioriteOpportunite, { libelle: string; Icone: LucideIcon; classe: string }> = {
  urgente: { libelle: "Urgent", Icone: OctagonAlert, classe: "bg-critical-soft text-critical" },
  haute: { libelle: "Prioritaire", Icone: AlertTriangle, classe: "bg-warning-soft text-warning" },
  normale: { libelle: "À proposer", Icone: Lightbulb, classe: "bg-primary-soft text-primary" },
};

/** Ce que représente le montant affiché, dit en mots : un montant seul ne dit pas s'il se gagne ou se finance. */
export const ENJEUX: Record<NatureEnjeu, string> = {
  tresorerie: "de trésorerie à libérer",
  resultat: "de résultat en jeu, par an",
  financement: "à financer",
  obligation: "de capitaux propres à reconstituer",
};

/**
 * Une mission à proposer : ce qu'on voit, ce qui est en jeu, ce qu'on
 * propose, et de quoi argumenter.
 *
 * L'enjeu est l'ordre de grandeur qui ouvre la conversation — calculé à
 * activité constante sur le dernier exercice complet — et la carte le
 * présente ainsi. Un clic l'inscrit au plan d'action du dossier, avec
 * l'indicateur à suivre, sa valeur actuelle et la cible : la mission devient
 * un engagement mesurable.
 */
export function CarteOpportunite({
  opportunite,
  entityId,
  devise,
  dossier,
}: {
  opportunite: Opportunite;
  entityId: string;
  devise: string;
  /** Nom du dossier, affiché quand la carte sort de son tableau de bord. */
  dossier?: string;
}) {
  const priorite = PRIORITES[opportunite.priorite];
  const creer = useCreateAction();
  const queryClient = useQueryClient();
  const ajoutee = opportunite.dansLePlan || creer.isSuccess;

  function ajouter() {
    creer.mutate(
      {
        entityId,
        constat: opportunite.constat,
        action: opportunite.action,
        ratioId: opportunite.suivi?.ratioId,
        valeurInitiale: opportunite.suivi?.valeurInitiale,
        valeurCible: opportunite.suivi?.valeurCible,
        impactEstime: Math.round(opportunite.enjeu),
      },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["opportunites"] }) },
    );
  }

  return (
    <article className="card survol-leve flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorite.classe}`}>
          <priorite.Icone size={13} aria-hidden="true" />
          {priorite.libelle}
        </span>
        {dossier && <span className="text-xs font-medium text-ink-3 truncate">{dossier}</span>}
      </div>

      <div>
        <h3 className="text-base font-bold leading-snug">{opportunite.mission}</h3>
        <p className="text-sm text-ink-2 mt-1">{opportunite.constat}</p>
      </div>

      <div className="rounded-xl bg-surface-2 px-3.5 py-3">
        <div className="text-2xl font-bold tracking-tight">≈ {formatCurrency(Math.round(opportunite.enjeu), devise)}</div>
        <div className="text-xs font-medium text-ink-3">{ENJEUX[opportunite.natureEnjeu]}</div>
      </div>

      <p className="text-sm">
        <span className="font-semibold">À proposer : </span>
        {opportunite.action}
      </p>

      {opportunite.arguments.length > 0 && (
        <details className="text-sm group">
          <summary className="cursor-pointer font-medium text-primary hover:underline">Arguments pour le rendez-vous</summary>
          <ul className="mt-2 space-y-1.5 text-ink-2 list-disc pl-5">
            {opportunite.arguments.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-auto pt-1">
        {ajoutee ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <Check size={16} aria-hidden="true" />
            Au plan d&apos;action
          </span>
        ) : (
          <button type="button" className="btn-secondary py-1.5" onClick={ajouter} disabled={creer.isPending}>
            <ListPlus size={16} aria-hidden="true" />
            {creer.isPending ? "Ajout…" : "Ajouter au plan d'action"}
          </button>
        )}
        {creer.isError && (
          <p role="alert" className="text-xs text-critical mt-1">
            {creer.error instanceof ApiError ? creer.error.message : "L'ajout a échoué."}
          </p>
        )}
      </div>
    </article>
  );
}
