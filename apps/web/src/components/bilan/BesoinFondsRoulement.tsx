import type { BfrNormatif } from "../../api/types";
import { formatCurrency } from "../../lib/format";

/**
 * Le besoin en fonds de roulement : en euros un constat, en jours de chiffre
 * d'affaires une constante d'exploitation — donc projetable —, et ce que
 * coûterait la croissance à structure inchangée.
 */
export function BesoinFondsRoulement({
  bfr,
  currency,
}: {
  bfr: BfrNormatif;
  currency: string;
}) {
  return (
    <section id="bfr" className="card scroll-mt-28">
      <h2 className="font-display text-lg font-semibold mb-1">
        Besoin en fonds de roulement
      </h2>
      <p className="text-sm text-ink-3 mb-4">
        En euros, le besoin en fonds de roulement est un constat. En jours de
        chiffre d&apos;affaires, c&apos;est une constante d&apos;exploitation —
        donc projetable.
      </p>

      <div className="flex gap-8 flex-wrap mb-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-3 mb-1">
            BFR
          </div>
          <div className="font-mono text-2xl font-semibold">
            {formatCurrency(bfr.bfr, currency)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-3 mb-1">
            En jours de CA
          </div>
          <div className="font-mono text-2xl font-semibold">
            {bfr.bfrEnJours === null
              ? "n/d"
              : `${Math.round(bfr.bfrEnJours)} j`}
          </div>
        </div>
      </div>

      <table className="w-full text-sm mb-5">
        <tbody>
          {bfr.composantes.map((composante) => (
            <tr key={composante.id} className="border-b border-rule/5">
              <td className="py-2">{composante.label}</td>
              <td className="py-2 text-right font-mono">
                {formatCurrency(composante.montant, currency)}
              </td>
              <td className="py-2 text-right font-mono text-ink-3 w-24">
                {composante.jours === null
                  ? "—"
                  : `${Math.round(composante.jours)} j`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {bfr.besoinCroissance.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-1">
            Ce que coûterait la croissance
          </h3>
          <p className="text-xs text-ink-3 mb-3">
            À structure d&apos;exploitation inchangée, le besoin suit le chiffre
            d&apos;affaires. C&apos;est la trésorerie à immobiliser{" "}
            <em>avant</em> d&apos;encaisser le premier euro de marge
            supplémentaire — le calcul que ne font pas les entreprises qui
            meurent de croître.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {bfr.besoinCroissance.map((hypothese) => (
              <div
                key={hypothese.croissance}
                className="rounded-lg bg-ink/[0.03] px-3 py-2"
              >
                <div className="text-xs text-ink-3">
                  +
                  {(hypothese.croissance * 100).toLocaleString("fr-FR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{" "}
                  % de CA
                </div>
                <div className="font-mono font-semibold">
                  {formatCurrency(hypothese.besoin, currency)}
                </div>
                <div className="text-xs text-ink-3 font-mono">
                  soit {formatCurrency(hypothese.caSupplementaire, currency)} de
                  plus
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
