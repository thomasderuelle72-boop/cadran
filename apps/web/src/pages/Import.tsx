import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatePeriod, useImportReference, usePeriods, useSubmitLineItems } from "../api/hooks";
import { parseAmount, parseFile, type ParsedFile } from "../lib/parseFile";
import type { LinePoste } from "../api/types";
import { ApiError } from "../api/client";

type Step = "period" | "upload" | "mapColumns" | "review";

interface AccountGroup {
  accountCode: string;
  label: string;
  total: number;
  lineCount: number;
  poste: LinePoste;
}

function suggestPosteFromPrefix(
  accountCode: string,
  mapping: Array<{ prefix: string; poste: LinePoste }>
): LinePoste | null {
  const sorted = [...mapping].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find((entry) => accountCode.trim().startsWith(entry.prefix));
  return match ? match.poste : null;
}

export function ImportPage() {
  const navigate = useNavigate();
  const { data: periods } = usePeriods();
  const { data: reference } = useImportReference();
  const createPeriod = useCreatePeriod();
  const submitLineItems = useSubmitLineItems();

  const [step, setStep] = useState<Step>("period");
  const [periodId, setPeriodId] = useState<string>("");
  const [newPeriod, setNewPeriod] = useState({ label: "", startDate: "", endDate: "" });

  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [colAccount, setColAccount] = useState("");
  const [colLabel, setColLabel] = useState("");
  const [colAmount, setColAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [groups, setGroups] = useState<AccountGroup[]>([]);

  async function handleCreatePeriod() {
    setError(null);
    try {
      const period = await createPeriod.mutateAsync(newPeriod);
      setPeriodId(period.id);
      setStep("upload");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création de la période impossible.");
    }
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const result = await parseFile(file);
      if (result.rows.length === 0) throw new Error("Le fichier ne contient aucune ligne exploitable.");
      setParsed(result);
      const guess = (needle: string) => result.headers.find((h) => h.toLowerCase().includes(needle)) ?? result.headers[0];
      setColAccount(guess("compte"));
      setColLabel(guess("libell") || guess("label"));
      setColAmount(guess("montant") || guess("amount"));
      setStep("mapColumns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fichier illisible.");
    }
  }

  function buildGroups() {
    if (!parsed || !reference) return;
    const byAccount = new Map<string, AccountGroup>();
    for (const row of parsed.rows) {
      const accountCode = String(row[colAccount] ?? "").trim();
      if (!accountCode) continue;
      const label = String(row[colLabel] ?? "").trim() || accountCode;
      const amount = parseAmount(row[colAmount]);
      const existing = byAccount.get(accountCode);
      if (existing) {
        existing.total += amount;
        existing.lineCount += 1;
      } else {
        const suggested = suggestPosteFromPrefix(accountCode, reference.pcgMapping);
        byAccount.set(accountCode, {
          accountCode,
          label,
          total: amount,
          lineCount: 1,
          poste: suggested ?? reference.postes[0].poste,
        });
      }
    }
    setGroups(Array.from(byAccount.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode)));
    setStep("review");
  }

  function updatePoste(accountCode: string, poste: LinePoste) {
    setGroups((prev) => prev.map((g) => (g.accountCode === accountCode ? { ...g, poste } : g)));
  }

  async function handleSubmit() {
    setError(null);
    try {
      await submitLineItems.mutateAsync({
        periodId,
        items: groups.map((g) => ({
          accountCode: g.accountCode,
          label: g.label,
          amount: g.total,
          poste: g.poste,
        })),
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import impossible.");
    }
  }

  const posteLabelByCode = useMemo(() => {
    const map = new Map<LinePoste, string>();
    reference?.postes.forEach((p) => map.set(p.poste, p.label));
    return map;
  }, [reference]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Import de données</h1>
        <p className="text-sm text-ink/50">
          Importez un export Excel ou CSV de votre balance comptable, puis validez la classification proposée.
        </p>
      </div>

      {error && <div className="card border-critical/40 text-critical text-sm">{error}</div>}

      {step === "period" && (
        <div className="card space-y-4">
          <h2 className="font-display text-lg font-semibold">1. Choisir la période</h2>
          {periods && periods.length > 0 && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="label">Période existante</label>
                <select className="input" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" disabled={!periodId} onClick={() => setStep("upload")}>
                Continuer
              </button>
            </div>
          )}
          <div className="border-t border-black/10 pt-4">
            <p className="text-sm font-medium mb-3">Ou créer une nouvelle période</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Libellé</label>
                <input
                  className="input"
                  placeholder="T1 2026"
                  value={newPeriod.label}
                  onChange={(e) => setNewPeriod({ ...newPeriod, label: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Début</label>
                <input
                  type="date"
                  className="input"
                  value={newPeriod.startDate}
                  onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Fin</label>
                <input
                  type="date"
                  className="input"
                  value={newPeriod.endDate}
                  onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                />
              </div>
            </div>
            <button
              className="btn-secondary mt-3"
              disabled={!newPeriod.label || !newPeriod.startDate || !newPeriod.endDate || createPeriod.isPending}
              onClick={handleCreatePeriod}
            >
              Créer la période
            </button>
          </div>
        </div>
      )}

      {step === "upload" && (
        <div className="card space-y-4">
          <h2 className="font-display text-lg font-semibold">2. Importer le fichier</h2>
          <p className="text-sm text-ink/50">Formats acceptés : .csv, .xlsx, .xls.</p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm"
          />
        </div>
      )}

      {step === "mapColumns" && parsed && (
        <div className="card space-y-4">
          <h2 className="font-display text-lg font-semibold">3. Faire correspondre les colonnes</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Numéro de compte</label>
              <select className="input" value={colAccount} onChange={(e) => setColAccount(e.target.value)}>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Libellé</label>
              <select className="input" value={colLabel} onChange={(e) => setColLabel(e.target.value)}>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Montant</label>
              <select className="input" value={colAmount} onChange={(e) => setColAmount(e.target.value)}>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto text-xs border border-black/10 rounded-lg">
            <table className="w-full">
              <thead className="bg-black/5">
                <tr>
                  {parsed.headers.map((h) => (
                    <th key={h} className="text-left px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 4).map((row, i) => (
                  <tr key={i} className="border-t border-black/5">
                    {parsed.headers.map((h) => (
                      <td key={h} className="px-2 py-1.5 text-ink/60">
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" onClick={buildGroups}>
            Analyser les comptes
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="card space-y-4">
          <h2 className="font-display text-lg font-semibold">4. Vérifier la classification</h2>
          <p className="text-sm text-ink/50">
            Chaque compte est pré-classé selon le plan comptable général. Corrigez si besoin avant de valider — ce
            classement détermine directement le calcul des ratios.
          </p>
          <div className="overflow-x-auto max-h-96 border border-black/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Compte</th>
                  <th className="text-left px-3 py-2">Libellé</th>
                  <th className="text-right px-3 py-2">Montant</th>
                  <th className="text-left px-3 py-2">Poste normalisé</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.accountCode} className="border-t border-black/5">
                    <td className="px-3 py-2 font-mono">{g.accountCode}</td>
                    <td className="px-3 py-2 text-ink/60">{g.label}</td>
                    <td className="px-3 py-2 text-right font-mono">{g.total.toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-2">
                      <select
                        className="input py-1"
                        value={g.poste}
                        onChange={(e) => updatePoste(g.accountCode, e.target.value as LinePoste)}
                      >
                        {reference?.postes.map((p) => (
                          <option key={p.poste} value={p.poste}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink/40">{groups.length} comptes détectés, classés en {posteLabelByCode.size} postes.</p>
          <button className="btn-primary" disabled={submitLineItems.isPending} onClick={handleSubmit}>
            {submitLineItems.isPending ? "Import en cours…" : "Valider l'import"}
          </button>
        </div>
      )}
    </div>
  );
}
