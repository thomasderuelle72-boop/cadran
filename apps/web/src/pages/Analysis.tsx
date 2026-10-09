import { useEffect, useState } from "react";
import { useEntities, usePeriods, useRatios, useSig } from "../api/hooks";
import { Cascade } from "../components/tableau/Cascade";
import { etapesCascade } from "../lib/tableauDeBord";
import { DetailComptes } from "../components/DetailComptes";
import { EntetePage, EtatVide, SqueletteTableau, Zone } from "../components/etats";
import { formatCurrency } from "../lib/format";
import type { SoldeIntermediaire } from "../api/types";
import { useDossierCourant } from "../lib/dossierCourant";

function formatPart(part: number | null): string {
  return part === null ? "—" : `${(part * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/**
 * Un solde majeur porte la lecture ; les autres sont les étapes qui mènent de
 * l'un à l'autre. La hiérarchie typographique suit cette distinction plutôt
 * que d'aligner quatorze lignes identiques.
 */
function LigneSolde({
  solde,
  currency,
  precedent,
}: {
  solde: SoldeIntermediaire;
  currency: string;
  precedent?: SoldeIntermediaire;
}) {
  const variation =
    precedent && precedent.valeur !== 0 ? (solde.valeur - precedent.valeur) / Math.abs(precedent.valeur) : null;

  return (
    <tr className={solde.majeur ? "border-b border-rule/10" : "border-b border-rule/5"}>
      <td className={`py-2 ${solde.majeur ? "font-semibold" : "pl-4 text-ink-3"}`}>
        {solde.label}
        <span className="block text-xs font-normal text-ink-3">{solde.formule}</span>
      </td>
      <td className={`py-2 text-right font-mono ${solde.majeur ? "font-semibold" : "text-ink-2"}`}>
        {formatCurrency(solde.valeur, currency)}
      </td>
      <td className="py-2 text-right font-mono text-ink-3 text-sm">{formatPart(solde.partDuCa)}</td>
      <td className="py-2 text-right font-mono text-sm">
        {variation === null ? (
          <span className="text-ink-3">—</span>
        ) : (
          <span className={variation >= 0 ? "text-success" : "text-critical"}>
            {variation >= 0 ? "+" : ""}
            {(variation * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
          </span>
        )}
      </td>
    </tr>
  );
}

export function AnalysisPage() {
  const { data: entities } = useEntities();
  const [entityId] = useDossierCourant(entities);
  const [periodId, setPeriodId] = useState<string | null>(null);


  const { data: periods } = usePeriods(entityId || undefined);

  // À l'arrivée sur la page, on se place sur la période la plus récente : la
  // question qu'on se pose devant un tableau de bord porte presque toujours
  // sur la dernière clôture.
  useEffect(() => {
    if (!periods || periods.length === 0) {
      setPeriodId(null);
      return;
    }
    if (!periods.some((p) => p.id === periodId)) {
      setPeriodId(periods[periods.length - 1].id);
    }
  }, [periods, periodId]);

  const {
    data: sigData,
    isLoading: sigChargement,
    error: sigErreur,
    refetch: recharger,
  } = useSig(periodId);
  // Les agrégats de la période, déjà en cache si l'on vient du tableau de
  // bord : ils nourrissent la cascade d'en-tête.
  const { data: ratios } = useRatios(periodId);

  const currency = sigData?.currency ?? "EUR";

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Activité et résultat"
        sousTitre="Du chiffre d'affaires au résultat net : où la richesse se crée, et entre qui elle se partage."
      >
        <select
          className="input w-48"
          value={periodId ?? ""}
          aria-label="Période"
          onChange={(e) => setPeriodId(e.target.value || null)}
        >
          {periods?.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
      </EntetePage>

      {!periodId && (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Cette entité n&apos;a aucune période. Importez un FEC ou une balance pour la remplir.
        </EtatVide>
      )}

      {periodId && ratios && (
        <section className="card apparition">
          <h2 className="text-lg font-bold">En un coup d&apos;œil</h2>
          <p className="text-sm text-ink-3 mt-0.5 mb-4 max-w-prose">
            Du chiffre d&apos;affaires au résultat net : les totaux en vert, ce qui s&apos;en retranche en gris. Le
            détail ligne à ligne suit, dans le tableau des soldes.
          </p>
          <Cascade etapes={etapesCascade(ratios.aggregates, ratios.derived)} currency={ratios.currency} />
        </section>
      )}

      {periodId && (
        <Zone
          chargement={sigChargement}
          erreur={sigErreur}
          onReessayer={() => void recharger()}
          quoi="les soldes de gestion"
          squelette={<SqueletteTableau lignes={10} colonnes={4} />}
        >
      {sigData && (
        <div className="card">
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h2 className="font-display text-lg font-semibold">Soldes intermédiaires de gestion</h2>
            <span className="text-xs text-ink-3">{sigData.periodLabel}</span>
          </div>
          <p className="text-sm text-ink-3 mb-4">
            La cascade du plan comptable : où la richesse se crée, et entre qui elle se partage.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
                  <th className="py-2">Solde</th>
                  <th className="py-2 text-right">Montant</th>
                  <th className="py-2 text-right">% du CA</th>
                  <th className="py-2 text-right">
                    vs {sigData.precedent?.periodLabel ?? "n-1"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sigData.sig.soldes.map((solde) => (
                  <LigneSolde
                    key={solde.id}
                    solde={solde}
                    currency={currency}
                    precedent={sigData.precedent?.sig.soldes.find((s) => s.id === solde.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {sigData.sig.partageValeurAjoutee && (
            <div className="mt-5 pt-4 border-t border-rule/10">
              <h3 className="text-sm font-semibold mb-1">Partage de la valeur ajoutée</h3>
              <p className="text-xs text-ink-3 mb-3">
                Ce que la richesse créée sur la période revient à chacun.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sigData.sig.partageValeurAjoutee.map((part) => (
                  <div key={part.id} className="rounded-lg bg-ink/[0.03] px-3 py-2">
                    <div className="text-xs text-ink-3">{part.label}</div>
                    <div className="font-mono font-semibold">{formatPart(part.part)}</div>
                    <div className="text-xs text-ink-3 font-mono">
                      {formatCurrency(part.montant, currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

        </Zone>
      )}

      {periodId && entityId && (
        <DetailComptes periodId={periodId} entityId={entityId} currency={currency} />
      )}
    </div>
  );
}
