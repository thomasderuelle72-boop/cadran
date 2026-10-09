import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, BellRing } from "lucide-react";
import { useAcknowledgeAlert, useAlertEvents, useAlertRules, useCreateAlertRule, useDeleteAlertRule } from "../api/hooks";
import { RATIO_CATALOG } from "../lib/ratioCatalog";
import type { AlertEvent, AlertOperator, RatioUnit } from "../api/types";
import { ApiError } from "../api/client";
import { formatDate, formatRatioValue } from "../lib/format";
import { EntetePage } from "../components/etats";
import { choisirDossier } from "../lib/dossierCourant";

const OPERATEURS: Record<AlertOperator, string> = {
  LT: "<",
  LTE: "≤",
  GT: ">",
  GTE: "≥",
};

const uniteDe = (ratioId: string): RatioUnit => RATIO_CATALOG.find((r) => r.id === ratioId)?.unite ?? "ratio";

/** Un seuil en pourcentage se saisit « 20 », et se compare au ratio « 0,20 ». */
const depuisSaisie = (valeur: number, unite: RatioUnit) => (unite === "pourcentage" ? valeur / 100 : valeur);
const SUFFIXE: Partial<Record<RatioUnit, string>> = { pourcentage: "%", jours: "j", annees: "ans", devise: "€" };

interface Groupe {
  cle: string;
  entite: { id: string; name: string } | null;
  regle: AlertEvent["rule"];
  evenements: AlertEvent[];
}

/**
 * Les alertes du cabinet, dossier par dossier.
 *
 * L'ancienne liste répétait la même ligne pour chaque période : onze fois
 * « DSO au-delà de 60 jours — Atelier Nova Industrie », une par mois. Une
 * règle franchie est désormais une seule ligne par dossier, avec le nombre de
 * périodes concernées, la dernière valeur, et de quoi ouvrir le dossier.
 */
export function AlertsPage() {
  const navigate = useNavigate();
  const { data: regles } = useAlertRules();
  const { data: evenements } = useAlertEvents();
  const creer = useCreateAlertRule();
  const supprimer = useDeleteAlertRule();
  const acquitter = useAcknowledgeAlert();

  const [formulaire, setFormulaire] = useState({ label: "", ratioId: RATIO_CATALOG[0].id, operator: "LT" as AlertOperator, seuil: 0 });
  const [erreur, setErreur] = useState<string | null>(null);

  const groupes = useMemo(() => {
    const parCle = new Map<string, Groupe>();
    for (const e of evenements ?? []) {
      if (e.acknowledged) continue;
      const cle = `${e.entity?.id ?? "-"}|${e.rule.id}`;
      const groupe = parCle.get(cle) ?? { cle, entite: e.entity, regle: e.rule, evenements: [] };
      groupe.evenements.push(e);
      parCle.set(cle, groupe);
    }
    for (const g of parCle.values()) g.evenements.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return [...parCle.values()].sort(
      (a, b) => (a.entite?.name ?? "").localeCompare(b.entite?.name ?? "", "fr") || a.regle.label.localeCompare(b.regle.label, "fr"),
    );
  }, [evenements]);
  const vues = evenements?.filter((e) => e.acknowledged) ?? [];
  const dossiers = new Set(groupes.map((g) => g.entite?.id)).size;

  async function creerRegle(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const { seuil, ...reste } = formulaire;
    try {
      await creer.mutateAsync({ ...reste, threshold: depuisSaisie(seuil, uniteDe(formulaire.ratioId)) });
      setFormulaire({ label: "", ratioId: RATIO_CATALOG[0].id, operator: "LT", seuil: 0 });
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    }
  }

  function ouvrir(entiteId: string) {
    choisirDossier(entiteId);
    navigate("/tableau-de-bord");
  }

  const uniteFormulaire = uniteDe(formulaire.ratioId);

  return (
    <div className="space-y-6 max-w-5xl">
      <EntetePage titre="Alertes" sousTitre="Les seuils franchis dans les dossiers du cabinet, réévalués à chaque import." />

      <section className="card" aria-labelledby="titre-actives">
        <h2 id="titre-actives" className="text-lg font-bold">
          À traiter
        </h2>
        <p className="text-sm text-ink-3 mb-3">
          {groupes.length === 0
            ? "Aucun seuil franchi actuellement."
            : `${groupes.length} alerte${groupes.length > 1 ? "s" : ""} sur ${dossiers} dossier${dossiers > 1 ? "s" : ""}.`}
        </p>
        <ul className="divide-y divide-rule/[0.07]">
          {groupes.map((g) => {
            const derniere = g.evenements[0];
            const unite = uniteDe(g.regle.ratioId);
            return (
              <li key={g.cle} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <BellRing size={18} className="text-critical flex-none" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink-3">{g.entite?.name ?? "Organisation"}</div>
                  <div className="font-semibold">{g.regle.label}</div>
                  <div className="text-sm text-ink-3">
                    {derniere.period?.label ? `${derniere.period.label} : ` : ""}
                    {formatRatioValue(derniere.value, unite)}
                    {g.evenements.length > 1 && ` · franchie sur ${g.evenements.length} périodes`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.entite && (
                    <button type="button" className="btn-secondary py-1.5" onClick={() => ouvrir(g.entite!.id)}>
                      Ouvrir le dossier
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary py-1.5"
                    disabled={acquitter.isPending}
                    onClick={() => g.evenements.forEach((e) => acquitter.mutate(e.id))}
                  >
                    Marquer comme vue{g.evenements.length > 1 ? "s" : ""}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {vues.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-ink-3 cursor-pointer">Alertes déjà vues ({vues.length})</summary>
            <ul className="divide-y divide-rule/5 mt-2">
              {vues.map((e) => (
                <li key={e.id} className="py-2 text-sm text-ink-3">
                  {e.rule.label} — {e.entity?.name} · {e.period?.label} · {formatDate(e.updatedAt)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card" aria-labelledby="titre-regles">
        <h2 id="titre-regles" className="text-lg font-bold">
          Règles du cabinet
        </h2>
        <p className="text-sm text-ink-3 mb-3">Elles s&apos;appliquent à tous les dossiers, à chaque import.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mb-4 min-w-[480px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
                <th className="py-2 font-semibold">Libellé</th>
                <th className="py-2 font-semibold">Condition</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {regles?.map((r) => (
                <tr key={r.id} className="border-b border-rule/5 last:border-0">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-ink-2">
                    {RATIO_CATALOG.find((c) => c.id === r.ratioId)?.label ?? r.ratioId} {OPERATEURS[r.operator]}{" "}
                    {formatRatioValue(r.threshold, uniteDe(r.ratioId))}
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-critical text-xs hover:underline" onClick={() => supprimer.mutate(r.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={creerRegle} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="regle-libelle">
              Libellé
            </label>
            <input
              id="regle-libelle"
              className="input"
              placeholder="Ex : clients payés au-delà de 60 jours"
              value={formulaire.label}
              onChange={(e) => setFormulaire({ ...formulaire, label: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="regle-ratio">
              Indicateur
            </label>
            <select
              id="regle-ratio"
              className="input"
              value={formulaire.ratioId}
              onChange={(e) => setFormulaire({ ...formulaire, ratioId: e.target.value })}
            >
              {RATIO_CATALOG.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="regle-seuil">
              Seuil
            </label>
            <div className="flex gap-2 items-center">
              <select
                className="input w-16"
                aria-label="Comparaison"
                value={formulaire.operator}
                onChange={(e) => setFormulaire({ ...formulaire, operator: e.target.value as AlertOperator })}
              >
                {(Object.keys(OPERATEURS) as AlertOperator[]).map((op) => (
                  <option key={op} value={op}>
                    {OPERATEURS[op]}
                  </option>
                ))}
              </select>
              <input
                id="regle-seuil"
                type="number"
                step="any"
                className="input"
                value={formulaire.seuil}
                onChange={(e) => setFormulaire({ ...formulaire, seuil: Number(e.target.value) })}
                required
              />
              {SUFFIXE[uniteFormulaire] && <span className="text-sm text-ink-3">{SUFFIXE[uniteFormulaire]}</span>}
            </div>
          </div>
          <div className="sm:col-span-4">
            {erreur && <p className="text-critical text-sm mb-2">{erreur}</p>}
            <button type="submit" className="btn-primary" disabled={creer.isPending}>
              {creer.isPending ? "Création…" : "Ajouter la règle"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
