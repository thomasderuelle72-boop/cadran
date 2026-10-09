import { useFlux } from "../../api/hooks";
import type { LigneFlux } from "../../api/types";
import { SqueletteCarte } from "../etats";
import { formatCurrency } from "../../lib/format";

function LigneDeFlux({
  ligne,
  currency,
}: {
  ligne: LigneFlux;
  currency: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-rule/5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm">{ligne.label}</div>
        <div className="text-xs text-ink-3">{ligne.explication}</div>
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

/**
 * « Je suis rentable, pourquoi je n'ai pas de trésorerie ? » : les trois flux
 * — exploitation, investissement, financement — entre deux bilans successifs,
 * réconciliés avec la variation des disponibilités.
 */
export function TableauFlux({
  periodId,
  currency,
}: {
  periodId: string;
  currency: string;
}) {
  const {
    data: fluxData,
    isLoading: fluxChargement,
    error: fluxError,
  } = useFlux(periodId);
  const flux = fluxData?.flux;
  return (
    <section id="flux" className="card scroll-mt-28">
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h2 className="font-display text-lg font-semibold">
          Tableau de flux de trésorerie
        </h2>
        {fluxData && (
          <span className="text-xs text-ink-3">
            {fluxData.ouverturePeriodLabel} → {fluxData.periodLabel}
          </span>
        )}
      </div>
      <p className="text-sm text-ink-3 mb-4">
        « Je suis rentable, pourquoi je n&apos;ai pas de trésorerie ? » — la
        réponse tient dans ces trois flux.
      </p>

      {fluxChargement && !fluxError && <SqueletteCarte hauteur="8rem" />}

      {fluxError && (
        <p className="text-sm text-ink-3">
          Le tableau de flux compare deux bilans successifs : il faut une
          période antérieure à celle-ci.
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
                  <LigneDeFlux
                    key={ligne.id}
                    ligne={ligne}
                    currency={currency}
                  />
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
          <div className="flex items-baseline justify-between gap-4 text-sm text-ink-3 mt-1">
            <span>
              Disponibilités{" "}
              {formatCurrency(flux.tresorerieOuverture, currency)} →{" "}
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
              La somme des trois flux devrait égaler exactement la variation des
              disponibilités. L&apos;écart signale qu&apos;un des deux bilans ne
              s&apos;équilibre pas : reprenez la classification de l&apos;import
              avant d&apos;exploiter ce tableau.
            </p>
          )}
        </>
      )}
    </section>
  );
}
