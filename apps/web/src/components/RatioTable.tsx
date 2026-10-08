import type { RatioCategory, RatioValue } from "../api/types";
import { FAMILLES } from "./tableau/FamilleIndicateurs";
import { formatRatioValue } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

export function RatioTable({
  ratios,
  categorie,
  currency = "EUR",
}: {
  ratios: RatioValue[];
  categorie: RatioCategory;
  currency?: string;
}) {
  // Même en-tête que sur le tableau de bord : l'icône, et la question à
  // laquelle la famille répond.
  const famille = FAMILLES[categorie];
  return (
    <div className="card apparition">
      <header className="flex items-start gap-3 mb-3">
        <span className="grid place-items-center h-9 w-9 flex-none rounded-lg bg-primary-soft text-primary" aria-hidden="true">
          <famille.Icone size={18} />
        </span>
        <div>
          <h3 className="text-lg font-bold">{famille.titre}</h3>
          <p className="text-sm text-ink-3">{famille.question}</p>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
              <th className="py-2 pr-3">Ratio</th>
              <th className="py-2 pr-3">Formule</th>
              <th className="py-2 pr-3">Valeur</th>
              <th className="py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {ratios.map((ratio) => (
              <tr key={ratio.id} className="border-b border-rule/5 last:border-0">
                <td className="py-2 pr-3 font-medium">{ratio.label}</td>
                <td className="py-2 pr-3 font-mono text-xs text-ink-3 whitespace-nowrap">{ratio.formula}</td>
                <td className="py-2 pr-3 font-mono font-semibold">{formatRatioValue(ratio.value, ratio.unit, currency)}</td>
                <td className="py-2">
                  <StatusBadge status={ratio.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
