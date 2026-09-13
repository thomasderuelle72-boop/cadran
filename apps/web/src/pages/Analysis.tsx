import { useEffect, useState } from "react";
import { useEntities, useFlux, usePeriods, useSig } from "../api/hooks";
import { DetailComptes } from "../components/DetailComptes";
import { EntitySelector } from "../components/EntitySelector";
import { EntetePage, EtatVide, SqueletteCarte, SqueletteTableau, Zone } from "../components/etats";
import { formatCurrency } from "../lib/format";
import type { LigneFlux, SoldeIntermediaire } from "../api/types";

function formatPart(part: number | null): string {
  return part === null ? "—" : `${(part * 100).toFixed(1)} %`;
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
      <td className={`py-2 ${solde.majeur ? "font-semibold" : "pl-4 text-ink/60"}`}>
        {solde.label}
        <span className="block text-xs font-normal text-ink/40">{solde.formule}</span>
      </td>
      <td className={`py-2 text-right font-mono ${solde.majeur ? "font-semibold" : "text-ink/70"}`}>
        {formatCurrency(solde.valeur, currency)}
      </td>
      <td className="py-2 text-right font-mono text-ink/50 text-sm">{formatPart(solde.partDuCa)}</td>
      <td className="py-2 text-right font-mono text-sm">
        {variation === null ? (
          <span className="text-ink/30">—</span>
        ) : (
          <span className={variation >= 0 ? "text-success" : "text-critical"}>
            {variation >= 0 ? "+" : ""}
            {(variation * 100).toFixed(1)} %
          </span>
        )}
      </td>
    </tr>
  );
}

function LigneDeFlux({ ligne, currency }: { ligne: LigneFlux; currency: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-rule/5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm">{ligne.label}</div>
        <div className="text-xs text-ink/40">{ligne.explication}</div>
      </div>
      <div
        className={`font-mono text-sm flex-none ${ligne.montant >= 0 ? "text-success" : "text-critical"}`}
      >
        {ligne.montant >= 0 ? "+" : ""}
        {formatCurrency(ligne.montant, currency)}
      </div>
    </div>
  );
}

export function AnalysisPage() {
  const { data: entities } = useEntities();
  const [entityId, setEntityId] = useState("");
  const [periodId, setPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId && entities && entities.length > 0) setEntityId(entities[0].id);
  }, [entities, entityId]);

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
  const { data: fluxData, isLoading: fluxChargement, error: fluxError } = useFlux(periodId);

  const currency = sigData?.currency ?? "EUR";
  const flux = fluxData?.flux;

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Analyse"
        sousTitre="Soldes intermédiaires de gestion et tableau de flux de trésorerie."
      >
        <EntitySelector value={entityId} onChange={setEntityId} />
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
            <span className="text-xs text-ink/40">{sigData.periodLabel}</span>
          </div>
          <p className="text-sm text-ink/50 mb-4">
            La cascade du plan comptable : où la richesse se crée, et entre qui elle se partage.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-rule/10">
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
              <p className="text-xs text-ink/40 mb-3">
                Ce que la richesse créée sur la période revient à chacun.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sigData.sig.partageValeurAjoutee.map((part) => (
                  <div key={part.id} className="rounded-lg bg-ink/[0.03] px-3 py-2">
                    <div className="text-xs text-ink/50">{part.label}</div>
                    <div className="font-mono font-semibold">{formatPart(part.part)}</div>
                    <div className="text-xs text-ink/40 font-mono">
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

      {periodId && (
      <div className="card">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h2 className="font-display text-lg font-semibold">Tableau de flux de trésorerie</h2>
          {fluxData && (
            <span className="text-xs text-ink/40">
              {fluxData.ouverturePeriodLabel} → {fluxData.periodLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-ink/50 mb-4">
          « Je suis rentable, pourquoi je n&apos;ai pas de trésorerie ? » — la réponse tient dans ces
          trois flux.
        </p>

        {fluxChargement && !fluxError && <SqueletteCarte hauteur="8rem" />}

        {fluxError && (
          <p className="text-sm text-ink/50">
            Le tableau de flux compare deux bilans successifs : il faut une période antérieure à
            celle-ci.
          </p>
        )}

        {flux && (
          <>
            <div className="space-y-4">
              {flux.sections.map((section) => (
                <div key={section.id}>
                  <div className="flex items-baseline justify-between gap-4 mb-1">
                    <h3 className="text-sm font-semibold">{section.label}</h3>
                    <span
                      className={`font-mono text-sm font-semibold ${
                        section.total >= 0 ? "text-success" : "text-critical"
                      }`}
                    >
                      {section.total >= 0 ? "+" : ""}
                      {formatCurrency(section.total, currency)}
                    </span>
                  </div>
                  {section.lignes.map((ligne) => (
                    <LigneDeFlux key={ligne.id} ligne={ligne} currency={currency} />
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t-2 border-ink/20 flex items-baseline justify-between gap-4">
              <span className="font-semibold">Variation de trésorerie</span>
              <span
                className={`font-mono font-semibold ${
                  flux.variationTresorerie >= 0 ? "text-success" : "text-critical"
                }`}
              >
                {flux.variationTresorerie >= 0 ? "+" : ""}
                {formatCurrency(flux.variationTresorerie, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-sm text-ink/50 mt-1">
              <span>
                Disponibilités {formatCurrency(flux.tresorerieOuverture, currency)} →{" "}
                {formatCurrency(flux.tresorerieCloture, currency)}
              </span>
              {flux.ecartReconciliation === 0 ? (
                <span className="text-success text-xs">✓ réconcilié</span>
              ) : (
                <span className="text-critical text-xs">
                  écart de {formatCurrency(flux.ecartReconciliation, currency)}
                </span>
              )}
            </div>

            {flux.ecartReconciliation !== 0 && (
              <p className="mt-3 text-xs text-critical bg-critical/5 rounded-lg px-3 py-2">
                La somme des trois flux devrait égaler exactement la variation des disponibilités.
                L&apos;écart signale qu&apos;un des deux bilans ne s&apos;équilibre pas : reprenez la
                classification de l&apos;import avant d&apos;exploiter ce tableau.
              </p>
            )}
          </>
        )}
      </div>
      )}

      {periodId && entityId && (
        <DetailComptes periodId={periodId} entityId={entityId} currency={currency} />
      )}
    </div>
  );
}
