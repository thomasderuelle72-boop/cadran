import type { RatioValue } from "../api/types";
import { formatRatioValue } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

export function RatioTable({
  ratios,
  title,
  currency = "EUR",
}: {
  ratios: RatioValue[];
  title: string;
  currency?: string;
}) {
  return (
    <div className="card">
      <h3 className="font-display text-lg font-semibold mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
              <th className="py-2 pr-3">Ratio</th>
              <th className="py-2 pr-3 font-mono normal-case">Formule</th>
              <th className="py-2 pr-3">Valeur</th>
              <th className="py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {ratios.map((ratio) => (
              <tr key={ratio.id} className="border-b border-black/5 last:border-0">
                <td className="py-2 pr-3 font-medium">{ratio.label}</td>
                <td className="py-2 pr-3 font-mono text-xs text-ink/50 whitespace-nowrap">{ratio.formula}</td>
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
