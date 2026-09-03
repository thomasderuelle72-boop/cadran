import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  useCashCategories,
  useCashLines,
  useCashProjection,
  useCreateCashLine,
  useDeleteCashLine,
  useEntities,
  usePrefillCash,
} from "../api/hooks";
import { EntitySelector } from "../components/EntitySelector";
import { KpiTile } from "../components/KpiTile";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency, formatDate } from "../lib/format";
import type { CashCategory, CashRecurrence } from "../api/types";
import { ApiError } from "../api/client";

const RECURRENCE_LABELS: Record<CashRecurrence, string> = {
  NONE: "Ponctuel",
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuel",
};

const HORIZONS = [13, 26, 52];

export function CashPage() {
  const { data: entities } = useEntities();
  const [entityId, setEntityId] = useState("");
  const [weeks, setWeeks] = useState(13);

  useEffect(() => {
    if (!entityId && entities && entities.length > 0) setEntityId(entities[0].id);
  }, [entities, entityId]);

  const { data: projection, isLoading } = useCashProjection(entityId || null, weeks);
  const { data: lines } = useCashLines(entityId || null);
  const { data: categories } = useCashCategories(entityId || null);
  const createLine = useCreateCashLine();
  const deleteLine = useDeleteCashLine();
  const prefill = usePrefillCash();

  const [form, setForm] = useState({
    label: "",
    category: "ENCAISSEMENTS_CLIENTS" as CashCategory,
    amount: "",
    startDate: "",
    recurrence: "NONE" as CashRecurrence,
    endDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createLine.mutateAsync({
        entityId,
        label: form.label,
        category: form.category,
        amount: Number(form.amount),
        startDate: form.startDate,
        recurrence: form.recurrence,
        endDate: form.recurrence !== "NONE" && form.endDate ? form.endDate : undefined,
      });
      setForm({ ...form, label: "", amount: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ajout impossible.");
    }
  }

  async function handlePrefill() {
    setError(null);
    setNotice(null);
    try {
      const result = await prefill.mutateAsync(entityId);
      setNotice(`${result.created} lignes mensuelles créées à partir de ${result.basedOn.label}. Ajustez-les selon vos échéances réelles.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Pré-remplissage impossible.");
    }
  }

  const currency = projection?.currency ?? "EUR";
  const lastWeek = projection?.weeks[projection.weeks.length - 1];
  const chartData =
    projection?.weeks.map((w) => ({ label: formatDate(w.weekStart), solde: Math.round(w.closingBalance) })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Trésorerie prévisionnelle</h1>
          <p className="text-sm text-ink/50">Projection glissante du solde de trésorerie, semaine par semaine.</p>
        </div>
        <div className="flex gap-2">
          <EntitySelector value={entityId} onChange={setEntityId} />
          <select className="input w-36" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {h} semaines
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="card border-critical/40 text-critical text-sm">{error}</div>}
      {notice && <div className="card border-success/40 text-success text-sm">{notice}</div>}
      {isLoading && <p className="text-ink/50">Calcul de la projection…</p>}

      {projection && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiTile
              label="Solde d'ouverture"
              value={formatCurrency(projection.openingBalance, currency)}
              sublabel={
                projection.openingSource
                  ? `Disponibilités au ${formatDate(projection.openingSource.endDate)} (${projection.openingSource.label})`
                  : "Aucune période importée : départ à zéro"
              }
            />
            <KpiTile
              label="Point bas"
              value={formatCurrency(projection.lowestBalance, currency)}
              sublabel={projection.lowestWeekStart ? `Semaine du ${formatDate(projection.lowestWeekStart)}` : "Pas de baisse sur l'horizon"}
            />
            <KpiTile
              label={`Solde à ${weeks} semaines`}
              value={lastWeek ? formatCurrency(lastWeek.closingBalance, currency) : "—"}
              sublabel={lastWeek ? `Semaine du ${formatDate(lastWeek.weekStart)}` : undefined}
            />
            <KpiTile
              label="Semaines en tension"
              value={String(projection.weeks.filter((w) => w.status !== "bon").length)}
              sublabel={`sur ${projection.horizonWeeks} · ${projection.lineCount} ligne(s) prévisionnelle(s)`}
            />
          </div>

          {projection.lineCount === 0 && (
            <div className="card flex items-center justify-between gap-4">
              <p className="text-sm text-ink/60">
                Aucun flux prévisionnel saisi. Vous pouvez partir du rythme de la dernière période importée, puis ajuster.
              </p>
              <button className="btn-primary whitespace-nowrap" disabled={prefill.isPending} onClick={handlePrefill}>
                {prefill.isPending ? "Création…" : "Pré-remplir depuis la dernière période"}
              </button>
            </div>
          )}

          <div className="card">
            <h3 className="font-display text-lg font-semibold mb-3">Solde de trésorerie projeté</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="soldeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1F5C4E" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1F5C4E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
                <XAxis dataKey="label" fontSize={11} stroke="#171F1980" interval="preserveStartEnd" />
                <YAxis fontSize={12} stroke="#171F1980" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), currency)} />
                <ReferenceLine y={0} stroke="#AE3B32" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="solde" name="Solde" stroke="#1F5C4E" strokeWidth={2} fill="url(#soldeFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-display text-lg font-semibold mb-3">Détail par semaine</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
                    <th className="py-2 pr-3">Semaine</th>
                    <th className="py-2 pr-3 text-right">Encaissements</th>
                    <th className="py-2 pr-3 text-right">Décaissements</th>
                    <th className="py-2 pr-3 text-right">Net</th>
                    <th className="py-2 pr-3 text-right">Solde fin</th>
                    <th className="py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.weeks.map((w) => (
                    <tr key={w.weekStart} className="border-b border-black/5 last:border-0">
                      <td className="py-2 pr-3">
                        {formatDate(w.weekStart)}
                        {w.movements.length > 0 && (
                          <span className="text-ink/40 text-xs"> · {w.movements.map((m) => m.label).join(", ")}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-success">{w.inflows ? formatCurrency(w.inflows, currency) : "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono text-critical">{w.outflows ? formatCurrency(w.outflows, currency) : "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatCurrency(w.net, currency)}</td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency(w.closingBalance, currency)}</td>
                      <td className="py-2">
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold">Flux prévisionnels</h3>
          {lines && lines.length > 0 && (
            <button className="btn-secondary" disabled={prefill.isPending} onClick={handlePrefill}>
              Ajouter le rythme de la dernière période
            </button>
          )}
        </div>
        {lines && lines.length === 0 && <p className="text-sm text-ink/50 mb-3">Aucune ligne pour cette entité.</p>}
        {lines && lines.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
                <th className="py-2 pr-3">Libellé</th>
                <th className="py-2 pr-3">Catégorie</th>
                <th className="py-2 pr-3 text-right">Montant</th>
                <th className="py-2 pr-3">À partir du</th>
                <th className="py-2 pr-3">Récurrence</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2 pr-3">{line.label}</td>
                  <td className="py-2 pr-3 text-ink/60">
                    {categories?.find((c) => c.category === line.category)?.label ?? line.category}
                  </td>
                  <td className={`py-2 pr-3 text-right font-mono ${Number(line.amount) >= 0 ? "text-success" : "text-critical"}`}>
                    {formatCurrency(Number(line.amount), currency)}
                  </td>
                  <td className="py-2 pr-3 text-ink/60">{formatDate(line.startDate)}</td>
                  <td className="py-2 pr-3 text-ink/60">
                    {RECURRENCE_LABELS[line.recurrence]}
                    {line.endDate ? ` jusqu'au ${formatDate(line.endDate)}` : ""}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="text-critical text-xs hover:underline"
                      onClick={() => deleteLine.mutate({ entityId, lineId: line.id })}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-6 gap-3 items-end">
          <div className="col-span-2">
            <label className="label">Libellé</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CashCategory })}>
              {categories?.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Montant (− = sortie)</label>
            <input
              type="number"
              step="any"
              className="input font-mono"
              placeholder="-12000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
          </div>
          <div>
            <label className="label">Récurrence</label>
            <select className="input" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as CashRecurrence })}>
              {(Object.keys(RECURRENCE_LABELS) as CashRecurrence[]).map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {form.recurrence !== "NONE" && (
            <div>
              <label className="label">Jusqu'au (optionnel)</label>
              <input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          )}
          <div className="col-span-6">
            <button type="submit" className="btn-primary" disabled={createLine.isPending || !entityId}>
              {createLine.isPending ? "Ajout…" : "Ajouter le flux"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
