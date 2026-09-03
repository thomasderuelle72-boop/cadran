import { useEffect, useMemo, useState } from "react";
import { useBudgetVariance, useEntities, useImportReference, usePeriods, useSubmitBudget } from "../api/hooks";
import { EntitySelector } from "../components/EntitySelector";
import { formatCurrency } from "../lib/format";
import type { LinePoste } from "../api/types";
import { ApiError } from "../api/client";

// L'écart n'a un sens "bon/mauvais" que sur les postes de compte de résultat :
// dépasser le budget est défavorable pour une charge, favorable pour un
// produit. Sur les postes de bilan, un écart n'est ni bon ni mauvais en soi.
const CHARGE_POSTES = new Set<LinePoste>([
  "ACHATS_CONSOMMES",
  "CHARGES_EXTERNES",
  "CHARGES_PERSONNEL",
  "IMPOTS_TAXES",
  "DOTATIONS_AMORTISSEMENTS",
  "CHARGES_FINANCIERES",
  "IMPOT_SOCIETES",
]);
const PRODUIT_POSTES = new Set<LinePoste>(["CHIFFRE_AFFAIRES", "PRODUITS_FINANCIERS"]);

function ecartColor(poste: LinePoste, ecart: number): string {
  if (ecart === 0) return "text-ink/40";
  if (CHARGE_POSTES.has(poste)) return ecart > 0 ? "text-critical" : "text-success";
  if (PRODUIT_POSTES.has(poste)) return ecart > 0 ? "text-success" : "text-critical";
  return "text-ink/60";
}

export function BudgetPage() {
  const { data: entities } = useEntities();
  const [entityId, setEntityId] = useState("");

  useEffect(() => {
    if (!entityId && entities && entities.length > 0) setEntityId(entities[0].id);
  }, [entities, entityId]);

  const { data: periods } = usePeriods(entityId || undefined);
  const [periodId, setPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (periods && periods.length > 0) setPeriodId(periods[periods.length - 1].id);
    else setPeriodId(null);
  }, [periods]);

  const { data: reference } = useImportReference();
  const { data: variance, isLoading } = useBudgetVariance(periodId);
  const submitBudget = useSubmitBudget();

  const [draft, setDraft] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!variance) return;
    const next: Record<string, number> = {};
    variance.rows.forEach((row) => {
      next[row.poste] = row.budgeted;
    });
    setDraft(next);
    setSaved(false);
  }, [variance]);

  const actualByPoste = useMemo(() => {
    const map = new Map<LinePoste, number>();
    variance?.rows.forEach((row) => map.set(row.poste, row.actual));
    return map;
  }, [variance]);

  async function handleSave() {
    if (!periodId) return;
    setError(null);
    setSaved(false);
    const items = Object.entries(draft)
      .filter(([, amount]) => amount !== 0)
      .map(([poste, amountBudgeted]) => ({ poste: poste as LinePoste, amountBudgeted }));
    try {
      await submitBudget.mutateAsync({ periodId, items });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Budget vs réalisé</h1>
          <p className="text-sm text-ink/50">Saisissez le montant budgété par poste pour suivre les écarts.</p>
        </div>
        <div className="flex gap-2">
          <EntitySelector value={entityId} onChange={setEntityId} />
          {periods && periods.length > 0 && (
            <select className="input w-40" value={periodId ?? ""} onChange={(e) => setPeriodId(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {isLoading && <p className="text-ink/50">Chargement…</p>}
      {periods && periods.length === 0 && <p className="text-ink/50">Aucune période pour cette entité.</p>}

      {variance && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                ["chiffreAffaires", "Chiffre d'affaires"],
                ["ebitda", "EBITDA"],
                ["resultatNet", "Résultat net"],
              ] as const
            ).map(([key, label]) => {
              const s = variance.summary[key];
              return (
                <div className="card" key={key}>
                  <div className="text-xs uppercase tracking-wide text-ink/50 font-medium">{label}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-mono text-xl font-semibold">{formatCurrency(s.actual, variance.currency)}</span>
                    <span className="text-xs text-ink/40">/ {formatCurrency(s.budgeted, variance.currency)} prévu</span>
                  </div>
                  <div className={`text-xs mt-1 font-medium ${s.ecart >= 0 ? "text-success" : "text-critical"}`}>
                    {s.ecart >= 0 ? "+" : ""}
                    {formatCurrency(s.ecart, variance.currency)} vs budget
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
                    <th className="py-2 pr-3">Poste</th>
                    <th className="py-2 pr-3">Budgété</th>
                    <th className="py-2 pr-3">Réalisé</th>
                    <th className="py-2">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {reference?.postes.map(({ poste, label }) => {
                    const actual = actualByPoste.get(poste) ?? 0;
                    const budgeted = draft[poste] ?? 0;
                    const ecart = actual - budgeted;
                    return (
                      <tr key={poste} className="border-b border-black/5 last:border-0">
                        <td className="py-2 pr-3">{label}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            className="input py-1 w-32 font-mono"
                            value={budgeted || ""}
                            placeholder="0"
                            onChange={(e) => setDraft({ ...draft, [poste]: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-2 pr-3 font-mono text-ink/60">{formatCurrency(actual, variance.currency)}</td>
                        <td className={`py-2 font-mono ${ecartColor(poste, ecart)}`}>
                          {ecart >= 0 ? "+" : ""}
                          {formatCurrency(ecart, variance.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {error && <p className="text-critical text-sm mt-3">{error}</p>}
            {saved && <p className="text-success text-sm mt-3">Budget enregistré.</p>}
            <button className="btn-primary mt-4" disabled={submitBudget.isPending} onClick={handleSave}>
              {submitBudget.isPending ? "Enregistrement…" : "Enregistrer le budget"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
