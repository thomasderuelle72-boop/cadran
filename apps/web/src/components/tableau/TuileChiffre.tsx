import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import type { Ecart } from "../../lib/tableauDeBord";
import { useCompteur } from "../../lib/animation";

/**
 * Un chiffre clé : sa valeur, son évolution, sa trajectoire.
 *
 * L'évolution est colorée selon ce qu'elle veut dire et non selon son
 * signe : une trésorerie qui monte est une bonne nouvelle, et la flèche le
 * dit en plus de la couleur — un lecteur qui ne distingue pas le vert du
 * rouge lit la flèche et le signe.
 *
 * La courbe miniature reprend les périodes comparables (trimestres avec
 * trimestres) ; la période affichée y est marquée d'un point.
 */
export function TuileChiffre({
  libelle,
  aide,
  valeur,
  formater,
  ecart,
  comparaison,
  hausseFavorable = true,
  sousTitre,
  serie,
}: {
  libelle: string;
  aide: string;
  valeur: number;
  formater: (n: number) => string;
  ecart?: Ecart | null;
  /** Libellé de la période de comparaison, par exemple « T2 2026 ». */
  comparaison?: string;
  hausseFavorable?: boolean;
  sousTitre?: string;
  serie?: number[];
}) {
  const affiche = useCompteur(valeur);

  return (
    <div className="card survol-leve flex flex-col gap-3 min-w-0 h-full">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-ink-2">{libelle}</span>
        <span title={aide} aria-label={aide} className="text-ink-3 hover:text-ink cursor-help flex-none">
          <Info size={15} aria-hidden="true" />
        </span>
      </div>

      <div>
        <div className="text-[1.75rem] leading-none font-bold tracking-tight">{formater(affiche)}</div>
        {sousTitre && <div className="text-sm text-ink-3 mt-1.5">{sousTitre}</div>}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3">
        <PuceEcart ecart={ecart} comparaison={comparaison} hausseFavorable={hausseFavorable} formater={formater} />
        {serie && serie.length > 1 && <Tendance points={serie} />}
      </div>
    </div>
  );
}

function PuceEcart({
  ecart,
  comparaison,
  hausseFavorable,
  formater,
}: {
  ecart?: Ecart | null;
  comparaison?: string;
  hausseFavorable: boolean;
  formater: (n: number) => string;
}) {
  if (!ecart || !comparaison) {
    return <span className="text-xs text-ink-3">Pas de période comparable</span>;
  }

  // Sous un demi-point, on parle de stabilité : une flèche verte pour +0,2 %
  // annoncerait une bonne nouvelle qui n'en est pas une.
  const stable = ecart.pourcentage !== null ? Math.abs(ecart.pourcentage) < 0.005 : ecart.absolu === 0;
  const hausse = ecart.absolu > 0;
  const favorable = stable ? null : hausse === hausseFavorable;
  const Icone = stable ? ArrowRight : hausse ? ArrowUpRight : ArrowDownRight;
  const couleur =
    favorable === null ? "text-ink-3 bg-ink/5" : favorable ? "text-success bg-success-soft" : "text-critical bg-critical-soft";
  const signe = ecart.absolu > 0 ? "+" : ecart.absolu < 0 ? "−" : "";
  const texte =
    ecart.pourcentage !== null
      ? `${signe}${Math.abs(ecart.pourcentage * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
      : `${signe}${formater(Math.abs(ecart.absolu))}`;

  return (
    <span className="flex flex-col gap-1 min-w-0">
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${couleur}`}>
        <Icone size={13} aria-hidden="true" />
        {stable ? "Stable" : texte}
      </span>
      <span className="text-xs text-ink-3 truncate">vs {comparaison}</span>
    </span>
  );
}

/**
 * Courbe miniature, sans axe : elle dit « monte, descend, plat », pas des
 * valeurs, que la tuile donne déjà. Trait discret, point de la période en
 * couleur de marque.
 */
function Tendance({ points }: { points: number[] }) {
  const largeur = 96;
  const hauteur = 34;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const etendue = max - min || 1;
  const x = (i: number) => 4 + (i / (points.length - 1)) * (largeur - 8);
  const y = (v: number) => 4 + (1 - (v - min) / etendue) * (hauteur - 8);
  const trace = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dernier = points.length - 1;

  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden="true" className="flex-none">
      <path d={trace} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="text-ink-3/50" />
      <circle cx={x(dernier)} cy={y(points[dernier])} r={4} strokeWidth={2} className="fill-primary stroke-surface" />
    </svg>
  );
}
