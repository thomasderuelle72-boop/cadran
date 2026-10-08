import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  Gauge,
  Info,
  Landmark,
  Minus,
  OctagonAlert,
  TrendingUp,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { RatioCategory, RatioStatus, RatioValue } from "../../api/types";
import { formatRatioValue } from "../../lib/format";

/**
 * Les indicateurs d'une famille, chacun avec son état.
 *
 * Chaque famille s'ouvre sur la question à laquelle elle répond : on ne
 * demande pas au lecteur de savoir ce qu'est la « solvabilité », on lui dit
 * qu'elle répond à « l'entreprise est-elle trop endettée ? ». La définition
 * de chaque ratio est au survol de l'icône d'information.
 *
 * L'état se lit à l'icône et à la couleur ensemble, jamais à la couleur
 * seule.
 */
export const FAMILLES: Record<RatioCategory, { titre: string; question: string; Icone: LucideIcon }> = {
  RENTABILITE: { titre: "Rentabilité", question: "L'entreprise gagne-t-elle de l'argent ?", Icone: TrendingUp },
  LIQUIDITE: { titre: "Liquidité", question: "Peut-elle payer ce qu'elle doit à court terme ?", Icone: Waves },
  SOLVABILITE: { titre: "Solvabilité", question: "Est-elle trop endettée ?", Icone: Landmark },
  ACTIVITE: { titre: "Activité", question: "Encaisse-t-elle vite, paie-t-elle vite ?", Icone: Gauge },
};

const ETATS: Record<RatioStatus, { Icone: LucideIcon; classe: string; libelle: string }> = {
  bon: { Icone: CircleCheck, classe: "text-success", libelle: "Bon" },
  attention: { Icone: AlertTriangle, classe: "text-warning", libelle: "À surveiller" },
  critique: { Icone: OctagonAlert, classe: "text-critical", libelle: "Critique" },
  neutre: { Icone: Minus, classe: "text-ink-3", libelle: "Sans seuil" },
};

export function FamilleIndicateurs({
  categorie,
  ratios,
  currency,
  ouComprendre,
}: {
  categorie: RatioCategory;
  ratios: RatioValue[];
  currency: string;
  ouComprendre: Record<string, { to: string; libelle: string }>;
}) {
  const famille = FAMILLES[categorie];
  const juges = ratios.filter((r) => r.status !== "neutre" && r.value !== null);
  const auVert = juges.filter((r) => r.status === "bon").length;

  return (
    <section className="card">
      <header className="flex items-start gap-3 mb-3">
        <span className="grid place-items-center h-9 w-9 flex-none rounded-lg bg-primary-soft text-primary" aria-hidden="true">
          <famille.Icone size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-bold">{famille.titre}</h3>
            {juges.length > 0 && (
              <span className="text-xs font-medium text-ink-3 flex-none">
                {auVert}/{juges.length} au vert
              </span>
            )}
          </div>
          <p className="text-sm text-ink-3">{famille.question}</p>
        </div>
      </header>

      <ul className="divide-y divide-rule/[0.07]">
        {ratios.map((ratio) => {
          const etat = ETATS[ratio.value === null ? "neutre" : ratio.status];
          const lien = ratio.status === "critique" || ratio.status === "attention" ? ouComprendre[ratio.id] : undefined;
          return (
            <li key={ratio.id} className="flex items-start gap-2.5 py-2">
              <etat.Icone size={16} className={`flex-none mt-0.5 ${etat.classe}`} aria-label={etat.libelle} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-ink-2 inline-flex items-center gap-1 min-w-0">
                    <span className="truncate">{ratio.label}</span>
                    <span title={ratio.interpretation} aria-label={ratio.interpretation} className="text-ink-3 hover:text-ink cursor-help flex-none">
                      <Info size={13} aria-hidden="true" />
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums flex-none">
                    {formatRatioValue(ratio.value, ratio.unit, currency)}
                  </span>
                </div>
                {lien && (
                  <Link to={lien.to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {lien.libelle}
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
