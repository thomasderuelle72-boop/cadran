import { useState } from "react";
import { useAcknowledgeAlert, useAlertEvents, useAlertRules, useCreateAlertRule, useDeleteAlertRule } from "../api/hooks";
import { RATIO_CATALOG } from "../lib/ratioCatalog";
import type { AlertOperator } from "../api/types";
import { ApiError } from "../api/client";
import { formatDate } from "../lib/format";

const OPERATOR_LABELS: Record<AlertOperator, string> = {
  LT: "<",
  LTE: "≤",
  GT: ">",
  GTE: "≥",
};

export function AlertsPage() {
  const { data: rules } = useAlertRules();
  const { data: events } = useAlertEvents();
  const createRule = useCreateAlertRule();
  const deleteRule = useDeleteAlertRule();
  const acknowledge = useAcknowledgeAlert();

  const [form, setForm] = useState({ label: "", ratioId: RATIO_CATALOG[0].id, operator: "LT" as AlertOperator, threshold: 0 });
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRule.mutateAsync(form);
      setForm({ label: "", ratioId: RATIO_CATALOG[0].id, operator: "LT", threshold: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible.");
    }
  }

  const activeEvents = events?.filter((e) => !e.acknowledged) ?? [];
  const acknowledgedEvents = events?.filter((e) => e.acknowledged) ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Alertes</h1>
        <p className="text-sm text-ink/50">Seuils surveillés sur les ratios, réévalués à chaque import.</p>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold mb-3">
          Alertes actives {activeEvents.length > 0 && `(${activeEvents.length})`}
        </h2>
        {activeEvents.length === 0 && <p className="text-sm text-ink/50">Aucun seuil franchi actuellement.</p>}
        <ul className="divide-y divide-black/5">
          {activeEvents.map((event) => (
            <li key={event.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-critical">{event.rule.label}</span>
                <span className="text-ink/50">
                  {" "}
                  — {event.entity?.name} · {event.period?.label} · valeur {event.value.toFixed(2)}
                </span>
              </div>
              <button className="btn-secondary" onClick={() => acknowledge.mutate(event.id)}>
                Marquer comme vue
              </button>
            </li>
          ))}
        </ul>
        {acknowledgedEvents.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-ink/50 cursor-pointer">Alertes vues ({acknowledgedEvents.length})</summary>
            <ul className="divide-y divide-black/5 mt-2">
              {acknowledgedEvents.map((event) => (
                <li key={event.id} className="py-2 text-sm text-ink/40">
                  {event.rule.label} — {event.entity?.name} · {event.period?.label} · {formatDate(event.updatedAt)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold mb-3">Règles configurées</h2>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
              <th className="py-2">Libellé</th>
              <th className="py-2">Condition</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules?.map((rule) => (
              <tr key={rule.id} className="border-b border-black/5 last:border-0">
                <td className="py-2">{rule.label}</td>
                <td className="py-2 font-mono text-ink/60">
                  {RATIO_CATALOG.find((r) => r.id === rule.ratioId)?.label ?? rule.ratioId} {OPERATOR_LABELS[rule.operator]}{" "}
                  {rule.threshold}
                </td>
                <td className="py-2 text-right">
                  <button className="text-critical text-xs hover:underline" onClick={() => deleteRule.mutate(rule.id)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={handleCreate} className="grid grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="label">Libellé</label>
            <input
              className="input"
              placeholder="Ex : DSO au-delà de 60 jours"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Ratio</label>
            <select className="input" value={form.ratioId} onChange={(e) => setForm({ ...form, ratioId: e.target.value })}>
              {RATIO_CATALOG.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <select
              className="input w-20"
              value={form.operator}
              onChange={(e) => setForm({ ...form, operator: e.target.value as AlertOperator })}
            >
              {(Object.keys(OPERATOR_LABELS) as AlertOperator[]).map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              className="input"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
              required
            />
          </div>
          <div className="col-span-4">
            {error && <p className="text-critical text-sm mb-2">{error}</p>}
            <button type="submit" className="btn-primary" disabled={createRule.isPending}>
              {createRule.isPending ? "Création…" : "Ajouter la règle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
